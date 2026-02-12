import type { ServerWebSocket } from "bun";
import { db, sessions, members, channels, users, messages } from "@quarrel/db";
import { eq, and, inArray } from "drizzle-orm";
import { sendMessageSchema } from "@quarrel/shared";
import { handleBotMentions } from "./lib/botHandler";

type WSData = {
  userId: string;
  token: string;
  subscribedChannels: Set<string>;
  subscribedServers: Set<string>;
};

type VoiceParticipant = { userId: string; username: string; displayName: string | null; avatarUrl: string | null; isMuted: boolean; isDeafened: boolean; isScreenSharing: boolean };

const connectedClients = new Map<string, Set<ServerWebSocket<WSData>>>();

// Reverse indexes: channel/server -> set of sockets subscribed
const channelSubscribers = new Map<string, Set<ServerWebSocket<WSData>>>();
const serverSubscribers = new Map<string, Set<ServerWebSocket<WSData>>>();

// Voice state: which users are in which voice channels
const voiceChannels = new Map<string, Map<string, VoiceParticipant>>();
const userVoiceChannel = new Map<string, string>();

// Pre-serialized static messages to avoid repeated JSON.stringify
const ERROR_NOT_AUTHENTICATED = JSON.stringify({ event: "error", data: { message: "Not authenticated" } });
const ERROR_INVALID_TOKEN = JSON.stringify({ event: "error", data: { message: "Invalid token" } });
const ERROR_INVALID_FORMAT = JSON.stringify({ event: "error", data: { message: "Invalid message format" } });

// Shared empty set to avoid allocations on cache miss
const EMPTY_SOCKET_SET: ReadonlySet<ServerWebSocket<WSData>> = new Set();

function getClientSockets(userId: string): ReadonlySet<ServerWebSocket<WSData>> {
  return connectedClients.get(userId) || EMPTY_SOCKET_SET;
}

export const MAX_CONNECTIONS_PER_USER = 5;

function addClient(userId: string, ws: ServerWebSocket<WSData>): boolean {
  let sockets = connectedClients.get(userId);
  if (!sockets) {
    sockets = new Set();
    connectedClients.set(userId, sockets);
  }
  if (sockets.size >= MAX_CONNECTIONS_PER_USER) {
    return false;
  }
  sockets.add(ws);
  return true;
}

function removeClient(userId: string, ws: ServerWebSocket<WSData>) {
  const sockets = connectedClients.get(userId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      connectedClients.delete(userId);
    }
  }
  // Remove from reverse indexes
  for (const channelId of ws.data.subscribedChannels) {
    const subs = channelSubscribers.get(channelId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) channelSubscribers.delete(channelId);
    }
  }
  for (const serverId of ws.data.subscribedServers) {
    const subs = serverSubscribers.get(serverId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) serverSubscribers.delete(serverId);
    }
  }
}

function subscribeToChannel(ws: ServerWebSocket<WSData>, channelId: string) {
  ws.data.subscribedChannels.add(channelId);
  let subs = channelSubscribers.get(channelId);
  if (!subs) {
    subs = new Set();
    channelSubscribers.set(channelId, subs);
  }
  subs.add(ws);
}

function subscribeToServer(ws: ServerWebSocket<WSData>, serverId: string) {
  ws.data.subscribedServers.add(serverId);
  let subs = serverSubscribers.get(serverId);
  if (!subs) {
    subs = new Set();
    serverSubscribers.set(serverId, subs);
  }
  subs.add(ws);
}

export function broadcastToChannel(channelId: string, event: string, data: any) {
  const subs = channelSubscribers.get(channelId);
  if (!subs || subs.size === 0) return;
  const msg = JSON.stringify({ event, data });
  for (const ws of subs) {
    ws.send(msg);
  }
}

export function broadcastToServer(serverId: string, event: string, data: any) {
  const subs = serverSubscribers.get(serverId);
  if (!subs || subs.size === 0) return;
  const msg = JSON.stringify({ event, data });
  for (const ws of subs) {
    ws.send(msg);
  }
}

export function sendToUser(userId: string, event: string, data: any) {
  const sockets = getClientSockets(userId);
  if ((sockets as Set<ServerWebSocket<WSData>>).size === 0) return;
  const msg = JSON.stringify({ event, data });
  for (const ws of sockets) {
    ws.send(msg);
  }
}

function getVoiceParticipants(channelId: string): VoiceParticipant[] {
  const participants = voiceChannels.get(channelId);
  return participants ? Array.from(participants.values()) : [];
}

function removeUserFromVoice(userId: string) {
  const channelId = userVoiceChannel.get(userId);
  if (!channelId) return;

  const participants = voiceChannels.get(channelId);
  if (participants) {
    const entry = participants.get(userId);
    if (entry?.isScreenSharing) {
      broadcastToChannel(channelId, "voice:screen-share-stopped", { userId, channelId });
    }
    participants.delete(userId);
    if (participants.size === 0) {
      voiceChannels.delete(channelId);
    }
  }
  userVoiceChannel.delete(userId);

  broadcastToChannel(channelId, "voice:user-left", { userId, channelId });
}

export async function authenticateWS(token: string): Promise<string | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, token))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.userId;
}

async function subscribeToUserChannels(ws: ServerWebSocket<WSData>, userId: string) {
  const userMembers = await db
    .select()
    .from(members)
    .where(eq(members.userId, userId));

  if (userMembers.length === 0) return;

  const serverIds = userMembers.map((m) => m.serverId);

  for (const serverId of serverIds) {
    subscribeToServer(ws, serverId);
  }

  // Batch query: fetch all channels for all servers at once instead of N+1 queries
  const allChannels = await db
    .select()
    .from(channels)
    .where(inArray(channels.serverId, serverIds));

  for (const channel of allChannels) {
    subscribeToChannel(ws, channel.id);
  }
}

// Event handler map for O(1) dispatch instead of switch chain
type EventHandler = (ws: ServerWebSocket<WSData>, data: any) => Promise<void> | void;

const eventHandlers: Record<string, EventHandler> = {
  "message:send": async (ws, data) => {
    // Validate channelId exists and is a string
    if (!data.channelId || typeof data.channelId !== 'string') {
      ws.send(JSON.stringify({ event: "error", data: { message: "Invalid channel ID" } }));
      return;
    }

    // Validate message content using shared schema
    const parsed = sendMessageSchema.safeParse({
      content: data.content,
      attachments: data.attachments,
      replyToId: data.replyToId,
    });
    if (!parsed.success) {
      ws.send(JSON.stringify({ event: "error", data: { message: "Invalid message format" } }));
      return;
    }

    const channelId = data.channelId;
    const { content, attachments, replyToId } = parsed.data;

    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) return;

    const [member] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, ws.data.userId),
          eq(members.serverId, channel.serverId)
        )
      )
      .limit(1);

    if (!member) return;

    const [newMessage] = await db
      .insert(messages)
      .values({
        channelId,
        authorId: ws.data.userId,
        content,
        attachments: attachments ? JSON.stringify(attachments) : null,
        replyToId,
      })
      .returning();

    const [author] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isBot: users.isBot,
      })
      .from(users)
      .where(eq(users.id, ws.data.userId))
      .limit(1);

    broadcastToChannel(channelId, "message:new", {
      ...newMessage,
      author,
    });

    handleBotMentions(channelId, channel.serverId, content, ws.data.userId).catch(console.error);
  },

  "typing:start": async (ws, data) => {
    const { channelId } = data;
    if (!channelId || !ws.data.subscribedChannels.has(channelId)) return;
    const [typingUser] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, ws.data.userId))
      .limit(1);
    broadcastToChannel(channelId, "typing:update", {
      userId: ws.data.userId,
      username: typingUser?.displayName ?? typingUser?.username ?? "Unknown",
      channelId,
    });
  },

  "presence:update": async (ws, data) => {
    const validStatuses = ['online', 'offline', 'idle', 'dnd'];
    if (!data.status || !validStatuses.includes(data.status)) return;
    const { status } = data;
    await db
      .update(users)
      .set({ status })
      .where(eq(users.id, ws.data.userId));

    // Serialize once, send to all relevant server subscribers
    const msg = JSON.stringify({
      event: "presence:update",
      data: { userId: ws.data.userId, status },
    });
    for (const serverId of ws.data.subscribedServers) {
      const subs = serverSubscribers.get(serverId);
      if (subs) {
        for (const sub of subs) {
          sub.send(msg);
        }
      }
    }
  },

  "voice:join": async (ws, data) => {
    const { channelId } = data;

    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel || channel.type !== "voice") return;

    const [member] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, ws.data.userId),
          eq(members.serverId, channel.serverId)
        )
      )
      .limit(1);

    if (!member) return;

    // Remove from any existing voice channel first
    removeUserFromVoice(ws.data.userId);

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, ws.data.userId))
      .limit(1);

    const participant: VoiceParticipant = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isMuted: false,
      isDeafened: false,
      isScreenSharing: false,
    };

    let channelParticipants = voiceChannels.get(channelId);
    if (!channelParticipants) {
      channelParticipants = new Map();
      voiceChannels.set(channelId, channelParticipants);
    }
    channelParticipants.set(ws.data.userId, participant);
    userVoiceChannel.set(ws.data.userId, channelId);

    // Send full state to the joining user
    sendToUser(ws.data.userId, "voice:state", {
      channelId,
      participants: getVoiceParticipants(channelId),
    });

    // Broadcast to channel that a new user joined
    broadcastToChannel(channelId, "voice:user-joined", {
      channelId,
      participant,
    });
  },

  "voice:leave": (ws) => {
    removeUserFromVoice(ws.data.userId);
  },

  "voice:offer": (ws, data) => {
    if (!data.targetUserId || !data.sdp) return;
    const senderChannel = userVoiceChannel.get(ws.data.userId);
    const targetChannel = userVoiceChannel.get(data.targetUserId);
    if (!senderChannel || senderChannel !== targetChannel) return;
    sendToUser(data.targetUserId, "voice:offer", {
      fromUserId: ws.data.userId,
      sdp: data.sdp,
    });
  },

  "voice:answer": (ws, data) => {
    if (!data.targetUserId || !data.sdp) return;
    const senderChannel = userVoiceChannel.get(ws.data.userId);
    const targetChannel = userVoiceChannel.get(data.targetUserId);
    if (!senderChannel || senderChannel !== targetChannel) return;
    sendToUser(data.targetUserId, "voice:answer", {
      fromUserId: ws.data.userId,
      sdp: data.sdp,
    });
  },

  "voice:ice-candidate": (ws, data) => {
    if (!data.targetUserId || !data.candidate) return;
    const senderChannel = userVoiceChannel.get(ws.data.userId);
    const targetChannel = userVoiceChannel.get(data.targetUserId);
    if (!senderChannel || senderChannel !== targetChannel) return;
    sendToUser(data.targetUserId, "voice:ice-candidate", {
      fromUserId: ws.data.userId,
      candidate: data.candidate,
    });
  },

  "voice:mute": (ws, data) => {
    if (typeof data.isMuted !== 'boolean' || typeof data.isDeafened !== 'boolean') return;
    const { isMuted, isDeafened } = data;
    const voiceChannelId = userVoiceChannel.get(ws.data.userId);
    if (!voiceChannelId) return;

    const participants = voiceChannels.get(voiceChannelId);
    if (!participants) return;

    const entry = participants.get(ws.data.userId);
    if (!entry) return;

    entry.isMuted = isMuted;
    entry.isDeafened = isDeafened;

    broadcastToChannel(voiceChannelId, "voice:mute", {
      userId: ws.data.userId,
      isMuted,
      isDeafened,
    });
  },

  "voice:screen-share-start": (ws) => {
    const voiceChannelId = userVoiceChannel.get(ws.data.userId);
    if (!voiceChannelId) return;

    const participants = voiceChannels.get(voiceChannelId);
    if (!participants) return;

    // Only one screen share at a time per channel
    for (const [, p] of participants) {
      if (p.isScreenSharing && p.userId !== ws.data.userId) {
        ws.send(JSON.stringify({ event: "error", data: { message: "Someone is already sharing their screen" } }));
        return;
      }
    }

    const entry = participants.get(ws.data.userId);
    if (!entry) return;

    entry.isScreenSharing = true;

    broadcastToChannel(voiceChannelId, "voice:screen-share-started", {
      userId: ws.data.userId,
      channelId: voiceChannelId,
    });
  },

  "voice:screen-share-stop": (ws) => {
    const voiceChannelId = userVoiceChannel.get(ws.data.userId);
    if (!voiceChannelId) return;

    const participants = voiceChannels.get(voiceChannelId);
    if (!participants) return;

    const entry = participants.get(ws.data.userId);
    if (!entry) return;

    entry.isScreenSharing = false;

    broadcastToChannel(voiceChannelId, "voice:screen-share-stopped", {
      userId: ws.data.userId,
      channelId: voiceChannelId,
    });
  },
};

export const websocketHandler = {
  async open(ws: ServerWebSocket<WSData>) {
    // Validate token passed from HTTP upgrade phase
    const token = ws.data.token;
    if (!token) {
      ws.send(ERROR_NOT_AUTHENTICATED);
      ws.close();
      return;
    }

    const userId = await authenticateWS(token);
    if (!userId) {
      ws.send(ERROR_INVALID_TOKEN);
      ws.close();
      return;
    }

    ws.data.userId = userId;

    if (!addClient(userId, ws)) {
      ws.send(JSON.stringify({ event: "error", data: { message: "Too many connections" } }));
      ws.close();
      return;
    }

    await subscribeToUserChannels(ws, userId);

    await db
      .update(users)
      .set({ status: "online" })
      .where(eq(users.id, userId));

    ws.send(JSON.stringify({ event: "auth:success", data: { userId } }));

    const presenceMsg = JSON.stringify({
      event: "presence:update",
      data: { userId, status: "online" },
    });
    for (const serverId of ws.data.subscribedServers) {
      const subs = serverSubscribers.get(serverId);
      if (subs) {
        for (const sub of subs) {
          sub.send(presenceMsg);
        }
      }
    }
  },

  async message(ws: ServerWebSocket<WSData>, message: string | Buffer) {
    try {
      const payload = JSON.parse(String(message));

      // Handle authentication
      if (payload.event === "auth") {
        // If already authenticated via upgrade, skip re-auth
        if (ws.data.userId) {
          ws.send(JSON.stringify({ event: "auth:success", data: { userId: ws.data.userId } }));
          return;
        }

        const userId = await authenticateWS(payload.data.token);
        if (!userId) {
          ws.send(ERROR_INVALID_TOKEN);
          ws.close();
          return;
        }

        ws.data.userId = userId;
        if (!addClient(userId, ws)) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Too many connections" } }));
          ws.close();
          return;
        }
        await subscribeToUserChannels(ws, userId);

        // Update user status to online
        await db
          .update(users)
          .set({ status: "online" })
          .where(eq(users.id, userId));

        ws.send(JSON.stringify({ event: "auth:success", data: { userId } }));

        // Broadcast presence to subscribed servers - serialize once
        const presenceMsg = JSON.stringify({
          event: "presence:update",
          data: { userId, status: "online" },
        });
        for (const serverId of ws.data.subscribedServers) {
          const subs = serverSubscribers.get(serverId);
          if (subs) {
            for (const sub of subs) {
              sub.send(presenceMsg);
            }
          }
        }
        return;
      }

      // All other events require authentication
      if (!ws.data.userId) {
        ws.send(ERROR_NOT_AUTHENTICATED);
        return;
      }

      const handler = eventHandlers[payload.event];
      if (handler) {
        await handler(ws, payload.data);
      }
    } catch (err) {
      ws.send(ERROR_INVALID_FORMAT);
    }
  },

  async close(ws: ServerWebSocket<WSData>) {
    if (ws.data.userId) {
      // Capture subscriptions before removeClient clears the reverse indexes
      const subscribedServers = ws.data.subscribedServers;

      removeClient(ws.data.userId, ws);

      // Only set offline and leave voice if no other connections
      if (!connectedClients.has(ws.data.userId)) {
        removeUserFromVoice(ws.data.userId);

        await db
          .update(users)
          .set({ status: "offline" })
          .where(eq(users.id, ws.data.userId));

        // Serialize once, send to all relevant server subscribers
        const offlineMsg = JSON.stringify({
          event: "presence:update",
          data: { userId: ws.data.userId, status: "offline" },
        });
        for (const serverId of subscribedServers) {
          const subs = serverSubscribers.get(serverId);
          if (subs) {
            for (const sub of subs) {
              sub.send(offlineMsg);
            }
          }
        }
      }
    }
  },
};

// Expose internals for testing
export const _testing = {
  connectedClients,
  channelSubscribers,
  serverSubscribers,
  voiceChannels,
  userVoiceChannel,
  addClient,
  removeClient,
  subscribeToChannel,
  eventHandlers,
};
