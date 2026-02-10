import { create } from 'zustand';
import type { User } from '@quarrel/shared';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
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
    if (res.token) localStorage.setItem('auth-token', JSON.stringify(res.token));
    set({ user: res.user, token: res.token });
    analytics.identify(res.user.id, { username: res.user.username, email: res.user.email });
    analytics.capture('auth:login');
  },
  register: async (username, email, password) => {
    const res = await api.register(username, email, password);
    if (res.token) localStorage.setItem('auth-token', JSON.stringify(res.token));
    set({ user: res.user, token: res.token });
    analytics.identify(res.user.id, { username: res.user.username, email: res.user.email });
    analytics.capture('auth:register');
  },
  logout: async () => {
    useVoiceStore.getState().cleanup();
    await api.logout();
    localStorage.removeItem('auth-token');
    set({ user: null, token: null });
    analytics.capture('auth:logout');
    analytics.reset();
  },
  fetchUser: async () => {
    try {
      const res = await api.me();
      if (res.token) localStorage.setItem('auth-token', JSON.stringify(res.token));
      set({ user: res.user, token: res.token ?? null, loading: false });
      if (res.user) {
        analytics.identify(res.user.id, { username: res.user.username, email: res.user.email });
      }
    } catch {
      set({ user: null, token: null, loading: false });
    }
  },
}));
