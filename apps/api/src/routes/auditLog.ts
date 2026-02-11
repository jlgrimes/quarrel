import { Hono } from "hono";
import { db, servers, members, roles, memberRoles, users } from "@quarrel/db";
import { auditLog } from "@quarrel/db/schema/auditLog";
import { eq, and, lt, desc } from "drizzle-orm";
import { PERMISSIONS } from "@quarrel/shared";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

async function hasPermission(userId: string, serverId: string, permission: number): Promise<boolean> {
  const [server] = await db.select({ ownerId: servers.ownerId }).from(servers).where(eq(servers.id, serverId)).limit(1);
  if (server?.ownerId === userId) return true;

  const [member] = await db.select({ id: members.id }).from(members).where(and(eq(members.userId, userId), eq(members.serverId, serverId))).limit(1);
  if (!member) return false;

  const memberRolesList = await db.select({ permissions: roles.permissions }).from(memberRoles).innerJoin(roles, eq(memberRoles.roleId, roles.id)).where(eq(memberRoles.memberId, member.id));
  const combined = memberRolesList.reduce((acc, r) => acc | r.permissions, 0);
  return (combined & PERMISSIONS.ADMINISTRATOR) !== 0 || (combined & permission) !== 0;
}

export const auditLogRoutes = new Hono<AuthEnv>();

auditLogRoutes.use(authMiddleware);

auditLogRoutes.get("/servers/:serverId/audit-log", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  const [server] = await db.select({ id: servers.id }).from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const allowed = await hasPermission(userId, serverId, PERMISSIONS.MANAGE_SERVER);
  if (!allowed) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const cursor = c.req.query("cursor");
  const action = c.req.query("action");
  const limitParam = c.req.query("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 50);

  const conditions = [eq(auditLog.serverId, serverId)];
  if (cursor) {
    conditions.push(lt(auditLog.createdAt, new Date(cursor)));
  }
  if (action) {
    conditions.push(eq(auditLog.action, action));
  }

  const entries = await db
    .select({
      id: auditLog.id,
      serverId: auditLog.serverId,
      actorId: auditLog.actorId,
      action: auditLog.action,
      targetId: auditLog.targetId,
      targetType: auditLog.targetType,
      reason: auditLog.reason,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
    })
    .from(auditLog)
    .innerJoin(users, eq(auditLog.actorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return c.json({ entries });
});
