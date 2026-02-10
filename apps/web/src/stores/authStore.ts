import { create } from 'zustand';
import type { User } from '@quarrel/shared';
import { api } from '../lib/api';
import { useVoiceStore } from './voiceStore';

type AuthStore = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  loading: true,
  login: async (email, password) => {
    const res = await api.login(email, password);
    set({ user: res.user, token: res.token });
  },
  register: async (username, email, password) => {
    const res = await api.register(username, email, password);
    set({ user: res.user, token: res.token });
  },
  logout: async () => {
    useVoiceStore.getState().cleanup();
    await api.logout();
    set({ user: null, token: null });
  },
  fetchUser: async () => {
    try {
      const res = await api.me();
      set({ user: res.user, token: res.token, loading: false });
    } catch {
      set({ user: null, token: null, loading: false });
    }
  },
}));
