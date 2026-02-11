import { Hono } from "hono";
import { db, servers, members, roles, memberRoles, timeouts, users } from "@quarrel/db";
import { eq, and, gt } from "drizzle-orm";
import { PERMISSIONS, timeoutMemberSchema } from "@quarrel/shared";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

async function hasPermission(userId: string, serverId: string, permission: number): Promise<boolean> {
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  if (server?.ownerId === userId) return true;

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);
  if (!member) return false;

  const memberRolesList = await db
    .select({ permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(eq(memberRoles.memberId, member.id));

  const combined = memberRolesList.reduce((acc, r) => acc | r.permissions, 0);
  return (combined & PERMISSIONS.ADMINISTRATOR) !== 0 || (combined & permission) !== 0;
}

export const timeoutRoutes = new Hono<AuthEnv>();

timeoutRoutes.use(authMiddleware);

// Timeout a member
timeoutRoutes.post("/servers/:serverId/timeouts/:userId", async (c) => {
  const serverId = c.req.param("serverId");
  const targetUserId = c.req.param("userId");
  const userId = c.get("userId");

  // Check server exists
  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  // Cannot timeout the server owner
  if (targetUserId === server.ownerId) {
    return c.json({ error: "Cannot timeout the server owner" }, 400);
  }

  // Check permission
  const allowed = await hasPermission(userId, serverId, PERMISSIONS.KICK_MEMBERS);
  if (!allowed) {
    return c.json({ error: "Missing permissions" }, 403);
  }

  const body = await c.req.json();
  const parsed = timeoutMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const expiresAt = new Date(Date.now() + parsed.data.duration * 1000);

  const [timeout] = await db
    .insert(timeouts)
    .values({
      serverId,
      userId: targetUserId,
      timedOutBy: userId,
      reason: parsed.data.reason ?? null,
      expiresAt,
    })
    .returning();

  return c.json({ timeout }, 201);
});

// Remove timeout early
timeoutRoutes.delete("/servers/:serverId/timeouts/:userId", async (c) => {
  const serverId = c.req.param("serverId");
  const targetUserId = c.req.param("userId");
  const userId = c.get("userId");

  const allowed = await hasPermission(userId, serverId, PERMISSIONS.KICK_MEMBERS);
  if (!allowed) {
    return c.json({ error: "Missing permissions" }, 403);
  }

  const deleted = await db
    .delete(timeouts)
    .where(
      and(
        eq(timeouts.serverId, serverId),
        eq(timeouts.userId, targetUserId),
        gt(timeouts.expiresAt, new Date())
      )
    )
    .returning();

  if (deleted.length === 0) {
    return c.json({ error: "No active timeout found" }, 404);
  }

  return c.json({ success: true });
});

// List active timeouts
timeoutRoutes.get("/servers/:serverId/timeouts", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  const allowed = await hasPermission(userId, serverId, PERMISSIONS.KICK_MEMBERS);
  if (!allowed) {
    return c.json({ error: "Missing permissions" }, 403);
  }

  const activeTimeouts = await db
    .select({
      id: timeouts.id,
      serverId: timeouts.serverId,
      userId: timeouts.userId,
      timedOutBy: timeouts.timedOutBy,
      reason: timeouts.reason,
      expiresAt: timeouts.expiresAt,
      createdAt: timeouts.createdAt,
      username: users.username,
      displayName: users.displayName,
    })
    .from(timeouts)
    .innerJoin(users, eq(timeouts.userId, users.id))
    .where(
      and(
        eq(timeouts.serverId, serverId),
        gt(timeouts.expiresAt, new Date())
      )
    );

  return c.json({ timeouts: activeTimeouts });
});
