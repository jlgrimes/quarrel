import { Hono } from "hono";
import {
  db,
  conversations,
  conversationMembers,
  directMessages,
  users,
} from "@quarrel/db";
import { sendMessageSchema, MESSAGE_BATCH_SIZE } from "@quarrel/shared";
import { eq, and, lt, desc, inArray } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

export const dmRoutes = new Hono<AuthEnv>();

dmRoutes.use(authMiddleware);

dmRoutes.post("/conversations", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const targetUserId = body.userId;

  if (!targetUserId) {
    return c.json({ error: "userId is required" }, 400);
  }

  if (targetUserId === userId) {
    return c.json({ error: "Cannot start a conversation with yourself" }, 400);
  }

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Single query with self-join to find shared conversation instead of N+1 loop
  const myMemberships = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));

  if (myMemberships.length > 0) {
    const myConvIds = myMemberships.map((m) => m.conversationId);
    const [sharedConv] = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(
        and(
          inArray(conversationMembers.conversationId, myConvIds),
          eq(conversationMembers.userId, targetUserId)
        )
      )
      .limit(1);

    if (sharedConv) {
      const [conv] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, sharedConv.conversationId))
        .limit(1);
      return c.json({ conversation: conv });
    }
  }

  // Create new conversation
  const [conversation] = await db
    .insert(conversations)
    .values({})
    .returning();

  await db.insert(conversationMembers).values([
    { conversationId: conversation.id, userId },
    { conversationId: conversation.id, userId: targetUserId },
  ]);

  return c.json({ conversation }, 201);
});

dmRoutes.get("/conversations", async (c) => {
  const userId = c.get("userId");

  const myMemberships = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));

  if (myMemberships.length === 0) {
    return c.json({ conversations: [] });
  }

  const convIds = myMemberships.map((m) => m.conversationId);

  const convs = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, convIds));

  // Get members for each conversation
  const allMembers = await db
    .select({
      conversationId: conversationMembers.conversationId,
      userId: conversationMembers.userId,
    })
    .from(conversationMembers)
    .where(inArray(conversationMembers.conversationId, convIds));

  const memberUserIds = [
    ...new Set(allMembers.map((m) => m.userId).filter((id) => id !== userId)),
  ];

  const memberUsers =
    memberUserIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            status: users.status,
          })
          .from(users)
          .where(inArray(users.id, memberUserIds))
      : [];

  const userMap = new Map(memberUsers.map((u) => [u.id, u]));

  const result = convs.map((conv) => {
    const convMembers = allMembers
      .filter(
        (m) => m.conversationId === conv.id && m.userId !== userId
      )
      .map((m) => userMap.get(m.userId))
      .filter(Boolean);

    return { ...conv, members: convMembers };
  });

  return c.json({ conversations: result });
});

dmRoutes.post("/:conversationId/messages", async (c) => {
  const conversationId = c.req.param("conversationId");
  const userId = c.get("userId");

  const [membership] = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership) {
    return c.json({ error: "Not a member of this conversation" }, 403);
  }

  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [message] = await db
    .insert(directMessages)
    .values({
      conversationId,
      authorId: userId,
      content: parsed.data.content,
      attachments: parsed.data.attachments
        ? JSON.stringify(parsed.data.attachments)
        : null,
    })
    .returning();

  return c.json({ message }, 201);
});

dmRoutes.get("/:conversationId/messages", async (c) => {
  const conversationId = c.req.param("conversationId");
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(MESSAGE_BATCH_SIZE)),
    MESSAGE_BATCH_SIZE
  );

  const [membership] = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership) {
    return c.json({ error: "Not a member of this conversation" }, 403);
  }

  const result = await db
    .select()
    .from(directMessages)
    .where(
      cursor
        ? and(
            eq(directMessages.conversationId, conversationId),
            lt(directMessages.createdAt, new Date(cursor))
          )
        : eq(directMessages.conversationId, conversationId)
    )
    .orderBy(desc(directMessages.createdAt))
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
  const messagesWithAuthors = result.map((m) => ({
    ...m,
    author: authorMap.get(m.authorId),
  }));

  const nextCursor =
    result.length === limit
      ? result[result.length - 1].createdAt?.toISOString()
      : null;

  return c.json({ messages: messagesWithAuthors, nextCursor });
});
