import { Router } from 'express';
import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

import { AuthedRequest, requireAuth, requireRole } from '../../lib/authMiddleware.js';
import { ApiError } from '../../lib/errors.js';
import { writeAuditLog } from '../../lib/audit.js';
import { db } from '../../db/client.js';
import { events, skills, taskSkills, tasks } from '../../db/schema.js';
import { emitTaskUpdated } from '../../realtime/socket.js';
import { matchTask } from '../../services/matching.js';

export const tasksRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const createSchema = z.object({
  event_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  required_skills: z
    .array(
      z.object({
        skill_id: z.string().uuid(),
        required_level: z.number().int().min(1).max(5).default(3),
      })
    )
    .optional(),
  priority: z.number().int().min(1).max(5).default(3),
  due_at: z.string().datetime().optional(),
});

tasksRouter.post('/', requireAuth, requireRole(['admin', 'coordinator']), async (req: AuthedRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const ev = await db.query.events.findFirst({ where: eq(events.id, body.event_id) });
    if (!ev) throw new ApiError({ status: 400, code: 'BAD_EVENT', message: 'Event not found' });

    const [task] = await db
      .insert(tasks)
      .values({
        eventId: body.event_id,
        title: body.title,
        description: body.description,
        locationLat: body.location ? String(body.location.lat) : null,
        locationLng: body.location ? String(body.location.lng) : null,
        priority: body.priority,
        status: 'open',
        createdBy: req.auth!.userId,
        dueAt: body.due_at ? new Date(body.due_at) : null,
      })
      .returning();

    if (body.required_skills?.length) {
      const skillIds = body.required_skills.map((s) => s.skill_id);
      const existingSkills = await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, skillIds));
      if (existingSkills.length !== skillIds.length) {
        throw new ApiError({ status: 400, code: 'BAD_SKILL', message: 'One or more skill_ids are invalid' });
      }
      await db.insert(taskSkills).values(
        body.required_skills.map((s) => ({
          taskId: task!.id,
          skillId: s.skill_id,
          requiredLevel: s.required_level,
        }))
      );
    }

    await writeAuditLog({
      actorId: req.auth!.userId,
      action: 'task.create',
      resourceType: 'task',
      resourceId: task!.id,
      changes: body,
    });
    emitTaskUpdated(body.event_id, { task_id: task!.id, type: 'created' });

    res.json({ task_id: task!.id, status: task!.status });
  } catch (err) {
    next(err);
  }
});

tasksRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
    if (!task) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  status: z.enum(['open', 'assigned', 'in_progress', 'completed', 'cancelled']).optional(),
  description: z.string().optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

tasksRouter.put('/:id', requireAuth, requireRole(['admin', 'coordinator']), async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
    if (!task) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Task not found' });

    const patch: any = {};
    if (body.status) patch.status = body.status;
    if (body.description !== undefined) patch.description = body.description;
    if (body.location) {
      patch.locationLat = String(body.location.lat);
      patch.locationLng = String(body.location.lng);
    }

    await db.update(tasks).set(patch).where(eq(tasks.id, id));
    await writeAuditLog({ actorId: req.auth!.userId, action: 'task.update', resourceType: 'task', resourceId: id, changes: body });
    emitTaskUpdated(task.eventId, { task_id: id, type: 'updated' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

tasksRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const eventId = req.query.event_id ? String(req.query.event_id) : undefined;
    const priority = req.query.priority ? Number(req.query.priority) : undefined;

    const wheres: any[] = [];
    if (status) wheres.push(eq(tasks.status, status as any));
    if (eventId) wheres.push(eq(tasks.eventId, eventId));
    if (priority) wheres.push(eq(tasks.priority, priority));

    const list =
      wheres.length === 0 ? await db.select().from(tasks).limit(200) : await db.select().from(tasks).where(and(...wheres)).limit(200);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/:id/match', requireAuth, requireRole(['admin', 'coordinator']), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const limit = req.body?.limit ? Number(req.body.limit) : 3;
    const matches = await matchTask(id, limit);
    res.json(matches);
  } catch (err) {
    next(err);
  }
});

// CSV Bulk upload
// Expected columns: title,description,lat,lng,priority,due_at,skill_ids (comma-separated)
tasksRouter.post('/bulk', requireAuth, requireRole(['admin', 'coordinator']), upload.single('file'), async (req: AuthedRequest, res, next) => {
  try {
    const eventId = String(req.body.event_id ?? '');
    if (!eventId) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'event_id is required' });
    const ev = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!ev) throw new ApiError({ status: 400, code: 'BAD_EVENT', message: 'Event not found' });
    if (!req.file) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'file is required' });

    const csvText = req.file.buffer.toString('utf-8');
    const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;

    let created = 0;
    let failed = 0;
    for (const r of records) {
      try {
        const title = r.title?.trim();
        if (!title) throw new Error('missing title');
        const lat = r.lat ? Number(r.lat) : undefined;
        const lng = r.lng ? Number(r.lng) : undefined;
        const priority = r.priority ? Number(r.priority) : 3;
        const dueAt = r.due_at ? new Date(r.due_at) : null;
        const [task] = await db
          .insert(tasks)
          .values({
            eventId,
            title,
            description: r.description ?? null,
            locationLat: lat !== undefined ? String(lat) : null,
            locationLng: lng !== undefined ? String(lng) : null,
            priority,
            status: 'open',
            createdBy: req.auth!.userId,
            dueAt,
          })
          .returning();

        const skillIds = r.skill_ids
          ? r.skill_ids
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        if (skillIds.length) {
          const existing = await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, skillIds));
          const okIds = new Set(existing.map((e) => e.id));
          const rows = skillIds.filter((x) => okIds.has(x)).map((skillId) => ({ taskId: task!.id, skillId, requiredLevel: 3 }));
          if (rows.length) await db.insert(taskSkills).values(rows);
        }

        created++;
      } catch {
        failed++;
      }
    }

    await writeAuditLog({
      actorId: req.auth!.userId,
      action: 'task.bulk_upload',
      resourceType: 'event',
      resourceId: eventId,
      changes: { created, failed },
    });
    emitTaskUpdated(eventId, { type: 'bulk_uploaded', created, failed });

    res.json({ created, failed });
  } catch (err) {
    next(err);
  }
});

