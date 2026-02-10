import { Hono } from "hono";
import {
  db,
  conversations,
  conversationMembers,
  directMessages,
  users,
  readState,
} from "@quarrel/db";
import { sendMessageSchema, createGroupConversationSchema, updateGroupConversationSchema, MESSAGE_BATCH_SIZE } from "@quarrel/shared";
import { eq, and, lt, desc, inArray, gt, sql, ne } from "drizzle-orm";
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
      // Only match non-group (1:1) conversations
      const [conv] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, sharedConv.conversationId),
            sql`(${conversations.isGroup} = 0 OR ${conversations.isGroup} IS NULL)`
          )
        )
        .limit(1);

      if (conv) {
        const convMembers = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            status: users.status,
          })
          .from(conversationMembers)
          .innerJoin(users, eq(conversationMembers.userId, users.id))
          .where(
            and(
              eq(conversationMembers.conversationId, conv.id),
              sql`${conversationMembers.userId} != ${userId}`
            )
          );

        return c.json({ conversation: { ...conv, members: convMembers } });
      }
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

  const [otherUser] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  return c.json({ conversation: { ...conversation, members: otherUser ? [otherUser] : [] } }, 201);
});

// Create a group DM conversation
dmRoutes.post("/conversations/group", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createGroupConversationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { userIds, name } = parsed.data;

  if (userIds.includes(userId)) {
    return c.json({ error: "Cannot include yourself in userIds" }, 400);
  }

  // Verify all target users exist
  const targetUsers = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, status: users.status })
    .from(users)
    .where(inArray(users.id, userIds));

  if (targetUsers.length !== userIds.length) {
    return c.json({ error: "One or more users not found" }, 404);
  }

  // Create group conversation
  const [conversation] = await db
    .insert(conversations)
    .values({
      isGroup: true,
      name: name ?? null,
      ownerId: userId,
    })
    .returning();

  // Add all members (creator + target users)
  const memberValues = [userId, ...userIds].map((uid) => ({
    conversationId: conversation.id,
    userId: uid,
  }));
  await db.insert(conversationMembers).values(memberValues);

  return c.json({ conversation: { ...conversation, members: targetUsers } }, 201);
});

// Update group DM (name, icon) — owner only
dmRoutes.patch("/:conversationId", async (c) => {
  const conversationId = c.req.param("conversationId");
  const userId = c.get("userId");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  if (!conv.isGroup) {
    return c.json({ error: "Cannot update a 1:1 conversation" }, 400);
  }

  if (conv.ownerId !== userId) {
    return c.json({ error: "Only the group owner can update this conversation" }, 403);
  }

  const body = await c.req.json();
  const parsed = updateGroupConversationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const updates: Record<string, any> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.iconUrl !== undefined) updates.iconUrl = parsed.data.iconUrl;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const [updated] = await db
    .update(conversations)
    .set(updates)
    .where(eq(conversations.id, conversationId))
    .returning();

  return c.json({ conversation: updated });
});

// Add member to group DM — owner only
dmRoutes.post("/:conversationId/members", async (c) => {
  const conversationId = c.req.param("conversationId");
  const userId = c.get("userId");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  if (!conv.isGroup) {
    return c.json({ error: "Cannot add members to a 1:1 conversation" }, 400);
  }

  if (conv.ownerId !== userId) {
    return c.json({ error: "Only the group owner can add members" }, 403);
  }

  const body = await c.req.json();
  const targetUserId = body.userId;

  if (!targetUserId) {
    return c.json({ error: "userId is required" }, 400);
  }

  // Check user exists
  const [targetUser] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, status: users.status })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Check not already a member
  const [existing] = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ error: "User is already a member" }, 409);
  }

  // Check member limit (10 total including owner)
  const memberCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));

  if ((memberCount[0]?.count ?? 0) >= 10) {
    return c.json({ error: "Group DM member limit reached (max 10)" }, 400);
  }

  await db.insert(conversationMembers).values({
    conversationId,
    userId: targetUserId,
  });

  return c.json({ member: targetUser }, 201);
});

// Remove member from group DM — owner only
dmRoutes.delete("/:conversationId/members/:userId", async (c) => {
  const conversationId = c.req.param("conversationId");
  const currentUserId = c.get("userId");
  const targetUserId = c.req.param("userId");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  if (!conv.isGroup) {
    return c.json({ error: "Cannot remove members from a 1:1 conversation" }, 400);
  }

  if (conv.ownerId !== currentUserId) {
    return c.json({ error: "Only the group owner can remove members" }, 403);
  }

  if (targetUserId === currentUserId) {
    return c.json({ error: "Owner cannot remove themselves. Use /leave instead" }, 400);
  }

  // Check target is a member
  const [membership] = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (!membership) {
    return c.json({ error: "User is not a member of this conversation" }, 404);
  }

  await db
    .delete(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, targetUserId)
      )
    );

  return c.json({ success: true });
});

// Leave a group DM
dmRoutes.post("/:conversationId/leave", async (c) => {
  const conversationId = c.req.param("conversationId");
  const userId = c.get("userId");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  if (!conv.isGroup) {
    return c.json({ error: "Cannot leave a 1:1 conversation" }, 400);
  }

  // Check membership
  const [membership] = await db
    .select()
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

  // Remove from conversation
  await db
    .delete(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      )
    );

  // If the owner leaves, transfer ownership to another member
  if (conv.ownerId === userId) {
    const [nextMember] = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId))
      .limit(1);

    if (nextMember) {
      await db
        .update(conversations)
        .set({ ownerId: nextMember.userId })
        .where(eq(conversations.id, conversationId));
    }
  }

  return c.json({ success: true });
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

  // Get read states for all conversations
  const userReadStates = await db
    .select()
    .from(readState)
    .where(
      and(
        eq(readState.userId, userId),
        inArray(readState.conversationId, convIds)
      )
    );

  const readMap = new Map(
    userReadStates
      .filter((rs) => rs.conversationId)
      .map((rs) => [rs.conversationId, rs])
  );

  const result = await Promise.all(
    convs.map(async (conv) => {
      const convMembers = allMembers
        .filter(
          (m) => m.conversationId === conv.id && m.userId !== userId
        )
        .map((m) => userMap.get(m.userId))
        .filter(Boolean);

      // Calculate unread count
      const rs = readMap.get(conv.id);
      let unreadCount = 0;

      if (rs?.lastReadAt) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(directMessages)
          .where(
            and(
              eq(directMessages.conversationId, conv.id),
              gt(directMessages.createdAt, rs.lastReadAt)
            )
          );
        unreadCount = countResult?.count ?? 0;
      }

      return { ...conv, members: convMembers, unreadCount };
    })
  );

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
    Number(c.req.query("limit")) || MESSAGE_BATCH_SIZE,
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
            eq(directMessages.deleted, false),
            lt(directMessages.createdAt, new Date(cursor))
          )
        : and(
            eq(directMessages.conversationId, conversationId),
            eq(directMessages.deleted, false)
          )
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

// Mark DM conversation as read
dmRoutes.post("/:conversationId/ack", async (c) => {
  const conversationId = c.req.param("conversationId");
  const userId = c.get("userId");

  // Verify membership
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

  // Get latest message
  const [latestMessage] = await db
    .select({ id: directMessages.id })
    .from(directMessages)
    .where(eq(directMessages.conversationId, conversationId))
    .orderBy(desc(directMessages.createdAt))
    .limit(1);

  const now = new Date();

  // Upsert read state
  const existing = await db
    .select()
    .from(readState)
    .where(
      and(
        eq(readState.userId, userId),
        eq(readState.conversationId, conversationId)
      )
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
      conversationId,
      lastReadMessageId: latestMessage?.id ?? null,
      lastReadAt: now,
    });
  }

  return c.json({
    success: true,
    lastReadMessageId: latestMessage?.id ?? null,
  });
});
