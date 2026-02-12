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
  bio: string | null;
  bannerUrl: string | null;
  pronouns: string | null;
  isBot?: boolean;
  createdAt: string;
};

export type Server = {
  id: string;
  name: string;
  description: string | null;
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
  pinnedAt: string | null;
  pinnedBy: string | null;
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
  isGroup: boolean;
  name: string | null;
  iconUrl: string | null;
  ownerId: string | null;
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

export type UserSettings = {
  id: string;
  userId: string;
  theme: 'dark' | 'light';
  fontSize: 'small' | 'normal' | 'large';
  compactMode: boolean;
  notificationsEnabled: boolean;
  notificationSounds: boolean;
  allowDms: 'everyone' | 'friends' | 'none';
};

// --- AI Bot Types ---

export type AIProvider = "anthropic" | "openai" | "google";

export type ServerBot = {
  id: string;
  serverId: string;
  botUserId: string;
  provider: AIProvider;
  model: string;
  enabled: boolean;
  systemPrompt: string | null;
  createdAt: string;
  botUser?: User;
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
  | 'voice:leave'
  | 'voice:offer'
  | 'voice:answer'
  | 'voice:ice-candidate'
  | 'voice:mute'
  | 'voice:screen-share-start'
  | 'voice:screen-share-stop';

export type WSServerEvents =
  | 'message:new'
  | 'message:stream'
  | 'message:updated'
  | 'message:deleted'
  | 'message:pinned'
  | 'message:unpinned'
  | 'reaction:updated'
  | 'typing:update'
  | 'presence:update'
  | 'member:joined'
  | 'member:left'
  | 'channel:created'
  | 'channel:updated'
  | 'channel:deleted'
  | 'voice:user-joined'
  | 'voice:user-left'
  | 'voice:state'
  | 'voice:offer'
  | 'voice:answer'
  | 'voice:ice-candidate'
  | 'voice:mute'
  | 'voice:screen-share-started'
  | 'voice:screen-share-stopped';

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

export type VoiceParticipant = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing?: boolean;
};

export type VoiceOfferPayload = {
  targetUserId: string;
  sdp: RTCSessionDescriptionInit;
};

export type VoiceAnswerPayload = {
  targetUserId: string;
  sdp: RTCSessionDescriptionInit;
};

export type VoiceIceCandidatePayload = {
  targetUserId: string;
  candidate: RTCIceCandidateInit;
};

export type VoiceMutePayload = {
  isMuted: boolean;
  isDeafened: boolean;
};
