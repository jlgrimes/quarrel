import { db } from "@quarrel/db";
import { auditLog } from "@quarrel/db/schema/auditLog";

type AuditLogParams = {
  serverId: string;
  actorId: string;
  action: string;
  targetId?: string;
  targetType?: "user" | "channel" | "role" | "invite";
  reason?: string;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(params: AuditLogParams) {
  await db.insert(auditLog).values({
    serverId: params.serverId,
    actorId: params.actorId,
    action: params.action,
    targetId: params.targetId ?? null,
    targetType: params.targetType ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
  });
}
