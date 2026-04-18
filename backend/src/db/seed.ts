import 'dotenv/config';

import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { db, pool } from './client.js';
import { assignments, availabilitySlots, events, skills, taskSkills, tasks, users, volunteerSkills, volunteers } from './schema.js';
import { logger } from '../lib/logger.js';
import { hashPassword } from '../lib/crypto.js';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]) {
  return arr[randInt(0, arr.length - 1)]!;
}

async function main() {
  // Idempotent seed: wipe data first (prototype convenience)
  await db.execute(sql`TRUNCATE TABLE
    "audit_logs",
    "ratings",
    "assignments",
    "task_skills",
    "tasks",
    "availability_slots",
    "volunteer_skills",
    "skills",
    "volunteers",
    "events",
    "users"
    RESTART IDENTITY CASCADE`);

  // Minimal seed: 1 admin, 1 coordinator, 10 volunteers, 2 events, some tasks + skills
  const adminId = randomUUID();
  const coordinatorId = randomUUID();
  const pw = await hashPassword('Password123!');

  await db.insert(users).values([
    {
      id: adminId,
      email: 'admin@sevak.local',
      passwordHash: pw,
      role: 'admin',
      phone: '0000000000',
    },
    {
      id: coordinatorId,
      email: 'coordinator@sevak.local',
      passwordHash: pw,
      role: 'coordinator',
      phone: '0000000001',
    },
  ]);

  const [event1] = await db
    .insert(events)
    .values({
      id: randomUUID(),
      name: 'Flood Relief - Zone A',
      type: 'flood',
      status: 'active',
      locationName: 'Zone A',
    })
    .returning();

  const [event2] = await db
    .insert(events)
    .values({
      id: randomUUID(),
      name: 'Community Teaching Program',
      type: 'community_service',
      status: 'active',
      locationName: 'City Center',
    })
    .returning();

  const skillRows = [
    { id: randomUUID(), name: 'CPR', category: 'medical', description: 'Basic CPR' },
    { id: randomUUID(), name: 'Nursing', category: 'medical', description: 'Nursing support' },
    { id: randomUUID(), name: 'Logistics', category: 'logistics', description: 'Supply distribution and routing' },
    { id: randomUUID(), name: 'Search & Rescue', category: 'search-rescue', description: 'Field operations' },
    { id: randomUUID(), name: 'Teaching', category: 'teaching', description: 'Tutoring and teaching' },
  ];
  await db.insert(skills).values(skillRows);

  const volunteerIds: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const userId = randomUUID();
    const volunteerId = randomUUID();
    volunteerIds.push(volunteerId);
    await db.insert(users).values({
      id: userId,
      email: `volunteer${i}@sevak.local`,
      passwordHash: pw,
      role: 'volunteer',
      phone: `00000000${10 + i}`,
    });
    await db.insert(volunteers).values({
      id: volunteerId,
      userId,
      firstName: `Volunteer${i}`,
      lastName: 'User',
      phone: `00000000${10 + i}`,
      locationLat: (12.90 + Math.random() * 0.2).toFixed(6),
      locationLng: (77.50 + Math.random() * 0.2).toFixed(6),
      maxTasksPerWeek: 5,
      currentWorkload: 0,
      verificationStatus: 'unverified',
    });

    // weekly availability
    await db.insert(availabilitySlots).values([
      { id: randomUUID(), volunteerId, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
      { id: randomUUID(), volunteerId, dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
      { id: randomUUID(), volunteerId, dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
    ]);

    const s1 = pick(skillRows);
    const s2 = pick(skillRows);
    await db.insert(volunteerSkills).values([
      {
        id: randomUUID(),
        volunteerId,
        skillId: s1.id,
        proficiencyLevel: randInt(2, 5),
        certified: Math.random() > 0.6,
      },
      {
        id: randomUUID(),
        volunteerId,
        skillId: s2.id,
        proficiencyLevel: randInt(2, 5),
        certified: Math.random() > 0.6,
      },
    ]);
  }

  const task1Id = randomUUID();
  const task2Id = randomUUID();
  const task3Id = randomUUID();
  await db.insert(tasks).values([
    {
      id: task1Id,
      eventId: event1!.id,
      title: 'Medical screening at shelter',
      description: 'Basic health check and triage at shelter',
      locationLat: '12.971600',
      locationLng: '77.594600',
      priority: 5,
      status: 'open',
      createdBy: coordinatorId,
    },
    {
      id: task2Id,
      eventId: event1!.id,
      title: 'Supply distribution route planning',
      description: 'Coordinate supply deliveries to affected areas',
      locationLat: '12.961600',
      locationLng: '77.584600',
      priority: 4,
      status: 'open',
      createdBy: coordinatorId,
    },
    {
      id: task3Id,
      eventId: event2!.id,
      title: 'Tutor math for grade 8',
      description: 'Teach math basics to grade 8 students',
      locationLat: '12.991600',
      locationLng: '77.604600',
      priority: 3,
      status: 'open',
      createdBy: coordinatorId,
    },
  ]);

  const skillByName = Object.fromEntries(skillRows.map((s) => [s.name, s]));
  await db.insert(taskSkills).values([
    { id: randomUUID(), taskId: task1Id, skillId: skillByName['Nursing']!.id, requiredLevel: 3 },
    { id: randomUUID(), taskId: task1Id, skillId: skillByName['CPR']!.id, requiredLevel: 2 },
    { id: randomUUID(), taskId: task2Id, skillId: skillByName['Logistics']!.id, requiredLevel: 3 },
    { id: randomUUID(), taskId: task3Id, skillId: skillByName['Teaching']!.id, requiredLevel: 3 },
  ]);

  // One demo assignment
  await db.insert(assignments).values({
    id: randomUUID(),
    taskId: task2Id,
    volunteerId: pick(volunteerIds),
    status: 'assigned',
    assignedBy: coordinatorId,
    matchingScore: 80,
  });

  logger.info('seeded');
  await pool.end();
}

main().catch(async (err) => {
  logger.error({ err }, 'seed failed');
  await pool.end();
  process.exit(1);
});

