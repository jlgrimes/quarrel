import { create } from 'zustand';
import type { User } from '@quarrel/shared';
import { api } from '../lib/api';
import { wsClient } from '../lib/ws';

type AuthStore = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  login: async (email, password) => {
    const res = await api.login(email, password);
    wsClient.setToken(res.token);
    wsClient.connect();
    set({ user: res.user });
  },
  register: async (username, email, password) => {
    const res = await api.register(username, email, password);
    wsClient.setToken(res.token);
    wsClient.connect();
    set({ user: res.user });
  },
  logout: async () => {
    await api.logout();
    wsClient.disconnect();
    wsClient.setToken(null);
    set({ user: null });
  },
  fetchUser: async () => {
    try {
      const res = await api.me();
      wsClient.setToken(res.token);
      wsClient.connect();
      set({ user: res.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
