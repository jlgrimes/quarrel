import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotificationStore, _resetToastId } from '../../stores/notificationStore';

const mockCapture = vi.fn();

vi.mock('../../lib/analytics', () => ({
  analytics: {
    capture: (...args: any[]) => mockCapture(...args),
  },
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'user-1', username: 'testuser' },
    }),
}));

// Mock Notification constructor
const MockNotification = vi.fn();
Object.defineProperty(globalThis, 'Notification', {
  value: Object.assign(MockNotification, {
    permission: 'granted',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  }),
  writable: true,
  configurable: true,
});

import { useWebSocketNotifications } from '../../hooks/useNotifications';

beforeEach(() => {
  vi.clearAllMocks();
  _resetToastId();
  useNotificationStore.setState({
    enabled: true,
    soundEnabled: false, // Disable sound to avoid Audio mock issues
    desktopEnabled: true,
    browserPermission: 'granted',
    channelOverrides: {},
    toasts: [],
  });
  // Simulate page being visible
  Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
  // Simulate user not viewing the message channel
  Object.defineProperty(window, 'location', {
    value: { pathname: '/channels/@me' },
    writable: true,
    configurable: true,
  });
});

describe('useWebSocketNotifications', () => {
  it('creates toast for incoming DM', () => {
    const { rerender } = renderHook(
      ({ msg }) => useWebSocketNotifications(msg),
      {
        initialProps: { msg: null },
      },
    );

    rerender({
      msg: {
        event: 'message:new',
        data: {
          userId: 'other-user',
          channelId: 'dm-ch-1',
          content: 'Hey there!',
          user: { username: 'alice', displayName: 'Alice' },
        },
      },
    });

    const toasts = useNotificationStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].title).toBe('Alice');
    expect(toasts[0].body).toBe('Hey there!');
  });

  it('does not notify for own messages', () => {
    const { rerender } = renderHook(
      ({ msg }) => useWebSocketNotifications(msg),
      { initialProps: { msg: null } },
    );

    rerender({
      msg: {
        event: 'message:new',
        data: {
          userId: 'user-1',
          channelId: 'dm-ch-1',
          content: 'My own message',
          user: { username: 'testuser' },
        },
      },
    });

    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });

  it('does not notify when notifications are disabled', () => {
    useNotificationStore.setState({ enabled: false });

    const { rerender } = renderHook(
      ({ msg }) => useWebSocketNotifications(msg),
      { initialProps: { msg: null } },
    );

    rerender({
      msg: {
        event: 'message:new',
        data: {
          userId: 'other-user',
          channelId: 'dm-ch-1',
          content: 'Hello',
          user: { username: 'alice' },
        },
      },
    });

    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });

  it('does not notify for muted channel', () => {
    useNotificationStore.getState().setChannelOverride('dm-ch-1', 'muted');
    vi.clearAllMocks();

    const { rerender } = renderHook(
      ({ msg }) => useWebSocketNotifications(msg),
      { initialProps: { msg: null } },
    );

    rerender({
      msg: {
        event: 'message:new',
        data: {
          userId: 'other-user',
          channelId: 'dm-ch-1',
          content: 'Hello',
          user: { username: 'alice' },
        },
      },
    });

    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });

  it('creates toast for friend request', () => {
    const { rerender } = renderHook(
      ({ msg }) => useWebSocketNotifications(msg),
      { initialProps: { msg: null } },
    );

    rerender({
      msg: {
        event: 'friend:request',
        data: {
          user: { username: 'bob', displayName: 'Bob' },
        },
      },
    });

    const toasts = useNotificationStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].title).toBe('Friend Request');
    expect(toasts[0].body).toBe('Bob sent you a friend request');
  });

  it('captures notification:shown analytics', () => {
    const { rerender } = renderHook(
      ({ msg }) => useWebSocketNotifications(msg),
      { initialProps: { msg: null } },
    );

    rerender({
      msg: {
        event: 'message:new',
        data: {
          userId: 'other-user',
          channelId: 'dm-ch-1',
          content: 'Hey!',
          user: { username: 'alice' },
        },
      },
    });

    expect(mockCapture).toHaveBeenCalledWith('notification:shown', expect.objectContaining({
      type: 'dm',
    }));
  });

  it('sends desktop notification when page is hidden', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });

    const { rerender } = renderHook(
      ({ msg }) => useWebSocketNotifications(msg),
      { initialProps: { msg: null } },
    );

    rerender({
      msg: {
        event: 'message:new',
        data: {
          userId: 'other-user',
          channelId: 'dm-ch-1',
          content: 'Hey!',
          user: { username: 'alice', displayName: 'Alice' },
        },
      },
    });

    expect(MockNotification).toHaveBeenCalledWith('Alice', expect.objectContaining({
      body: 'Hey!',
    }));
  });
});
