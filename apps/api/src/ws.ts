import type { ServerWebSocket } from "bun";
import { db, sessions, members, channels, users, messages } from "@quarrel/db";
import { eq, and } from "drizzle-orm";

type WSData = {
  userId: string;
  subscribedChannels: Set<string>;
  subscribedServers: Set<string>;
};

const connectedClients = new Map<string, Set<ServerWebSocket<WSData>>>();

// Voice state: which users are in which voice channels
const voiceChannels = new Map<string, Map<string, { userId: string; username: string; displayName: string | null; avatarUrl: string | null; isMuted: boolean; isDeafened: boolean }>>();
const userVoiceChannel = new Map<string, string>();

function getClientSockets(userId: string): Set<ServerWebSocket<WSData>> {
  return connectedClients.get(userId) || new Set();
}

function addClient(userId: string, ws: ServerWebSocket<WSData>) {
  if (!connectedClients.has(userId)) {
    connectedClients.set(userId, new Set());
  }
  connectedClients.get(userId)!.add(ws);
}

function removeClient(userId: string, ws: ServerWebSocket<WSData>) {
  const sockets = connectedClients.get(userId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      connectedClients.delete(userId);
    }
  }
}

export function broadcastToChannel(channelId: string, event: string, data: any) {
  for (const [, sockets] of connectedClients) {
    for (const ws of sockets) {
      if (ws.data.subscribedChannels.has(channelId)) {
        ws.send(JSON.stringify({ event, data }));
      }
    }
  }
}

export function broadcastToServer(serverId: string, event: string, data: any) {
  for (const [, sockets] of connectedClients) {
    for (const ws of sockets) {
      if (ws.data.subscribedServers.has(serverId)) {
        ws.send(JSON.stringify({ event, data }));
      }
    }
  }
}

export function sendToUser(userId: string, event: string, data: any) {
  const sockets = getClientSockets(userId);
  for (const ws of sockets) {
    ws.send(JSON.stringify({ event, data }));
  }
}

function getVoiceParticipants(channelId: string) {
  const participants = voiceChannels.get(channelId);
  return participants ? Array.from(participants.values()) : [];
}

function removeUserFromVoice(userId: string) {
  const channelId = userVoiceChannel.get(userId);
  if (!channelId) return;

  const participants = voiceChannels.get(channelId);
  if (participants) {
    participants.delete(userId);
    if (participants.size === 0) {
      voiceChannels.delete(channelId);
    }
  }
  userVoiceChannel.delete(userId);

  broadcastToChannel(channelId, "voice:user-left", { userId, channelId });
}

async function authenticateWS(token: string): Promise<string | null> {
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

  for (const member of userMembers) {
    ws.data.subscribedServers.add(member.serverId);

    const serverChannels = await db
      .select()
      .from(channels)
      .where(eq(channels.serverId, member.serverId));

    for (const channel of serverChannels) {
      ws.data.subscribedChannels.add(channel.id);
    }
  }
}

export const websocketHandler = {
  async open(ws: ServerWebSocket<WSData>) {
    // Client must send auth message first
  },

  async message(ws: ServerWebSocket<WSData>, message: string | Buffer) {
    try {
      const payload = JSON.parse(String(message));

      // Handle authentication
      if (payload.event === "auth") {
        const userId = await authenticateWS(payload.data.token);
        if (!userId) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Invalid token" } }));
          ws.close();
          return;
        }

        ws.data.userId = userId;
        addClient(userId, ws);
        await subscribeToUserChannels(ws, userId);

        // Update user status to online
        await db
          .update(users)
          .set({ status: "online" })
          .where(eq(users.id, userId));

        ws.send(JSON.stringify({ event: "auth:success", data: { userId } }));

        // Broadcast presence to subscribed servers
        for (const serverId of ws.data.subscribedServers) {
          broadcastToServer(serverId, "presence:update", {
            userId,
            status: "online",
          });
        }
        return;
      }

      // All other events require authentication
      if (!ws.data.userId) {
        ws.send(JSON.stringify({ event: "error", data: { message: "Not authenticated" } }));
        return;
      }

      switch (payload.event) {
        case "message:send": {
          const { channelId, content, attachments, replyToId } = payload.data;

          const [channel] = await db
            .select()
            .from(channels)
            .where(eq(channels.id, channelId))
            .limit(1);

          if (!channel) break;

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

          if (!member) break;

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
            })
            .from(users)
            .where(eq(users.id, ws.data.userId))
            .limit(1);

          broadcastToChannel(channelId, "message:new", {
            ...newMessage,
            author,
          });
          break;
        }

        case "typing:start": {
          const { channelId } = payload.data;
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
          break;
        }

        case "presence:update": {
          const { status } = payload.data;
          await db
            .update(users)
            .set({ status })
            .where(eq(users.id, ws.data.userId));

          for (const serverId of ws.data.subscribedServers) {
            broadcastToServer(serverId, "presence:update", {
              userId: ws.data.userId,
              status,
            });
          }
          break;
        }

        case "voice:join": {
          const { channelId } = payload.data;

          const [channel] = await db
            .select()
            .from(channels)
            .where(eq(channels.id, channelId))
            .limit(1);

          if (!channel || channel.type !== "voice") break;

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

          if (!member) break;

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

          const participant = {
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isMuted: false,
            isDeafened: false,
          };

          if (!voiceChannels.has(channelId)) {
            voiceChannels.set(channelId, new Map());
          }
          voiceChannels.get(channelId)!.set(ws.data.userId, participant);
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
          break;
        }

        case "voice:leave": {
          removeUserFromVoice(ws.data.userId);
          break;
        }

        case "voice:offer": {
          sendToUser(payload.data.targetUserId, "voice:offer", {
            fromUserId: ws.data.userId,
            sdp: payload.data.sdp,
          });
          break;
        }

        case "voice:answer": {
          sendToUser(payload.data.targetUserId, "voice:answer", {
            fromUserId: ws.data.userId,
            sdp: payload.data.sdp,
          });
          break;
        }

        case "voice:ice-candidate": {
          sendToUser(payload.data.targetUserId, "voice:ice-candidate", {
            fromUserId: ws.data.userId,
            candidate: payload.data.candidate,
          });
          break;
        }

        case "voice:mute": {
          const { isMuted, isDeafened } = payload.data;
          const voiceChannelId = userVoiceChannel.get(ws.data.userId);
          if (!voiceChannelId) break;

          const participants = voiceChannels.get(voiceChannelId);
          if (!participants) break;

          const entry = participants.get(ws.data.userId);
          if (!entry) break;

          entry.isMuted = isMuted;
          entry.isDeafened = isDeafened;

          broadcastToChannel(voiceChannelId, "voice:mute", {
            userId: ws.data.userId,
            isMuted,
            isDeafened,
          });
          break;
        }
      }
    } catch (err) {
      ws.send(
        JSON.stringify({ event: "error", data: { message: "Invalid message format" } })
      );
    }
  },

  async close(ws: ServerWebSocket<WSData>) {
    if (ws.data.userId) {
      removeClient(ws.data.userId, ws);

      // Only set offline and leave voice if no other connections
      if (!connectedClients.has(ws.data.userId)) {
        removeUserFromVoice(ws.data.userId);

        await db
          .update(users)
          .set({ status: "offline" })
          .where(eq(users.id, ws.data.userId));

        for (const serverId of ws.data.subscribedServers) {
          broadcastToServer(serverId, "presence:update", {
            userId: ws.data.userId,
            status: "offline",
          });
        }
      }
    }
  },
};
