import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { analytics } from '../lib/analytics';

export type NotificationLevel = 'all' | 'mentions' | 'muted';

export type Toast = {
  id: string;
  title: string;
  body: string;
  channelId?: string;
  serverId?: string;
  timestamp: number;
};

type NotificationStore = {
  // Global preferences (persisted)
  enabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  browserPermission: NotificationPermission;

  // Per-channel notification level overrides
  channelOverrides: Record<string, NotificationLevel>;

  // Toast queue (not persisted)
  toasts: Toast[];

  // Actions
  setEnabled: (enabled: boolean) => void;
  setSoundEnabled: (soundEnabled: boolean) => void;
  setDesktopEnabled: (desktopEnabled: boolean) => void;
  setBrowserPermission: (permission: NotificationPermission) => void;
  setChannelOverride: (channelId: string, level: NotificationLevel) => void;
  removeChannelOverride: (channelId: string) => void;
  getChannelLevel: (channelId: string) => NotificationLevel;
  requestBrowserPermission: () => Promise<NotificationPermission>;
  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  playSound: () => void;
};

let nextToastId = 1;

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      enabled: true,
      soundEnabled: true,
      desktopEnabled: true,
      browserPermission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
      channelOverrides: {},
      toasts: [],

      setEnabled: (enabled) => {
        set({ enabled });
        analytics.capture('notification:toggle', { enabled });
      },

      setSoundEnabled: (soundEnabled) => {
        set({ soundEnabled });
        analytics.capture('notification:sound_toggle', { soundEnabled });
      },

      setDesktopEnabled: (desktopEnabled) => {
        set({ desktopEnabled });
        analytics.capture('notification:desktop_toggle', { desktopEnabled });
      },

      setBrowserPermission: (permission) => set({ browserPermission: permission }),

      setChannelOverride: (channelId, level) => {
        set((state) => ({
          channelOverrides: { ...state.channelOverrides, [channelId]: level },
        }));
        analytics.capture('notification:channel_override', { channelId, level });
      },

      removeChannelOverride: (channelId) => {
        set((state) => {
          const { [channelId]: _, ...rest } = state.channelOverrides;
          return { channelOverrides: rest };
        });
      },

      getChannelLevel: (channelId) => {
        return get().channelOverrides[channelId] ?? 'all';
      },

      requestBrowserPermission: async () => {
        if (typeof Notification === 'undefined') return 'denied';
        const permission = await Notification.requestPermission();
        set({ browserPermission: permission });
        analytics.capture('notification:permission_requested', { result: permission });
        return permission;
      },

      addToast: (toast) => {
        const id = `toast-${nextToastId++}`;
        const newToast: Toast = { ...toast, id, timestamp: Date.now() };
        set((state) => ({ toasts: [...state.toasts, newToast] }));

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          get().dismissToast(id);
        }, 5000);
      },

      dismissToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      clearToasts: () => set({ toasts: [] }),

      playSound: () => {
        if (!get().soundEnabled) return;
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {
          // Audio not available
        }
      },
    }),
    {
      name: 'quarrel-notifications',
      partialize: (state) => ({
        enabled: state.enabled,
        soundEnabled: state.soundEnabled,
        desktopEnabled: state.desktopEnabled,
        channelOverrides: state.channelOverrides,
      }),
    },
  ),
);

// Reset toast id for testing
export function _resetToastId() {
  nextToastId = 1;
}
