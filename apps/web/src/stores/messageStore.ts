import { create } from 'zustand';
import type { Message } from '@quarrel/shared';
import { api } from '../lib/api';

type MessageStore = {
  messages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  fetchMessages: (channelId: string) => Promise<void>;
  fetchMoreMessages: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string, replyToId?: string) => Promise<void>;
  addMessage: (channelId: string, message: Message) => void;
  updateMessage: (channelId: string, message: Message) => void;
  removeMessage: (channelId: string, messageId: string) => void;
};

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: {},
  hasMore: {},
  fetchMessages: async (channelId) => {
    const msgs = await api.getMessages(channelId);
    set({
      messages: { ...get().messages, [channelId]: msgs },
      hasMore: { ...get().hasMore, [channelId]: msgs.length >= 50 },
    });
  },
  fetchMoreMessages: async (channelId) => {
    const existing = get().messages[channelId] || [];
    if (!existing.length) return;
    const oldest = existing[0];
    const msgs = await api.getMessages(channelId, oldest.id);
    set({
      messages: { ...get().messages, [channelId]: [...msgs, ...existing] },
      hasMore: { ...get().hasMore, [channelId]: msgs.length >= 50 },
    });
  },
  sendMessage: async (channelId, content, replyToId) => {
    await api.sendMessage(channelId, content, replyToId);
  },
  addMessage: (channelId, message) => {
    const existing = get().messages[channelId] || [];
    set({ messages: { ...get().messages, [channelId]: [...existing, message] } });
  },
  updateMessage: (channelId, message) => {
    const existing = get().messages[channelId] || [];
    set({
      messages: {
        ...get().messages,
        [channelId]: existing.map((m) => (m.id === message.id ? message : m)),
      },
    });
  },
  removeMessage: (channelId, messageId) => {
    const existing = get().messages[channelId] || [];
    set({
      messages: {
        ...get().messages,
        [channelId]: existing.filter((m) => m.id !== messageId),
      },
    });
  },
}));
