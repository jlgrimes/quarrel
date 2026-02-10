import { Hono } from "hono";
import { db, members, servers, users } from "@quarrel/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

export const memberRoutes = new Hono<AuthEnv>();

memberRoutes.use(authMiddleware);

memberRoutes.get("/servers/:serverId/members", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  // Select only id for membership check
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  const serverMembers = await db
    .select({
      id: members.id,
      userId: members.userId,
      serverId: members.serverId,
      nickname: members.nickname,
      joinedAt: members.joinedAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(eq(members.serverId, serverId));

  const result = serverMembers.map((m) => ({
    id: m.id,
    userId: m.userId,
    serverId: m.serverId,
    nickname: m.nickname,
    joinedAt: m.joinedAt,
    user: {
      id: m.userId,
      username: m.username,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
      status: m.status,
    },
  }));

  return c.json({ members: result });
});

memberRoutes.delete("/servers/:serverId/members/:userId", async (c) => {
  const serverId = c.req.param("serverId");
  const targetUserId = c.req.param("userId");
  const userId = c.get("userId");

  // Select only ownerId - that's all we need for the permission check
  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the server owner can kick members" }, 403);
  }

  if (targetUserId === userId) {
    return c.json({ error: "Cannot kick yourself" }, 400);
  }

  await db
    .delete(members)
    .where(
      and(eq(members.userId, targetUserId), eq(members.serverId, serverId))
    );

  return c.json({ success: true });
});
