// --- Enums / Union Types ---

export type UserStatus = 'online' | 'offline' | 'idle' | 'dnd';
export type ChannelType = 'text' | 'voice' | 'category';
export type FriendStatus = 'pending' | 'accepted' | 'blocked';

// --- Core Domain Types ---

export type User = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  customStatus: string | null;
  createdAt: string;
};

export type Server = {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
};

export type Channel = {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  topic: string | null;
  categoryId: string | null;
  position: number;
  createdAt: string;
};

export type Member = {
  id: string;
  userId: string;
  serverId: string;
  nickname: string | null;
  joinedAt: string;
  user?: User;
};

export type Role = {
  id: string;
  serverId: string;
  name: string;
  color: string | null;
  permissions: number;
  position: number;
  createdAt: string;
};

export type Message = {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  editedAt: string | null;
  attachments: string[];
  replyToId: string | null;
  createdAt: string;
  deleted: boolean;
  author?: User;
};

export type Reaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
};

export type Conversation = {
  id: string;
  createdAt: string;
  members?: User[];
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  authorId: string;
  content: string;
  attachments: string[];
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  author?: User;
};

export type Friend = {
  id: string;
  userId: string;
  friendId: string;
  status: FriendStatus;
  createdAt: string;
  user?: User;
  friend?: User;
};

// --- WebSocket Event Types ---

export type WSClientEvents =
  | 'message:send'
  | 'message:edit'
  | 'message:delete'
  | 'message:react'
  | 'typing:start'
  | 'presence:update'
  | 'voice:join'
  | 'voice:leave';

export type WSServerEvents =
  | 'message:new'
  | 'message:updated'
  | 'message:deleted'
  | 'reaction:updated'
  | 'typing:update'
  | 'presence:update'
  | 'member:joined'
  | 'member:left'
  | 'channel:created'
  | 'channel:updated'
  | 'channel:deleted';

// --- WebSocket Payload Types ---

export type MessageSendPayload = {
  channelId: string;
  content: string;
  attachments?: string[];
  replyToId?: string;
};

export type MessageEditPayload = {
  messageId: string;
  content: string;
};

export type MessageDeletePayload = {
  messageId: string;
};

export type MessageReactPayload = {
  messageId: string;
  emoji: string;
};

export type TypingStartPayload = {
  channelId: string;
};

export type PresenceUpdatePayload = {
  status: UserStatus;
};

export type VoiceJoinPayload = {
  channelId: string;
};

export type VoiceLeavePayload = {
  channelId: string;
};
