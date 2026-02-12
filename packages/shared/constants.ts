export const PERMISSIONS = {
  ADMINISTRATOR: 1 << 0,
  MANAGE_SERVER: 1 << 1,
  MANAGE_CHANNELS: 1 << 2,
  MANAGE_ROLES: 1 << 3,
  KICK_MEMBERS: 1 << 4,
  BAN_MEMBERS: 1 << 5,
  SEND_MESSAGES: 1 << 6,
  MANAGE_MESSAGES: 1 << 7,
  ATTACH_FILES: 1 << 8,
  ADD_REACTIONS: 1 << 9,
  CONNECT_VOICE: 1 << 10,
  SPEAK: 1 << 11,
} as const;

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_SERVER_NAME_LENGTH = 100;
export const MAX_CHANNEL_NAME_LENGTH = 100;
export const MAX_USERNAME_LENGTH = 32;
export const MESSAGE_BATCH_SIZE = 50;

export const MAX_AVATAR_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

export const RESERVED_USERNAMES = ["claude", "chatgpt", "gemini"] as const;

export const AUDIT_LOG_ACTIONS = {
  MEMBER_KICK: 'member.kick',
  MEMBER_BAN: 'member.ban',
  MEMBER_UNBAN: 'member.unban',
  MEMBER_TIMEOUT: 'member.timeout',
  MEMBER_TIMEOUT_REMOVE: 'member.timeout_remove',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  CHANNEL_CREATE: 'channel.create',
  CHANNEL_UPDATE: 'channel.update',
  CHANNEL_DELETE: 'channel.delete',
  INVITE_CREATE: 'invite.create',
  INVITE_DELETE: 'invite.delete',
  SERVER_UPDATE: 'server.update',
} as const;
