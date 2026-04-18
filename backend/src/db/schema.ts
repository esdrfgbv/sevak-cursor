import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['admin', 'coordinator', 'volunteer']);
export const taskStatus = pgEnum('task_status', ['open', 'assigned', 'in_progress', 'completed', 'cancelled']);
export const assignmentStatus = pgEnum('assignment_status', [
  'assigned',
  'accepted',
  'declined',
  'completed',
  'failed',
]);
export const eventStatus = pgEnum('event_status', ['active', 'closed']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  phone: text('phone'),
  role: userRole('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  status: eventStatus('status').notNull().default('active'),
  locationName: text('location'),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const volunteers = pgTable('volunteers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  locationLat: text('location_lat'), // keep as text for prototype simplicity
  locationLng: text('location_lng'),
  maxTasksPerWeek: integer('max_tasks_per_week').notNull().default(5),
  currentWorkload: integer('current_workload').notNull().default(0),
  verificationStatus: text('verification_status').notNull().default('unverified'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  category: text('category').notNull(),
});

export const volunteerSkills = pgTable('volunteer_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  volunteerId: uuid('volunteer_id')
    .notNull()
    .references(() => volunteers.id, { onDelete: 'cascade' }),
  skillId: uuid('skill_id')
    .notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
  proficiencyLevel: integer('proficiency_level').notNull().default(3),
  certified: boolean('certified').notNull().default(false),
  verifiedBy: uuid('verified_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  locationLat: text('location_lat'),
  locationLng: text('location_lng'),
  priority: integer('priority').notNull().default(3),
  status: taskStatus('status').notNull().default('open'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }),
});

export const taskSkills = pgTable('task_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  skillId: uuid('skill_id')
    .notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
  requiredLevel: integer('required_level').notNull().default(3),
});

export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  volunteerId: uuid('volunteer_id')
    .notNull()
    .references(() => volunteers.id, { onDelete: 'cascade' }),
  status: assignmentStatus('status').notNull().default('assigned'),
  matchingScore: integer('matching_score'),
  assignedBy: uuid('assigned_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completionNotes: text('completion_notes'),
});

export const ratings = pgTable('ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => assignments.id, { onDelete: 'cascade' }),
  volunteerId: uuid('volunteer_id')
    .notNull()
    .references(() => volunteers.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const availabilitySlots = pgTable('availability_slots', {
  id: uuid('id').defaultRandom().primaryKey(),
  volunteerId: uuid('volunteer_id')
    .notNull()
    .references(() => volunteers.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0-6
  startTime: text('start_time').notNull(), // "HH:MM"
  endTime: text('end_time').notNull(), // "HH:MM"
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  changes: jsonb('changes').notNull().default({}),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one }) => ({
  volunteer: one(volunteers, { fields: [users.id], references: [volunteers.userId] }),
}));

