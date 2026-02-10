import { Hono } from "hono";
import { db, channels, members, servers, messages, readState } from "@quarrel/db";
import { createChannelSchema, updateChannelSchema } from "@quarrel/shared";
import { eq, and, gt, sql, desc } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

export const channelRoutes = new Hono<AuthEnv>();

channelRoutes.use(authMiddleware);

channelRoutes.post("/servers/:serverId/channels", async (c) => {
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

  const body = await c.req.json();
  const parsed = createChannelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [channel] = await db
    .insert(channels)
    .values({
      serverId,
      name: parsed.data.name,
      type: parsed.data.type,
      categoryId: parsed.data.categoryId,
    })
    .returning();

  return c.json({ channel }, 201);
});

channelRoutes.get("/servers/:serverId/channels", async (c) => {
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

  const serverChannels = await db
    .select({
      id: channels.id,
      serverId: channels.serverId,
      name: channels.name,
      type: channels.type,
      topic: channels.topic,
      categoryId: channels.categoryId,
      position: channels.position,
      createdAt: channels.createdAt,
    })
    .from(channels)
    .where(eq(channels.serverId, serverId))
    .orderBy(channels.position);

  // Get read state for all channels in this server
  const userReadStates = await db
    .select()
    .from(readState)
    .where(eq(readState.userId, userId));

  const readMap = new Map(
    userReadStates
      .filter((rs) => rs.channelId)
      .map((rs) => [rs.channelId, rs])
  );

  // Count unread messages per channel
  const channelsWithUnread = await Promise.all(
    serverChannels.map(async (ch) => {
      const rs = readMap.get(ch.id);
      let unreadCount = 0;

      if (rs?.lastReadAt) {
        const [result] = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.channelId, ch.id),
              gt(messages.createdAt, rs.lastReadAt)
            )
          );
        unreadCount = result?.count ?? 0;
      }

      return {
        ...ch,
        unreadCount,
        lastReadMessageId: rs?.lastReadMessageId ?? null,
      };
    })
  );

  return c.json({ channels: channelsWithUnread });
});

// Select only serverId for the channel lookup (needed for member check)
channelRoutes.patch("/channels/:id", async (c) => {
  const channelId = c.req.param("id");
  const userId = c.get("userId");

  const [channel] = await db
    .select({ id: channels.id, serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    return c.json({ error: "Channel not found" }, 404);
  }

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(eq(members.userId, userId), eq(members.serverId, channel.serverId))
    )
    .limit(1);

  if (!member) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  const body = await c.req.json();
  const parsed = updateChannelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(channels)
    .set(parsed.data)
    .where(eq(channels.id, channelId))
    .returning();

  return c.json({ channel: updated });
});

// Single JOIN: fetch channel + server owner check in one query
channelRoutes.delete("/channels/:id", async (c) => {
  const channelId = c.req.param("id");
  const userId = c.get("userId");

  const [result] = await db
    .select({
      channelId: channels.id,
      ownerId: servers.ownerId,
    })
    .from(channels)
    .innerJoin(servers, eq(channels.serverId, servers.id))
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!result) {
    return c.json({ error: "Channel not found" }, 404);
  }

  if (result.ownerId !== userId) {
    return c.json({ error: "Only the server owner can delete channels" }, 403);
  }

  await db.delete(channels).where(eq(channels.id, channelId));
  return c.json({ success: true });
});

// Mark channel as read
channelRoutes.post("/channels/:id/ack", async (c) => {
  const channelId = c.req.param("id");
  const userId = c.get("userId");

  // Verify channel exists and user is a member of the server
  const [channel] = await db
    .select({ id: channels.id, serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    return c.json({ error: "Channel not found" }, 404);
  }

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(eq(members.userId, userId), eq(members.serverId, channel.serverId))
    )
    .limit(1);

  if (!member) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  // Get latest message in channel
  const [latestMessage] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  const now = new Date();

  // Upsert read state
  const existing = await db
    .select()
    .from(readState)
    .where(
      and(eq(readState.userId, userId), eq(readState.channelId, channelId))
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(readState)
      .set({
        lastReadMessageId: latestMessage?.id ?? null,
        lastReadAt: now,
      })
      .where(eq(readState.id, existing[0].id));
  } else {
    await db.insert(readState).values({
      userId,
      channelId,
      lastReadMessageId: latestMessage?.id ?? null,
      lastReadAt: now,
    });
  }

  return c.json({
    success: true,
    lastReadMessageId: latestMessage?.id ?? null,
  });
});
