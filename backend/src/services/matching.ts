import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { assignments, availabilitySlots, ratings, taskSkills, tasks, volunteerSkills, volunteers } from '../db/schema.js';
import { haversineKm } from './geo.js';
import { env } from '../lib/env.js';
import { getRedis } from './redis.js';

type MatchRow = {
  volunteer_id: string;
  score: number;
  justification: string;
  factors: Record<string, unknown>;
};

async function computeReliability(volunteerId: string) {
  const row = await db
    .select({
      avg: sql<number | null>`avg(${ratings.rating})`,
    })
    .from(ratings)
    .where(eq(ratings.volunteerId, volunteerId));
  const avg = row[0]?.avg ?? null;
  if (!avg) return 60; // neutral baseline
  return Math.max(0, Math.min(100, (avg / 5) * 100));
}

async function computeAvailability(volunteerId: string) {
  // Prototype rule: if volunteer has any availability slot configured, treat as available.
  const slot = await db.query.availabilitySlots.findFirst({ where: eq(availabilitySlots.volunteerId, volunteerId) });
  return slot ? 100 : 50;
}

export async function matchTask(taskId: string, limit = 3): Promise<MatchRow[]> {
  const cacheKey = `task:${taskId}:match:${limit}`;
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as MatchRow[];
    } catch {
      // ignore
    }
  }

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return [];

  const required = await db.select().from(taskSkills).where(eq(taskSkills.taskId, taskId));
  const requiredSkillIds = required.map((r) => r.skillId);

  // candidates: volunteers not at max capacity
  const candidates = await db.select().from(volunteers).where(sql`${volunteers.currentWorkload} < ${volunteers.maxTasksPerWeek}`);
  const volIds = candidates.map((v) => v.id);

  const vSkills = requiredSkillIds.length
    ? await db
        .select()
        .from(volunteerSkills)
        .where(inArray(volunteerSkills.volunteerId, volIds))
    : [];

  // compute skill match as required skills present with proficiency >= required_level
  const reqBySkill = new Map(required.map((r) => [r.skillId, r.requiredLevel] as const));
  const skillsByVolunteer = new Map<string, Map<string, number>>();
  for (const vs of vSkills) {
    if (!skillsByVolunteer.has(vs.volunteerId)) skillsByVolunteer.set(vs.volunteerId, new Map());
    skillsByVolunteer.get(vs.volunteerId)!.set(vs.skillId, vs.proficiencyLevel);
  }

  const taskLoc = {
    lat: task.locationLat ? Number(task.locationLat) : NaN,
    lng: task.locationLng ? Number(task.locationLng) : NaN,
  };

  const rows: MatchRow[] = [];
  for (const v of candidates) {
    const vMap = skillsByVolunteer.get(v.id) ?? new Map();
    let skillScore = 100;
    if (requiredSkillIds.length) {
      let hit = 0;
      for (const skillId of requiredSkillIds) {
        const requiredLevel = reqBySkill.get(skillId) ?? 1;
        const level = vMap.get(skillId) ?? 0;
        if (level >= requiredLevel) hit++;
      }
      skillScore = (hit / requiredSkillIds.length) * 100;
    }

    const vLoc = {
      lat: v.locationLat ? Number(v.locationLat) : NaN,
      lng: v.locationLng ? Number(v.locationLng) : NaN,
    };
    const distanceKm =
      Number.isFinite(taskLoc.lat) && Number.isFinite(taskLoc.lng) && Number.isFinite(vLoc.lat) && Number.isFinite(vLoc.lng)
        ? haversineKm(taskLoc, vLoc)
        : 9999;

    const availability = await computeAvailability(v.id);
    const reliability = await computeReliability(v.id);
    const proximity = Math.max(0, Math.min(100, 100 - (distanceKm / 50) * 100));

    const score = 0.4 * skillScore + 0.25 * proximity + 0.2 * availability + 0.15 * reliability;
    const justification = `Skill ${skillScore.toFixed(0)}%, proximity ${proximity.toFixed(0)}%, availability ${availability.toFixed(
      0
    )}%, reliability ${reliability.toFixed(0)}%.`;

    rows.push({
      volunteer_id: v.id,
      score: Math.round(score * 100) / 100,
      justification,
      factors: { skill_match: skillScore, distance_km: distanceKm, proximity, availability, reliability },
    });
  }

  rows.sort((a, b) => b.score - a.score);
  const top = rows.slice(0, Math.max(1, limit));

  // Best-effort: call external matching engine if available (same candidates), but fall back to local.
  try {
    const payload = {
      task_id: taskId,
      limit,
      candidates: top.map((t) => ({
        volunteer_id: t.volunteer_id,
        skill_match: (t.factors.skill_match as number) ?? 0,
        distance_km: (t.factors.distance_km as number) ?? 9999,
        availability: (t.factors.availability as number) ?? 50,
        reliability: (t.factors.reliability as number) ?? 60,
      })),
    };
    const resp = await fetch(`${env.MATCHING_ENGINE_URL}/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const engine = (await resp.json()) as Array<{ volunteer_id: string; score: number; justification: string; factors: any }>;
      const merged = engine.map((e) => ({
        volunteer_id: e.volunteer_id,
        score: e.score,
        justification: e.justification,
        factors: e.factors ?? {},
      }));
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(merged), 'EX', 60 * 5);
      }
      return merged;
    }
  } catch {
    // ignore
  }

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(top), 'EX', 60 * 5);
    } catch {
      // ignore
    }
  }
  return top;
}

export async function recomputeVolunteerWorkload(volunteerId: string) {
  const row = await db
    .select({ c: sql<number>`count(*)` })
    .from(assignments)
    .where(
      sql`${assignments.volunteerId} = ${volunteerId} AND ${assignments.status} IN ('assigned','accepted','in_progress')`
    );
  const c = Number(row[0]?.c ?? 0);
  await db.update(volunteers).set({ currentWorkload: c }).where(eq(volunteers.id, volunteerId));
}

