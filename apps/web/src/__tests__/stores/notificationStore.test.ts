import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotificationStore, _resetToastId } from '../../stores/notificationStore';

const mockCapture = vi.fn();

vi.mock('../../lib/analytics', () => ({
  analytics: {
    capture: (...args: any[]) => mockCapture(...args),
  },
}));

// Mock Notification API
const mockRequestPermission = vi.fn();
Object.defineProperty(globalThis, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: mockRequestPermission,
  },
  writable: true,
  configurable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  _resetToastId();
  useNotificationStore.setState({
    enabled: true,
    soundEnabled: true,
    desktopEnabled: true,
    browserPermission: 'default',
    channelOverrides: {},
    toasts: [],
  });
});

describe('notificationStore', () => {
  describe('global preferences', () => {
    it('toggles enabled state', () => {
      useNotificationStore.getState().setEnabled(false);
      expect(useNotificationStore.getState().enabled).toBe(false);
      expect(mockCapture).toHaveBeenCalledWith('notification:toggle', { enabled: false });
    });

    it('toggles sound enabled', () => {
      useNotificationStore.getState().setSoundEnabled(false);
      expect(useNotificationStore.getState().soundEnabled).toBe(false);
      expect(mockCapture).toHaveBeenCalledWith('notification:sound_toggle', { soundEnabled: false });
    });

    it('toggles desktop enabled', () => {
      useNotificationStore.getState().setDesktopEnabled(false);
      expect(useNotificationStore.getState().desktopEnabled).toBe(false);
      expect(mockCapture).toHaveBeenCalledWith('notification:desktop_toggle', { desktopEnabled: false });
    });
  });

  describe('channel overrides', () => {
    it('sets and gets channel override', () => {
      useNotificationStore.getState().setChannelOverride('ch-1', 'mentions');
      expect(useNotificationStore.getState().getChannelLevel('ch-1')).toBe('mentions');
      expect(mockCapture).toHaveBeenCalledWith('notification:channel_override', {
        channelId: 'ch-1',
        level: 'mentions',
      });
    });

    it('defaults to all for unknown channels', () => {
      expect(useNotificationStore.getState().getChannelLevel('unknown')).toBe('all');
    });

    it('removes channel override', () => {
      useNotificationStore.getState().setChannelOverride('ch-1', 'muted');
      useNotificationStore.getState().removeChannelOverride('ch-1');
      expect(useNotificationStore.getState().getChannelLevel('ch-1')).toBe('all');
    });

    it('sets muted level', () => {
      useNotificationStore.getState().setChannelOverride('ch-1', 'muted');
      expect(useNotificationStore.getState().getChannelLevel('ch-1')).toBe('muted');
    });
  });

  describe('toasts', () => {
    it('adds a toast', () => {
      useNotificationStore.getState().addToast({
        title: 'New DM',
        body: 'Hello!',
        channelId: 'ch-1',
      });

      const toasts = useNotificationStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]).toMatchObject({
        id: 'toast-1',
        title: 'New DM',
        body: 'Hello!',
        channelId: 'ch-1',
      });
      expect(toasts[0].timestamp).toBeGreaterThan(0);
    });

    it('dismisses a toast', () => {
      useNotificationStore.getState().addToast({ title: 'Test', body: 'body' });
      expect(useNotificationStore.getState().toasts).toHaveLength(1);

      useNotificationStore.getState().dismissToast('toast-1');
      expect(useNotificationStore.getState().toasts).toHaveLength(0);
    });

    it('clears all toasts', () => {
      useNotificationStore.getState().addToast({ title: 'T1', body: 'b1' });
      useNotificationStore.getState().addToast({ title: 'T2', body: 'b2' });
      expect(useNotificationStore.getState().toasts).toHaveLength(2);

      useNotificationStore.getState().clearToasts();
      expect(useNotificationStore.getState().toasts).toHaveLength(0);
    });

    it('increments toast ids', () => {
      useNotificationStore.getState().addToast({ title: 'T1', body: 'b1' });
      useNotificationStore.getState().addToast({ title: 'T2', body: 'b2' });

      const toasts = useNotificationStore.getState().toasts;
      expect(toasts[0].id).toBe('toast-1');
      expect(toasts[1].id).toBe('toast-2');
    });
  });

  describe('browser permission', () => {
    it('requests browser permission', async () => {
      mockRequestPermission.mockResolvedValueOnce('granted');

      const result = await useNotificationStore.getState().requestBrowserPermission();

      expect(result).toBe('granted');
      expect(useNotificationStore.getState().browserPermission).toBe('granted');
      expect(mockCapture).toHaveBeenCalledWith('notification:permission_requested', {
        result: 'granted',
      });
    });

    it('handles denied permission', async () => {
      mockRequestPermission.mockResolvedValueOnce('denied');

      const result = await useNotificationStore.getState().requestBrowserPermission();

      expect(result).toBe('denied');
      expect(useNotificationStore.getState().browserPermission).toBe('denied');
    });
  });
});
