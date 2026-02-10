import { create } from 'zustand';
import type { User } from '@quarrel/shared';
import { api } from '../lib/api';

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
    await api.login(email, password);
    const user = await api.me();
    set({ user });
  },
  register: async (username, email, password) => {
    await api.register(username, email, password);
    const user = await api.me();
    set({ user });
  },
  logout: async () => {
    await api.logout();
    set({ user: null });
  },
  fetchUser: async () => {
    try {
      const user = await api.me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
