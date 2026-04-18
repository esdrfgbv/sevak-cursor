import { Router } from 'express';
import { z } from 'zod';
import { and, eq, inArray, like, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { assignments, availabilitySlots, skills, volunteerSkills, volunteers } from '../../db/schema.js';
import { ApiError } from '../../lib/errors.js';
import { AuthedRequest, requireAuth, requireRole } from '../../lib/authMiddleware.js';
import { writeAuditLog } from '../../lib/audit.js';
import { emitVolunteerStatus } from '../../realtime/socket.js';

export const volunteersRouter = Router();

volunteersRouter.get('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const v = await db.query.volunteers.findFirst({ where: eq(volunteers.id, id) });
    if (!v) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Volunteer not found' });

    const vskills = await db
      .select({ id: skills.id, name: skills.name, category: skills.category, proficiency_level: volunteerSkills.proficiencyLevel })
      .from(volunteerSkills)
      .innerJoin(skills, eq(volunteerSkills.skillId, skills.id))
      .where(eq(volunteerSkills.volunteerId, id));

    const slots = await db.select().from(availabilitySlots).where(eq(availabilitySlots.volunteerId, id));

    res.json({
      id: v.id,
      name: `${v.firstName} ${v.lastName}`,
      phone: v.phone,
      location: v.locationLat && v.locationLng ? { lat: Number(v.locationLat), lng: Number(v.locationLng) } : null,
      rating: null,
      workload: v.currentWorkload,
      max_tasks_per_week: v.maxTasksPerWeek,
      skills: vskills,
      availability: slots,
    });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  max_tasks_per_week: z.number().int().min(1).max(50).optional(),
  availability: z
    .array(
      z.object({
        day_of_week: z.number().int().min(0).max(6),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        end_time: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .optional(),
});

volunteersRouter.put('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);

    // volunteer can only update themselves; coordinators/admin can update anyone
    if (req.auth!.role === 'volunteer') {
      const self = await db.query.volunteers.findFirst({ where: eq(volunteers.userId, req.auth!.userId) });
      if (!self || self.id !== id) throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Not your profile' });
    }

    const patch: Record<string, any> = {};
    if (body.first_name) patch.firstName = body.first_name;
    if (body.last_name) patch.lastName = body.last_name;
    if (body.max_tasks_per_week) patch.maxTasksPerWeek = body.max_tasks_per_week;
    if (body.location) {
      patch.locationLat = String(body.location.lat);
      patch.locationLng = String(body.location.lng);
    }

    const [updated] = await db.update(volunteers).set(patch).where(eq(volunteers.id, id)).returning();
    if (!updated) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Volunteer not found' });

    if (body.availability) {
      await db.delete(availabilitySlots).where(eq(availabilitySlots.volunteerId, id));
      if (body.availability.length) {
        await db.insert(availabilitySlots).values(
          body.availability.map((s) => ({
            volunteerId: id,
            dayOfWeek: s.day_of_week,
            startTime: s.start_time,
            endTime: s.end_time,
          }))
        );
      }
    }

    await writeAuditLog({
      actorId: req.auth!.userId,
      action: 'volunteer.update',
      resourceType: 'volunteer',
      resourceId: id,
      changes: body,
    });

    emitVolunteerStatus('global', { volunteer_id: id, type: 'updated' });

    res.json({ id: updated.id });
  } catch (err) {
    next(err);
  }
});

const addSkillSchema = z.object({
  skill_id: z.string().uuid(),
  proficiency_level: z.number().int().min(1).max(5),
  certified: z.boolean().optional(),
});

volunteersRouter.post('/:id/skills', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = addSkillSchema.parse(req.body);

    if (req.auth!.role === 'volunteer') {
      const self = await db.query.volunteers.findFirst({ where: eq(volunteers.userId, req.auth!.userId) });
      if (!self || self.id !== id) throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Not your profile' });
    }

    const existsSkill = await db.query.skills.findFirst({ where: eq(skills.id, body.skill_id) });
    if (!existsSkill) throw new ApiError({ status: 400, code: 'BAD_SKILL', message: 'Skill does not exist' });

    const [row] = await db
      .insert(volunteerSkills)
      .values({
        volunteerId: id,
        skillId: body.skill_id,
        proficiencyLevel: body.proficiency_level,
        certified: body.certified ?? false,
      })
      .returning();

    await writeAuditLog({
      actorId: req.auth!.userId,
      action: 'volunteer.skill.add',
      resourceType: 'volunteer',
      resourceId: id,
      changes: body,
    });

    res.json({ skill: row });
  } catch (err) {
    next(err);
  }
});

volunteersRouter.get('/:id/assignments', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    if (req.auth!.role === 'volunteer') {
      const self = await db.query.volunteers.findFirst({ where: eq(volunteers.userId, req.auth!.userId) });
      if (!self || self.id !== id) throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Not your assignments' });
    }

    const where = status
      ? and(eq(assignments.volunteerId, id), eq(assignments.status, status as any))
      : eq(assignments.volunteerId, id);

    const a = await db.select().from(assignments).where(where).limit(limit);
    res.json(a);
  } catch (err) {
    next(err);
  }
});

volunteersRouter.get('/search', requireAuth, requireRole(['admin', 'coordinator']), async (req, res, next) => {
  try {
    const skill = req.query.skill ? String(req.query.skill) : undefined;
    const radiusKm = req.query.radius_km ? Number(req.query.radius_km) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;

    // Simplified search: filter by name/email text and optional skill name.
    let idsBySkill: string[] | undefined;
    if (skill) {
      const s = await db.query.skills.findFirst({ where: like(skills.name, `%${skill}%`) });
      if (s) {
        const vs = await db.select({ volunteerId: volunteerSkills.volunteerId }).from(volunteerSkills).where(eq(volunteerSkills.skillId, s.id));
        idsBySkill = vs.map((r) => r.volunteerId);
      } else {
        idsBySkill = [];
      }
    }

    const whereParts: any[] = [];
    if (q) {
      whereParts.push(orLikeName(q));
    }
    if (idsBySkill) {
      whereParts.push(inArray(volunteers.id, idsBySkill.length ? idsBySkill : ['00000000-0000-0000-0000-000000000000']));
    }

    const list =
      whereParts.length === 0
        ? await db.select().from(volunteers).limit(50)
        : await db
            .select()
            .from(volunteers)
            .where(and(...whereParts))
            .limit(50);

    // radiusKm not implemented in prototype without PostGIS; return as-is
    res.json(list);
  } catch (err) {
    next(err);
  }
});

function orLikeName(q: string) {
  return sql`${volunteers.firstName} ILIKE ${`%${q}%`} OR ${volunteers.lastName} ILIKE ${`%${q}%`}`;
}

