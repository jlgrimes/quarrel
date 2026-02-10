import { Hono } from "hono";
import { db, bans, members, servers, users } from "@quarrel/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

export const banRoutes = new Hono<AuthEnv>();

banRoutes.use(authMiddleware);

// Ban a user from a server
banRoutes.post("/servers/:serverId/bans/:userId", async (c) => {
  const serverId = c.req.param("serverId");
  const targetUserId = c.req.param("userId");
  const userId = c.get("userId");

  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the server owner can ban members" }, 403);
  }

  if (targetUserId === userId) {
    return c.json({ error: "Cannot ban yourself" }, 400);
  }

  // Check if already banned
  const [existingBan] = await db
    .select({ id: bans.id })
    .from(bans)
    .where(and(eq(bans.userId, targetUserId), eq(bans.serverId, serverId)))
    .limit(1);

  if (existingBan) {
    return c.json({ error: "User is already banned" }, 409);
  }

  // Parse optional reason from body
  let reason: string | null = null;
  try {
    const body = await c.req.json();
    if (body.reason && typeof body.reason === "string") {
      reason = body.reason;
    }
  } catch {
    // No body or invalid JSON is fine — reason is optional
  }

  // Remove the user from the server if they are a member
  await db
    .delete(members)
    .where(
      and(eq(members.userId, targetUserId), eq(members.serverId, serverId))
    );

  // Create the ban record
  const [ban] = await db
    .insert(bans)
    .values({
      serverId,
      userId: targetUserId,
      reason,
      bannedBy: userId,
    })
    .returning();

  return c.json({ ban }, 201);
});

// Unban a user from a server
banRoutes.delete("/servers/:serverId/bans/:userId", async (c) => {
  const serverId = c.req.param("serverId");
  const targetUserId = c.req.param("userId");
  const userId = c.get("userId");

  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the server owner can unban members" }, 403);
  }

  const [existingBan] = await db
    .select({ id: bans.id })
    .from(bans)
    .where(and(eq(bans.userId, targetUserId), eq(bans.serverId, serverId)))
    .limit(1);

  if (!existingBan) {
    return c.json({ error: "User is not banned" }, 404);
  }

  await db
    .delete(bans)
    .where(and(eq(bans.userId, targetUserId), eq(bans.serverId, serverId)));

  return c.json({ success: true });
});

// List banned users for a server
banRoutes.get("/servers/:serverId/bans", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the server owner can view bans" }, 403);
  }

  const serverBans = await db
    .select({
      id: bans.id,
      userId: bans.userId,
      reason: bans.reason,
      bannedBy: bans.bannedBy,
      bannedAt: bans.bannedAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(bans)
    .innerJoin(users, eq(bans.userId, users.id))
    .where(eq(bans.serverId, serverId));

  return c.json({ bans: serverBans });
});
