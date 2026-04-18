import { db } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export async function writeAuditLog(input: {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  changes?: unknown;
}) {
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    changes: (input.changes ?? {}) as any,
  });
}

