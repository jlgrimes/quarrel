import { Hono } from "hono";
import {
  db,
  messages,
  channels,
  members,
  users,
  servers,
  threads,
  threadMessages,
  threadMembers,
} from "@quarrel/db";
import {
  createThreadSchema,
  sendThreadMessageSchema,
  updateThreadMemberSchema,
  MESSAGE_BATCH_SIZE,
} from "@quarrel/shared";
import { eq, and, desc, lt, isNull, inArray } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { broadcastToChannel } from "../ws";

export const threadRoutes = new Hono<AuthEnv>();

threadRoutes.use(authMiddleware);

// Create a thread from a message
threadRoutes.post("/messages/:id/threads", async (c) => {
  const messageId = c.req.param("id");
  const userId = c.get("userId");
  const user = c.get("user");

  // Verify message exists and user has access
  const [message] = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      authorId: messages.authorId,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }

  // Verify user is a member of the server that owns this channel
  const [channelMember] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .innerJoin(
      members,
      and(eq(members.serverId, channels.serverId), eq(members.userId, userId))
    )
    .where(eq(channels.id, message.channelId))
    .limit(1);

  if (!channelMember) {
    return c.json({ error: "Channel not found or not a member" }, 403);
  }

  // Check if a thread already exists for this message
  const [existingThread] = await db
    .select({ id: threads.id })
    .from(threads)
    .where(eq(threads.parentMessageId, messageId))
    .limit(1);

  if (existingThread) {
    return c.json({ error: "Thread already exists for this message" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const now = new Date();

  // Create the thread
  const [thread] = await db
    .insert(threads)
    .values({
      parentMessageId: messageId,
      channelId: message.channelId,
      creatorId: userId,
      lastMessageAt: parsed.data.content ? now : null,
      createdAt: now,
    })
    .returning();

  // Add creator as thread member
  await db.insert(threadMembers).values({
    threadId: thread.id,
    userId,
    notifyPreference: "all",
  });

  // Add the original message author as a thread member too (if different)
  if (message.authorId !== userId) {
    await db.insert(threadMembers).values({
      threadId: thread.id,
      userId: message.authorId,
      notifyPreference: "all",
    });
  }

  // If initial content provided, create the first thread message
  let firstMessage = null;
  if (parsed.data.content) {
    const [msg] = await db
      .insert(threadMessages)
      .values({
        threadId: thread.id,
        authorId: userId,
        content: parsed.data.content,
      })
      .returning();

    const author = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };

    firstMessage = { ...msg, author };
  }

  broadcastToChannel(message.channelId, "thread:created", {
    thread,
    parentMessageId: messageId,
    channelId: message.channelId,
  });

  return c.json({ thread, firstMessage }, 201);
});

// List active threads in a channel
threadRoutes.get("/channels/:channelId/threads", async (c) => {
  const channelId = c.req.param("channelId");
  const userId = c.get("userId");

  // Verify user has access to this channel
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

  // Get active (non-archived) threads
  const activeThreads = await db
    .select()
    .from(threads)
    .where(
      and(eq(threads.channelId, channelId), isNull(threads.archivedAt))
    )
    .orderBy(desc(threads.lastMessageAt));

  if (activeThreads.length === 0) {
    return c.json({ threads: [] });
  }

  // Fetch creator info
  const creatorIds = [...new Set(activeThreads.map((t) => t.creatorId))];
  const creators = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(
      creatorIds.length === 1
        ? eq(users.id, creatorIds[0])
        : inArray(users.id, creatorIds)
    );

  const creatorMap = new Map(creators.map((u) => [u.id, u]));

  // Get member counts for each thread
  const threadIds = activeThreads.map((t) => t.id);
  const allMembers = await db
    .select({ threadId: threadMembers.threadId, userId: threadMembers.userId })
    .from(threadMembers)
    .where(
      threadIds.length === 1
        ? eq(threadMembers.threadId, threadIds[0])
        : inArray(threadMembers.threadId, threadIds)
    );

  const memberCountMap = new Map<string, number>();
  for (const m of allMembers) {
    memberCountMap.set(m.threadId, (memberCountMap.get(m.threadId) || 0) + 1);
  }

  const threadsWithDetails = activeThreads.map((t) => ({
    ...t,
    creator: creatorMap.get(t.creatorId),
    memberCount: memberCountMap.get(t.id) || 0,
  }));

  return c.json({ threads: threadsWithDetails });
});

// Get thread details
threadRoutes.get("/threads/:id", async (c) => {
  const threadId = c.req.param("id");
  const userId = c.get("userId");

  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Verify user has access to the channel
  const [channelMember] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .innerJoin(
      members,
      and(eq(members.serverId, channels.serverId), eq(members.userId, userId))
    )
    .where(eq(channels.id, thread.channelId))
    .limit(1);

  if (!channelMember) {
    return c.json({ error: "Not a member of this channel" }, 403);
  }

  // Get thread members
  const membersList = await db
    .select({
      userId: threadMembers.userId,
      notifyPreference: threadMembers.notifyPreference,
      lastReadAt: threadMembers.lastReadAt,
    })
    .from(threadMembers)
    .where(eq(threadMembers.threadId, threadId));

  const memberUserIds = membersList.map((m) => m.userId);
  const memberUsers =
    memberUserIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(
            memberUserIds.length === 1
              ? eq(users.id, memberUserIds[0])
              : inArray(users.id, memberUserIds)
          )
      : [];

  const userMap = new Map(memberUsers.map((u) => [u.id, u]));

  const membersWithInfo = membersList.map((m) => ({
    ...m,
    user: userMap.get(m.userId),
  }));

  return c.json({ thread, members: membersWithInfo });
});

// Send a message in a thread
threadRoutes.post("/threads/:id/messages", async (c) => {
  const threadId = c.req.param("id");
  const userId = c.get("userId");
  const user = c.get("user");

  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  if (thread.archivedAt) {
    return c.json({ error: "Thread is archived" }, 400);
  }

  // Verify user has access to the channel
  const [channelMember] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .innerJoin(
      members,
      and(eq(members.serverId, channels.serverId), eq(members.userId, userId))
    )
    .where(eq(channels.id, thread.channelId))
    .limit(1);

  if (!channelMember) {
    return c.json({ error: "Not a member of this channel" }, 403);
  }

  const body = await c.req.json();
  const parsed = sendThreadMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const now = new Date();

  const [message] = await db
    .insert(threadMessages)
    .values({
      threadId,
      authorId: userId,
      content: parsed.data.content,
      attachments: parsed.data.attachments
        ? JSON.stringify(parsed.data.attachments)
        : null,
    })
    .returning();

  // Update thread's lastMessageAt
  await db
    .update(threads)
    .set({ lastMessageAt: now })
    .where(eq(threads.id, threadId));

  // Auto-add user as thread member if not already
  const [existingMember] = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(
      and(
        eq(threadMembers.threadId, threadId),
        eq(threadMembers.userId, userId)
      )
    )
    .limit(1);

  if (!existingMember) {
    await db.insert(threadMembers).values({
      threadId,
      userId,
      notifyPreference: "all",
    });
  }

  const author = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };

  const fullMessage = { ...message, author };

  broadcastToChannel(thread.channelId, "thread:message_new", {
    threadId,
    parentMessageId: thread.parentMessageId,
    channelId: thread.channelId,
    message: fullMessage,
  });

  return c.json({ message: fullMessage }, 201);
});

// Get messages in a thread
threadRoutes.get("/threads/:id/messages", async (c) => {
  const threadId = c.req.param("id");
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    Number(c.req.query("limit")) || MESSAGE_BATCH_SIZE,
    MESSAGE_BATCH_SIZE
  );

  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Verify user has access to the channel
  const [channelMember] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .innerJoin(
      members,
      and(eq(members.serverId, channels.serverId), eq(members.userId, userId))
    )
    .where(eq(channels.id, thread.channelId))
    .limit(1);

  if (!channelMember) {
    return c.json({ error: "Not a member of this channel" }, 403);
  }

  const result = await db
    .select()
    .from(threadMessages)
    .where(
      cursor
        ? and(
            eq(threadMessages.threadId, threadId),
            lt(threadMessages.createdAt, new Date(cursor))
          )
        : eq(threadMessages.threadId, threadId)
    )
    .orderBy(desc(threadMessages.createdAt))
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

// Join/follow a thread
threadRoutes.post("/threads/:id/members", async (c) => {
  const threadId = c.req.param("id");
  const userId = c.get("userId");

  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Verify user has access to the channel
  const [channelMember] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .innerJoin(
      members,
      and(eq(members.serverId, channels.serverId), eq(members.userId, userId))
    )
    .where(eq(channels.id, thread.channelId))
    .limit(1);

  if (!channelMember) {
    return c.json({ error: "Not a member of this channel" }, 403);
  }

  // Check if already a member
  const [existing] = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(
      and(
        eq(threadMembers.threadId, threadId),
        eq(threadMembers.userId, userId)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ error: "Already a thread member" }, 400);
  }

  await db.insert(threadMembers).values({
    threadId,
    userId,
    notifyPreference: "all",
  });

  return c.json({ success: true }, 201);
});

// Leave/unfollow a thread
threadRoutes.delete("/threads/:id/members", async (c) => {
  const threadId = c.req.param("id");
  const userId = c.get("userId");

  const [existing] = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(
      and(
        eq(threadMembers.threadId, threadId),
        eq(threadMembers.userId, userId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: "Not a thread member" }, 404);
  }

  await db
    .delete(threadMembers)
    .where(
      and(
        eq(threadMembers.threadId, threadId),
        eq(threadMembers.userId, userId)
      )
    );

  return c.json({ success: true });
});

// Update thread notification preference
threadRoutes.patch("/threads/:id/members", async (c) => {
  const threadId = c.req.param("id");
  const userId = c.get("userId");

  const body = await c.req.json();
  const parsed = updateThreadMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [existing] = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(
      and(
        eq(threadMembers.threadId, threadId),
        eq(threadMembers.userId, userId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: "Not a thread member" }, 404);
  }

  await db
    .update(threadMembers)
    .set({ notifyPreference: parsed.data.notifyPreference })
    .where(
      and(
        eq(threadMembers.threadId, threadId),
        eq(threadMembers.userId, userId)
      )
    );

  return c.json({ success: true });
});

// Archive a thread (thread creator or server owner only)
threadRoutes.patch("/threads/:id", async (c) => {
  const threadId = c.req.param("id");
  const userId = c.get("userId");

  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Check if user is thread creator or server owner
  if (thread.creatorId !== userId) {
    const [channelServer] = await db
      .select({ ownerId: servers.ownerId })
      .from(channels)
      .innerJoin(servers, eq(channels.serverId, servers.id))
      .where(eq(channels.id, thread.channelId))
      .limit(1);

    if (!channelServer || channelServer.ownerId !== userId) {
      return c.json(
        { error: "Only thread creator or server owner can archive" },
        403
      );
    }
  }

  const [updated] = await db
    .update(threads)
    .set({ archivedAt: new Date() })
    .where(eq(threads.id, threadId))
    .returning();

  broadcastToChannel(thread.channelId, "thread:archived", {
    threadId: updated.id,
    channelId: thread.channelId,
    parentMessageId: thread.parentMessageId,
  });

  return c.json({ thread: updated });
});
