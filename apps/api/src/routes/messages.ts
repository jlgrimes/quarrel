import { Hono } from "hono";
import { db, messages, channels, members, users, servers, reactions } from "@quarrel/db";
import { sendMessageSchema, editMessageSchema, searchMessagesSchema, bulkDeleteSchema, MESSAGE_BATCH_SIZE, PERMISSIONS } from "@quarrel/shared";
import { roles, memberRoles } from "@quarrel/db";
import { eq, and, lt, gt, desc, inArray, isNotNull, like, sql } from "drizzle-orm";
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
    Number(c.req.query("limit")) || MESSAGE_BATCH_SIZE,
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
            eq(messages.deleted, false),
            lt(messages.createdAt, new Date(cursor))
          )
        : and(
            eq(messages.channelId, channelId),
            eq(messages.deleted, false)
          )
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

  // Fetch reactions for all messages in this batch
  const messageIds = result.map((m) => m.id);
  const reactionsMap = await getReactionsForMessages(messageIds, userId);

  const nextCursor =
    result.length === limit
      ? result[result.length - 1].createdAt?.toISOString()
      : null;

  const messagesWithAuthors = result.map((m) => ({
    ...m,
    author: authorMap.get(m.authorId),
    reactions: reactionsMap.get(m.id) ?? [],
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

// Bulk delete messages
messageRoutes.post("/channels/:channelId/messages/bulk-delete", async (c) => {
  const channelId = c.req.param("channelId");
  const userId = c.get("userId");

  const body = await c.req.json();
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Get channel's server
  const [channel] = await db
    .select({ id: channels.id, serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    return c.json({ error: "Channel not found" }, 404);
  }

  // Check permission: owner or MANAGE_MESSAGES
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, channel.serverId))
    .limit(1);

  let allowed = server?.ownerId === userId;
  if (!allowed) {
    const [member] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (member) {
      const memberRolesList = await db
        .select({ permissions: roles.permissions })
        .from(memberRoles)
        .innerJoin(roles, eq(memberRoles.roleId, roles.id))
        .where(eq(memberRoles.memberId, member.id));
      const combined = memberRolesList.reduce((acc, r) => acc | r.permissions, 0);
      allowed = (combined & PERMISSIONS.ADMINISTRATOR) !== 0 || (combined & PERMISSIONS.MANAGE_MESSAGES) !== 0;
    }
  }

  if (!allowed) {
    return c.json({ error: "Missing permissions" }, 403);
  }

  // Verify all messages belong to this channel
  const targetMessages = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.channelId, channelId),
        inArray(messages.id, parsed.data.messageIds)
      )
    );

  const validIds = targetMessages.map((m) => m.id);
  if (validIds.length === 0) {
    return c.json({ error: "No valid messages found in this channel" }, 400);
  }

  // Soft-delete
  await db
    .update(messages)
    .set({ deleted: true })
    .where(inArray(messages.id, validIds));

  return c.json({ deleted: validIds.length });
});

// Pin a message (server owner only)
messageRoutes.post("/messages/:id/pin", async (c) => {
  const messageId = c.req.param("id");
  const userId = c.get("userId");

  const [message] = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      pinnedAt: messages.pinnedAt,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }

  if (message.pinnedAt) {
    return c.json({ error: "Message already pinned" }, 400);
  }

  // Check server ownership
  const [channelServer] = await db
    .select({ ownerId: servers.ownerId })
    .from(channels)
    .innerJoin(servers, eq(channels.serverId, servers.id))
    .where(eq(channels.id, message.channelId))
    .limit(1);

  if (!channelServer || channelServer.ownerId !== userId) {
    return c.json({ error: "Only server owner can pin messages" }, 403);
  }

  const [updated] = await db
    .update(messages)
    .set({ pinnedAt: new Date(), pinnedBy: userId })
    .where(eq(messages.id, messageId))
    .returning();

  broadcastToChannel(message.channelId, "message:pinned", {
    messageId: updated.id,
    channelId: updated.channelId,
    pinnedAt: updated.pinnedAt,
    pinnedBy: updated.pinnedBy,
  });

  return c.json({ message: updated });
});

// Unpin a message (server owner only)
messageRoutes.delete("/messages/:id/pin", async (c) => {
  const messageId = c.req.param("id");
  const userId = c.get("userId");

  const [message] = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      pinnedAt: messages.pinnedAt,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }

  if (!message.pinnedAt) {
    return c.json({ error: "Message is not pinned" }, 400);
  }

  const [channelServer] = await db
    .select({ ownerId: servers.ownerId })
    .from(channels)
    .innerJoin(servers, eq(channels.serverId, servers.id))
    .where(eq(channels.id, message.channelId))
    .limit(1);

  if (!channelServer || channelServer.ownerId !== userId) {
    return c.json({ error: "Only server owner can unpin messages" }, 403);
  }

  const [updated] = await db
    .update(messages)
    .set({ pinnedAt: null, pinnedBy: null })
    .where(eq(messages.id, messageId))
    .returning();

  broadcastToChannel(message.channelId, "message:unpinned", {
    messageId: updated.id,
    channelId: updated.channelId,
  });

  return c.json({ message: updated });
});

// List pinned messages for a channel
messageRoutes.get("/channels/:channelId/pins", async (c) => {
  const channelId = c.req.param("channelId");
  const userId = c.get("userId");

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

  const pinned = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.channelId, channelId),
        isNotNull(messages.pinnedAt)
      )
    )
    .orderBy(desc(messages.pinnedAt));

  const authorIds = [...new Set(pinned.map((m) => m.authorId))];
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

  const messagesWithAuthors = pinned.map((m) => ({
    ...m,
    author: authorMap.get(m.authorId),
  }));

  return c.json({ messages: messagesWithAuthors });
});

// Search messages across servers the user is a member of
messageRoutes.get("/search", async (c) => {
  const userId = c.get("userId");

  const parsed = searchMessagesSchema.safeParse({
    q: c.req.query("q"),
    serverId: c.req.query("serverId"),
    channelId: c.req.query("channelId"),
    authorId: c.req.query("authorId"),
    before: c.req.query("before"),
    after: c.req.query("after"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { q, serverId, channelId, authorId, before, after, limit, offset } =
    parsed.data;

  // Get all server IDs the user is a member of
  const userMemberships = await db
    .select({ serverId: members.serverId })
    .from(members)
    .where(eq(members.userId, userId));

  if (userMemberships.length === 0) {
    return c.json({ messages: [], total: 0 });
  }

  const memberServerIds = userMemberships.map((m) => m.serverId);

  // If serverId filter is specified, verify user is a member
  if (serverId && !memberServerIds.includes(serverId)) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  // If channelId filter is specified, verify user has access
  if (channelId) {
    const [ch] = await db
      .select({ serverId: channels.serverId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!ch || !memberServerIds.includes(ch.serverId)) {
      return c.json({ error: "Channel not found or not a member" }, 403);
    }
  }

  // Build the list of channel IDs to search within
  let searchChannelIds: string[];

  if (channelId) {
    searchChannelIds = [channelId];
  } else {
    const targetServerIds = serverId ? [serverId] : memberServerIds;
    const accessibleChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(
        targetServerIds.length === 1
          ? eq(channels.serverId, targetServerIds[0])
          : inArray(channels.serverId, targetServerIds)
      );
    searchChannelIds = accessibleChannels.map((ch) => ch.id);
  }

  if (searchChannelIds.length === 0) {
    return c.json({ messages: [], total: 0 });
  }

  // Build conditions
  const conditions = [
    searchChannelIds.length === 1
      ? eq(messages.channelId, searchChannelIds[0])
      : inArray(messages.channelId, searchChannelIds),
    like(messages.content, `%${q}%`),
    eq(messages.deleted, false),
  ];

  if (authorId) {
    conditions.push(eq(messages.authorId, authorId));
  }
  if (before) {
    conditions.push(lt(messages.createdAt, new Date(before)));
  }
  if (after) {
    conditions.push(gt(messages.createdAt, new Date(after)));
  }

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(and(...conditions));
  const total = countResult?.count ?? 0;

  // Get matching messages
  const result = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch authors
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

  // Fetch channel info for context
  const resultChannelIds = [...new Set(result.map((m) => m.channelId))];
  const channelInfos =
    resultChannelIds.length > 0
      ? await db
          .select({
            id: channels.id,
            name: channels.name,
            serverId: channels.serverId,
          })
          .from(channels)
          .where(
            resultChannelIds.length === 1
              ? eq(channels.id, resultChannelIds[0])
              : inArray(channels.id, resultChannelIds)
          )
      : [];

  const channelMap = new Map(channelInfos.map((ch) => [ch.id, ch]));

  // Fetch server names for context
  const resultServerIds = [
    ...new Set(channelInfos.map((ch) => ch.serverId)),
  ];
  const serverInfos =
    resultServerIds.length > 0
      ? await db
          .select({ id: servers.id, name: servers.name })
          .from(servers)
          .where(
            resultServerIds.length === 1
              ? eq(servers.id, resultServerIds[0])
              : inArray(servers.id, resultServerIds)
          )
      : [];

  const serverMap = new Map(serverInfos.map((s) => [s.id, s]));

  const messagesWithContext = result.map((m) => {
    const channel = channelMap.get(m.channelId);
    const server = channel ? serverMap.get(channel.serverId) : undefined;
    return {
      ...m,
      author: authorMap.get(m.authorId),
      channel: channel
        ? { id: channel.id, name: channel.name }
        : undefined,
      server: server ? { id: server.id, name: server.name } : undefined,
    };
  });

  return c.json({ messages: messagesWithContext, total });
});

// Helper to get aggregated reactions for a set of message IDs
export async function getReactionsForMessages(messageIds: string[], currentUserId: string) {
  if (messageIds.length === 0) return new Map<string, { emoji: string; count: number; me: boolean }[]>();

  const allReactions = await db
    .select()
    .from(reactions)
    .where(
      messageIds.length === 1
        ? eq(reactions.messageId, messageIds[0])
        : inArray(reactions.messageId, messageIds)
    );

  const grouped = new Map<string, Map<string, { count: number; userIds: Set<string> }>>();
  for (const r of allReactions) {
    let msgMap = grouped.get(r.messageId);
    if (!msgMap) {
      msgMap = new Map();
      grouped.set(r.messageId, msgMap);
    }
    let emojiData = msgMap.get(r.emoji);
    if (!emojiData) {
      emojiData = { count: 0, userIds: new Set() };
      msgMap.set(r.emoji, emojiData);
    }
    emojiData.count++;
    emojiData.userIds.add(r.userId);
  }

  const result = new Map<string, { emoji: string; count: number; me: boolean }[]>();
  for (const [msgId, emojiMap] of grouped) {
    result.set(
      msgId,
      Array.from(emojiMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        me: data.userIds.has(currentUserId),
      }))
    );
  }
  return result;
}

// Add reaction to a message
messageRoutes.put("/messages/:id/reactions/:emoji", async (c) => {
  const messageId = c.req.param("id");
  const emoji = decodeURIComponent(c.req.param("emoji"));
  const userId = c.get("userId");

  const [message] = await db
    .select({ id: messages.id, channelId: messages.channelId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }

  // Check if user already reacted with this emoji
  const [existing] = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.messageId, messageId),
        eq(reactions.userId, userId),
        eq(reactions.emoji, emoji)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ reaction: existing });
  }

  const [reaction] = await db
    .insert(reactions)
    .values({ messageId, userId, emoji })
    .returning();

  // Get updated reaction counts for this message
  const reactionsMap = await getReactionsForMessages([messageId], userId);
  const messageReactions = reactionsMap.get(messageId) ?? [];

  broadcastToChannel(message.channelId, "reaction:update", {
    messageId,
    channelId: message.channelId,
    reactions: messageReactions,
  });

  return c.json({ reaction }, 201);
});

// Remove reaction from a message
messageRoutes.delete("/messages/:id/reactions/:emoji", async (c) => {
  const messageId = c.req.param("id");
  const emoji = decodeURIComponent(c.req.param("emoji"));
  const userId = c.get("userId");

  const [message] = await db
    .select({ id: messages.id, channelId: messages.channelId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }

  const [existing] = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.messageId, messageId),
        eq(reactions.userId, userId),
        eq(reactions.emoji, emoji)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: "Reaction not found" }, 404);
  }

  await db.delete(reactions).where(eq(reactions.id, existing.id));

  // Get updated reaction counts for this message
  const reactionsMap = await getReactionsForMessages([messageId], userId);
  const messageReactions = reactionsMap.get(messageId) ?? [];

  broadcastToChannel(message.channelId, "reaction:update", {
    messageId,
    channelId: message.channelId,
    reactions: messageReactions,
  });

  return c.json({ success: true });
});

// Get reactions for a message
messageRoutes.get("/messages/:id/reactions", async (c) => {
  const messageId = c.req.param("id");
  const userId = c.get("userId");

  const reactionsMap = await getReactionsForMessages([messageId], userId);
  const messageReactions = reactionsMap.get(messageId) ?? [];

  return c.json({ reactions: messageReactions });
});

// Bulk delete messages
messageRoutes.post("/channels/:channelId/messages/bulk-delete", async (c) => {
  const channelId = c.req.param("channelId");
  const userId = c.get("userId");

  const body = await c.req.json();
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Find channel and its server
  const [channel] = await db
    .select({ id: channels.id, serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    return c.json({ error: "Channel not found" }, 404);
  }

  // Check permission: owner or MANAGE_MESSAGES
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, channel.serverId))
    .limit(1);

  let allowed = server?.ownerId === userId;
  if (!allowed) {
    const [member] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);

    if (member) {
      const memberRolesList = await db
        .select({ permissions: roles.permissions })
        .from(memberRoles)
        .innerJoin(roles, eq(memberRoles.roleId, roles.id))
        .where(eq(memberRoles.memberId, member.id));

      const combined = memberRolesList.reduce((acc, r) => acc | r.permissions, 0);
      allowed = (combined & PERMISSIONS.ADMINISTRATOR) !== 0 || (combined & PERMISSIONS.MANAGE_MESSAGES) !== 0;
    }
  }

  if (!allowed) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Soft-delete all specified messages that belong to this channel
  const result = await db
    .update(messages)
    .set({ deleted: true })
    .where(
      and(
        eq(messages.channelId, channelId),
        inArray(messages.id, parsed.data.messageIds)
      )
    )
    .returning({ id: messages.id });

  return c.json({ deleted: result.length });
});
