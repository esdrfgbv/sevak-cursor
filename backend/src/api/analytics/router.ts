import { Router } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';

import { requireAuth, requireRole } from '../../lib/authMiddleware.js';
import { db } from '../../db/client.js';
import { assignments, ratings, skills, taskSkills, tasks, volunteerSkills, volunteers } from '../../db/schema.js';

export const analyticsRouter = Router();

analyticsRouter.get('/dashboard', requireAuth, requireRole(['admin', 'coordinator']), async (req, res, next) => {
  try {
    const eventId = String(req.query.event_id ?? '');
    const where = eventId ? sql`${tasks.eventId} = ${eventId}` : sql`true`;

    const taskCounts = await db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`sum(case when ${tasks.status} = 'completed' then 1 else 0 end)`,
        pending: sql<number>`sum(case when ${tasks.status} in ('open','assigned','in_progress') then 1 else 0 end)`,
      })
      .from(tasks)
      .where(where);

    const volunteerCounts = await db.select({ total: sql<number>`count(*)` }).from(volunteers);

    // simple time_saved heuristic: (manual 30 min - ai 2 min) * assigned tasks
    const assignedCount = await db
      .select({ c: sql<number>`sum(case when ${tasks.status} in ('assigned','in_progress','completed') then 1 else 0 end)` })
      .from(tasks)
      .where(where);

    const c = Number(assignedCount[0]?.c ?? 0);
    const time_saved = c * (30 - 2);

    res.json({
      tasks: {
        total: Number(taskCounts[0]?.total ?? 0),
        completed: Number(taskCounts[0]?.completed ?? 0),
        pending: Number(taskCounts[0]?.pending ?? 0),
      },
      volunteers: { total: Number(volunteerCounts[0]?.total ?? 0) },
      time_saved_minutes: time_saved,
    });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/heatmap', requireAuth, requireRole(['admin', 'coordinator']), async (req, res, next) => {
  try {
    const eventId = String(req.query.event_id ?? '');
    const where = eventId ? eq(tasks.eventId, eventId) : undefined;
    const list = where ? await db.select().from(tasks).where(where).limit(1000) : await db.select().from(tasks).limit(1000);
    const points = list
      .filter((t) => t.locationLat && t.locationLng)
      .map((t) => ({ lat: Number(t.locationLat), lng: Number(t.locationLng), intensity: t.priority }));
    res.json(points);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/volunteer-performance', requireAuth, requireRole(['admin', 'coordinator']), async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const rows = await db
      .select({
        volunteer_id: assignments.volunteerId,
        tasks_completed: sql<number>`sum(case when ${assignments.status}='completed' then 1 else 0 end)`,
        avg_rating: sql<number | null>`avg(${ratings.rating})`,
      })
      .from(assignments)
      .leftJoin(ratings, eq(ratings.volunteerId, assignments.volunteerId))
      .groupBy(assignments.volunteerId)
      .orderBy(sql`tasks_completed desc`)
      .limit(limit);
    res.json(rows.map((r) => ({ ...r, avg_rating: r.avg_rating ? Number(r.avg_rating) : null })));
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/skill-demand', requireAuth, requireRole(['admin', 'coordinator']), async (req, res, next) => {
  try {
    const eventId = String(req.query.event_id ?? '');
    const where = eventId ? sql`${tasks.eventId} = ${eventId}` : sql`true`;

    const demand = await db
      .select({
        skill_id: taskSkills.skillId,
        count: sql<number>`count(*)`,
      })
      .from(taskSkills)
      .innerJoin(tasks, eq(tasks.id, taskSkills.taskId))
      .where(where)
      .groupBy(taskSkills.skillId)
      .orderBy(sql`count desc`)
      .limit(50);

    const skillIds = demand.map((d) => d.skill_id);
    const vBySkill = skillIds.length
      ? await db
          .select({
            skill_id: volunteerSkills.skillId,
            filled: sql<number>`count(*)`,
          })
          .from(volunteerSkills)
          .where(sql`${volunteerSkills.skillId} in ${skillIds}`)
          .groupBy(volunteerSkills.skillId)
      : [];

    const filledMap = new Map(vBySkill.map((r) => [r.skill_id, Number(r.filled)]));
    const names = skillIds.length ? await db.select().from(skills).where(sql`${skills.id} in ${skillIds}`) : [];
    const nameMap = new Map(names.map((s) => [s.id, s.name]));

    res.json(
      demand.map((d) => ({
        skill_id: d.skill_id,
        skill_name: nameMap.get(d.skill_id) ?? d.skill_id,
        count: Number(d.count),
        filled: filledMap.get(d.skill_id) ?? 0,
      }))
    );
  } catch (err) {
    next(err);
  }
});

