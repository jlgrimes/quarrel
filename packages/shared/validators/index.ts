import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(6),
});

export const createServerSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  iconUrl: z.string().url().optional(),
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
