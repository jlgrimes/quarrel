import { Hono } from "hono";
import { db, servers, members, serverBots, users } from "@quarrel/db";
import { addBotSchema, updateBotSchema } from "@quarrel/shared";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { PROVIDER_TO_USERNAME } from "../lib/seedBots";
import { analytics } from "../lib/analytics";

export const botRoutes = new Hono<AuthEnv>();

botRoutes.use(authMiddleware);

// List bots for a server (any member)
botRoutes.get("/servers/:serverId/bots", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  const bots = await db
    .select({
      id: serverBots.id,
      serverId: serverBots.serverId,
      botUserId: serverBots.botUserId,
      provider: serverBots.provider,
      model: serverBots.model,
      enabled: serverBots.enabled,
      systemPrompt: serverBots.systemPrompt,
      createdAt: serverBots.createdAt,
      botUsername: users.username,
      botDisplayName: users.displayName,
      botAvatarUrl: users.avatarUrl,
    })
    .from(serverBots)
    .innerJoin(users, eq(serverBots.botUserId, users.id))
    .where(eq(serverBots.serverId, serverId));

  const result = bots.map((b) => ({
    id: b.id,
    serverId: b.serverId,
    botUserId: b.botUserId,
    provider: b.provider,
    model: b.model,
    enabled: b.enabled,
    systemPrompt: b.systemPrompt,
    hasApiKey: true,
    createdAt: b.createdAt,
    botUser: {
      id: b.botUserId,
      username: b.botUsername,
      displayName: b.botDisplayName,
      avatarUrl: b.botAvatarUrl,
    },
  }));

  return c.json({ bots: result });
});

// Add bot to server (owner only)
botRoutes.post("/servers/:serverId/bots", async (c) => {
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
    return c.json({ error: "Only the owner can add bots" }, 403);
  }

  const body = await c.req.json();
  const parsed = addBotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const botUsername = PROVIDER_TO_USERNAME[parsed.data.provider];
  if (!botUsername) {
    return c.json({ error: "Invalid provider" }, 400);
  }

  // Look up actual bot user by username
  const [botUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, botUsername))
    .limit(1);

  if (!botUser) {
    return c.json({ error: "Bot user not found. Server may need to restart to seed bot users." }, 500);
  }

  const botUserId = botUser.id;

  // Check if this bot is already added to this server
  const [existing] = await db
    .select({ id: serverBots.id })
    .from(serverBots)
    .where(
      and(
        eq(serverBots.serverId, serverId),
        eq(serverBots.botUserId, botUserId)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ error: "This bot is already added to the server" }, 409);
  }

  // Auto-create member row for bot user (idempotent)
  const [existingMember] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, botUserId), eq(members.serverId, serverId)))
    .limit(1);

  if (!existingMember) {
    await db.insert(members).values({
      userId: botUserId,
      serverId,
    });
  }

  const [bot] = await db
    .insert(serverBots)
    .values({
      serverId,
      botUserId,
      provider: parsed.data.provider,
      model: parsed.data.model,
      apiKey: parsed.data.apiKey,
      systemPrompt: parsed.data.systemPrompt,
    })
    .returning();

  analytics.capture(userId, "bot:added", {
    serverId,
    provider: parsed.data.provider,
    model: parsed.data.model,
  });

  return c.json({ bot: { ...bot, hasApiKey: true } }, 201);
});

// Update bot (owner only)
botRoutes.patch("/servers/:serverId/bots/:botId", async (c) => {
  const serverId = c.req.param("serverId");
  const botId = c.req.param("botId");
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
    return c.json({ error: "Only the owner can update bots" }, 403);
  }

  const [existingBot] = await db
    .select({ id: serverBots.id })
    .from(serverBots)
    .where(and(eq(serverBots.id, botId), eq(serverBots.serverId, serverId)))
    .limit(1);

  if (!existingBot) {
    return c.json({ error: "Bot not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = updateBotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(serverBots)
    .set(parsed.data)
    .where(eq(serverBots.id, botId))
    .returning();

  analytics.capture(userId, "bot:updated", {
    serverId,
    botId,
  });

  return c.json({ bot: updated });
});

// Remove bot (owner only)
botRoutes.delete("/servers/:serverId/bots/:botId", async (c) => {
  const serverId = c.req.param("serverId");
  const botId = c.req.param("botId");
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
    return c.json({ error: "Only the owner can remove bots" }, 403);
  }

  const [existingBot] = await db
    .select({ id: serverBots.id, botUserId: serverBots.botUserId })
    .from(serverBots)
    .where(and(eq(serverBots.id, botId), eq(serverBots.serverId, serverId)))
    .limit(1);

  if (!existingBot) {
    return c.json({ error: "Bot not found" }, 404);
  }

  // Remove bot config
  await db.delete(serverBots).where(eq(serverBots.id, botId));

  // Remove bot's member row
  await db
    .delete(members)
    .where(
      and(
        eq(members.userId, existingBot.botUserId),
        eq(members.serverId, serverId)
      )
    );

  analytics.capture(userId, "bot:removed", {
    serverId,
    botId,
  });

  return c.json({ success: true });
});
