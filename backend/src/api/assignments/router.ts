import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';

import { AuthedRequest, requireAuth, requireRole } from '../../lib/authMiddleware.js';
import { ApiError } from '../../lib/errors.js';
import { writeAuditLog } from '../../lib/audit.js';
import { db } from '../../db/client.js';
import { assignments, ratings, tasks, volunteers } from '../../db/schema.js';
import { emitTaskUpdated } from '../../realtime/socket.js';
import { recomputeVolunteerWorkload } from '../../services/matching.js';

export const assignmentsRouter = Router();

const createSchema = z.object({
  task_id: z.string().uuid(),
  volunteer_id: z.string().uuid(),
  matching_score: z.number().int().min(0).max(100).optional(),
});

assignmentsRouter.post('/', requireAuth, requireRole(['admin', 'coordinator']), async (req: AuthedRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, body.task_id) });
    if (!task) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Task not found' });
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new ApiError({ status: 400, code: 'BAD_STATUS', message: 'Task cannot be assigned' });
    }

    const v = await db.query.volunteers.findFirst({ where: eq(volunteers.id, body.volunteer_id) });
    if (!v) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Volunteer not found' });
    if (v.currentWorkload >= v.maxTasksPerWeek) {
      throw new ApiError({ status: 400, code: 'AT_CAPACITY', message: 'Volunteer at capacity' });
    }

    const [a] = await db
      .insert(assignments)
      .values({
        taskId: body.task_id,
        volunteerId: body.volunteer_id,
        assignedBy: req.auth!.userId,
        status: 'assigned',
        matchingScore: body.matching_score ?? null,
      })
      .returning();

    await db.update(tasks).set({ status: 'assigned' }).where(eq(tasks.id, body.task_id));
    await recomputeVolunteerWorkload(body.volunteer_id);

    await writeAuditLog({
      actorId: req.auth!.userId,
      action: 'assignment.create',
      resourceType: 'assignment',
      resourceId: a!.id,
      changes: body,
    });
    emitTaskUpdated(task.eventId, { type: 'assignment_created', assignment_id: a!.id, task_id: task.id });

    res.json({ assignment_id: a!.id, status: a!.status });
  } catch (err) {
    next(err);
  }
});

function requireVolunteerSelf(req: AuthedRequest, volunteerId: string) {
  if (req.auth!.role !== 'volunteer') return;
  // volunteer userId maps to volunteer row
  return db.query.volunteers.findFirst({ where: eq(volunteers.userId, req.auth!.userId) }).then((self) => {
    if (!self || self.id !== volunteerId) throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Not your assignment' });
  });
}

assignmentsRouter.put('/:id/accept', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const a = await db.query.assignments.findFirst({ where: eq(assignments.id, id) });
    if (!a) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Assignment not found' });
    await requireVolunteerSelf(req, a.volunteerId);

    await db.update(assignments).set({ status: 'accepted', startedAt: new Date() }).where(eq(assignments.id, id));
    await db.update(tasks).set({ status: 'in_progress' }).where(eq(tasks.id, a.taskId));
    await recomputeVolunteerWorkload(a.volunteerId);

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, a.taskId) });
    if (task) emitTaskUpdated(task.eventId, { type: 'assignment_accepted', assignment_id: id, task_id: a.taskId });

    await writeAuditLog({ actorId: req.auth!.userId, action: 'assignment.accept', resourceType: 'assignment', resourceId: id });
    res.json({ assignment_id: id, status: 'accepted' });
  } catch (err) {
    next(err);
  }
});

assignmentsRouter.put('/:id/decline', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const a = await db.query.assignments.findFirst({ where: eq(assignments.id, id) });
    if (!a) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Assignment not found' });
    await requireVolunteerSelf(req, a.volunteerId);

    await db.update(assignments).set({ status: 'declined' }).where(eq(assignments.id, id));
    await recomputeVolunteerWorkload(a.volunteerId);

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, a.taskId) });
    if (task) {
      await db.update(tasks).set({ status: 'open' }).where(eq(tasks.id, a.taskId));
      emitTaskUpdated(task.eventId, { type: 'assignment_declined', assignment_id: id, task_id: a.taskId });
    }

    await writeAuditLog({ actorId: req.auth!.userId, action: 'assignment.decline', resourceType: 'assignment', resourceId: id });
    res.json({ assignment_id: id, status: 'declined' });
  } catch (err) {
    next(err);
  }
});

const completeSchema = z.object({
  notes: z.string().optional(),
});

assignmentsRouter.put('/:id/complete', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = completeSchema.parse(req.body ?? {});
    const a = await db.query.assignments.findFirst({ where: eq(assignments.id, id) });
    if (!a) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Assignment not found' });
    await requireVolunteerSelf(req, a.volunteerId);

    await db
      .update(assignments)
      .set({ status: 'completed', completedAt: new Date(), completionNotes: body.notes ?? null })
      .where(eq(assignments.id, id));
    await db.update(tasks).set({ status: 'completed' }).where(eq(tasks.id, a.taskId));
    await recomputeVolunteerWorkload(a.volunteerId);

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, a.taskId) });
    if (task) emitTaskUpdated(task.eventId, { type: 'assignment_completed', assignment_id: id, task_id: a.taskId });

    await writeAuditLog({
      actorId: req.auth!.userId,
      action: 'assignment.complete',
      resourceType: 'assignment',
      resourceId: id,
      changes: body,
    });
    res.json({ status: 'completed', rating_prompt: true });
  } catch (err) {
    next(err);
  }
});

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

assignmentsRouter.post('/:id/rate', requireAuth, requireRole(['admin', 'coordinator']), async (req: AuthedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = rateSchema.parse(req.body);
    const a = await db.query.assignments.findFirst({ where: eq(assignments.id, id) });
    if (!a) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Assignment not found' });

    await db.insert(ratings).values({
      assignmentId: id,
      volunteerId: a.volunteerId,
      rating: body.rating,
      comment: body.comment ?? null,
      createdBy: req.auth!.userId,
    });

    await writeAuditLog({
      actorId: req.auth!.userId,
      action: 'assignment.rate',
      resourceType: 'assignment',
      resourceId: id,
      changes: body,
    });

    res.json({ rating_recorded: true });
  } catch (err) {
    next(err);
  }
});

assignmentsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const volunteerId = req.query.volunteer_id ? String(req.query.volunteer_id) : undefined;

    const areq = req as AuthedRequest;
    if (areq.auth!.role === 'volunteer') {
      const self = await db.query.volunteers.findFirst({ where: eq(volunteers.userId, areq.auth!.userId) });
      if (!self) throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Not a volunteer' });
      const where = status
        ? and(eq(assignments.volunteerId, self.id), eq(assignments.status, status as any))
        : eq(assignments.volunteerId, self.id);
      const list = await db.select().from(assignments).where(where).limit(100);
      return res.json(list);
    }

    const wheres: any[] = [];
    if (status) wheres.push(eq(assignments.status, status as any));
    if (volunteerId) wheres.push(eq(assignments.volunteerId, volunteerId));
    const list = wheres.length ? await db.select().from(assignments).where(and(...wheres)).limit(200) : await db.select().from(assignments).limit(200);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

