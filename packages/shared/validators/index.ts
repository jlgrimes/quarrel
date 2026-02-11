import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(8),
});

export const createServerSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  iconUrl: z.string().url().optional(),
  description: z.string().max(1000).optional(),
});

export const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['text', 'voice', 'category']).default('text'),
  categoryId: z.string().optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  topic: z.string().max(1024).optional(),
  position: z.number().int().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  attachments: z.array(z.string()).optional(),
  replyToId: z.string().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(32).optional(),
  avatarUrl: z.string().url().optional(),
  customStatus: z.string().max(128).optional(),
  bio: z.string().max(190).optional(),
  bannerUrl: z.string().url().optional(),
  pronouns: z.string().max(50).optional(),
});

export const updateNicknameSchema = z.object({
  nickname: z.string().max(32).nullable(),
});

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
  permissions: z.number().int().default(0),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  permissions: z.number().int().optional(),
});

export const avatarPresignSchema = z.object({
  contentType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  contentLength: z.number().int().positive().max(8 * 1024 * 1024),
});

export const createGroupConversationSchema = z.object({
  userIds: z.array(z.string()).min(2).max(9),
  name: z.string().min(1).max(100).optional(),
});

export const updateGroupConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  iconUrl: z.string().url().nullable().optional(),
});

export const createThreadSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
});

export const sendThreadMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  attachments: z.array(z.string()).optional(),
});

export const updateThreadMemberSchema = z.object({
  notifyPreference: z.enum(['all', 'mentions', 'none']),
});

export const updateUserSettingsSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  fontSize: z.enum(['small', 'normal', 'large']).optional(),
  compactMode: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  notificationSounds: z.boolean().optional(),
  allowDms: z.enum(['everyone', 'friends', 'none']).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export const timeoutMemberSchema = z.object({
  duration: z.number().int().min(60).max(2419200), // 1 min to 28 days
  reason: z.string().max(512).optional(),
});

export const bulkDeleteSchema = z.object({
  messageIds: z.array(z.string()).min(2).max(100),
});

export const createInviteSchema = z.object({
  maxAge: z.number().int().min(0).max(604800).optional(), // 0 = never, max 7 days in seconds
  maxUses: z.number().int().min(0).max(100).optional(), // 0 = unlimited
});

export const searchMessagesSchema = z.object({
  q: z.string().min(1).max(100),
  serverId: z.string().optional(),
  channelId: z.string().optional(),
  authorId: z.string().optional(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
