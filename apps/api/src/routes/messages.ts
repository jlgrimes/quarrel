import { Hono } from "hono";
import { db, messages, channels, members, users, servers } from "@quarrel/db";
import { sendMessageSchema, editMessageSchema, MESSAGE_BATCH_SIZE } from "@quarrel/shared";
import { eq, and, lt, desc, inArray } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { broadcastToChannel } from "../ws";

export const messageRoutes = new Hono<AuthEnv>();

messageRoutes.use(authMiddleware);

messageRoutes.post("/channels/:channelId/messages", async (c) => {
  const channelId = c.req.param("channelId");
  const userId = c.get("userId");
  const user = c.get("user");

  // Single JOIN: verify channel exists and user is a member in one query
  const [channelMember] = await db
    .select({ channelId: channels.id, serverId: channels.serverId })
    .from(channels)
    .innerJoin(
      members,
      and(eq(members.serverId, channels.serverId), eq(members.userId, userId))
    )
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channelMember) {
    return c.json({ error: "Channel not found or not a member" }, 403);
  }

  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [message] = await db
    .insert(messages)
    .values({
      channelId,
      authorId: userId,
      content: parsed.data.content,
      attachments: parsed.data.attachments
        ? JSON.stringify(parsed.data.attachments)
        : null,
      replyToId: parsed.data.replyToId,
    })
    .returning();

  // Use user from auth middleware instead of extra DB query
  const author = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };

  const fullMessage = { ...message, author };
  broadcastToChannel(channelId, "message:new", fullMessage);

  return c.json({ message: fullMessage }, 201);
});

messageRoutes.get("/channels/:channelId/messages", async (c) => {
  const channelId = c.req.param("channelId");
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(MESSAGE_BATCH_SIZE)),
    MESSAGE_BATCH_SIZE
  );

  // Single JOIN: verify channel exists and user is a member in one query
  const [channelMember] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .innerJoin(
      members,
      and(eq(members.serverId, channels.serverId), eq(members.userId, userId))
    )
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channelMember) {
    return c.json({ error: "Channel not found or not a member" }, 403);
  }

  const result = await db
    .select()
    .from(messages)
    .where(
      cursor
        ? and(
            eq(messages.channelId, channelId),
            lt(messages.createdAt, new Date(cursor))
          )
        : eq(messages.channelId, channelId)
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const authorIds = [...new Set(result.map((m) => m.authorId))];
  const authors =
    authorIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(
            authorIds.length === 1
              ? eq(users.id, authorIds[0])
              : inArray(users.id, authorIds)
          )
      : [];

  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const nextCursor =
    result.length === limit
      ? result[result.length - 1].createdAt?.toISOString()
      : null;

  const messagesWithAuthors = result.map((m) => ({
    ...m,
    author: authorMap.get(m.authorId),
  }));

  return c.json({ messages: messagesWithAuthors, nextCursor });
});

messageRoutes.patch("/messages/:id", async (c) => {
  const messageId = c.req.param("id");
  const userId = c.get("userId");

  // Only select authorId - that's all we need for the ownership check
  const [message] = await db
    .select({ id: messages.id, authorId: messages.authorId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }

  if (message.authorId !== userId) {
    return c.json({ error: "Can only edit your own messages" }, 403);
  }

  const body = await c.req.json();
  const parsed = editMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(messages)
    .set({
      content: parsed.data.content,
      editedAt: new Date(),
    })
    .where(eq(messages.id, messageId))
    .returning();

  return c.json({ message: updated });
});

messageRoutes.delete("/messages/:id", async (c) => {
  const messageId = c.req.param("id");
  const userId = c.get("userId");

  // Only select authorId and channelId - all we need for auth check
  const [message] = await db
    .select({
      id: messages.id,
      authorId: messages.authorId,
      channelId: messages.channelId,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }

  if (message.authorId !== userId) {
    // Single JOIN: channel -> server owner check in one query
    const [channelServer] = await db
      .select({ ownerId: servers.ownerId })
      .from(channels)
      .innerJoin(servers, eq(channels.serverId, servers.id))
      .where(eq(channels.id, message.channelId))
      .limit(1);

    if (!channelServer || channelServer.ownerId !== userId) {
      return c.json(
        { error: "Can only delete your own messages or as admin" },
        403
      );
    }
  }

  await db
    .update(messages)
    .set({ deleted: true })
    .where(eq(messages.id, messageId));

  return c.json({ success: true });
});
