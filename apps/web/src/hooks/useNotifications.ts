import { useEffect, useCallback } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { analytics } from '../lib/analytics';

type NotifiableEvent = {
  type: 'dm' | 'mention' | 'friend_request';
  title: string;
  body: string;
  channelId?: string;
  serverId?: string;
};

export function useNotifications() {
  const enabled = useNotificationStore((s) => s.enabled);
  const desktopEnabled = useNotificationStore((s) => s.desktopEnabled);
  const browserPermission = useNotificationStore((s) => s.browserPermission);
  const addToast = useNotificationStore((s) => s.addToast);
  const playSound = useNotificationStore((s) => s.playSound);
  const getChannelLevel = useNotificationStore((s) => s.getChannelLevel);

  // Request browser permission on mount if not yet decided
  useEffect(() => {
    if (desktopEnabled && browserPermission === 'default') {
      useNotificationStore.getState().requestBrowserPermission();
    }
  }, [desktopEnabled, browserPermission]);

  const notify = useCallback(
    (event: NotifiableEvent) => {
      if (!enabled) return;

      // Check channel-level override
      if (event.channelId) {
        const level = getChannelLevel(event.channelId);
        if (level === 'muted') return;
        if (level === 'mentions' && event.type === 'dm') return;
      }

      // In-app toast
      addToast({
        title: event.title,
        body: event.body,
        channelId: event.channelId,
        serverId: event.serverId,
      });

      // Sound
      playSound();

      // Desktop notification (only if page is not focused)
      if (desktopEnabled && browserPermission === 'granted' && document.hidden) {
        try {
          new Notification(event.title, {
            body: event.body,
            icon: '/quarrel-icon.png',
            tag: event.channelId || 'quarrel',
          });
        } catch {
          // Notification API not available
        }
      }

      analytics.capture('notification:shown', {
        type: event.type,
        desktop: desktopEnabled && browserPermission === 'granted' && document.hidden,
      });
    },
    [enabled, desktopEnabled, browserPermission, addToast, playSound, getChannelLevel],
  );

  return { notify };
}

/**
 * Hook to process WebSocket events and trigger notifications.
 * Should be called once in the app layout alongside useWebSocketEvents.
 */
export function useWebSocketNotifications(lastJsonMessage: unknown) {
  const { notify } = useNotifications();
  const currentUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!lastJsonMessage || !currentUserId) return;
    const { event, data } = lastJsonMessage as { event: string; data: any };

    switch (event) {
      case 'message:new': {
        const msg = data;
        // Don't notify for own messages
        if (msg.userId === currentUserId) return;

        // Check if user is currently viewing this channel
        const path = window.location.pathname;
        const channelMatch = path.match(/\/channels\/[^/]+\/([^/]+)/);
        const dmMatch = path.match(/\/channels\/@me\/([^/]+)/);
        const isViewing =
          (dmMatch && dmMatch[1] === msg.channelId) ||
          (channelMatch && channelMatch[1] === msg.channelId);
        if (isViewing && !document.hidden) return;

        // Check if it's a DM
        const isDM = path.includes('/@me') || !msg.serverId;

        // Check for @mention
        const isMention =
          msg.content?.includes(`@${currentUserId}`) ||
          msg.content?.includes('@everyone');

        const senderName = msg.user?.displayName || msg.user?.username || 'Someone';

        if (isDM || !msg.serverId) {
          notify({
            type: 'dm',
            title: `${senderName}`,
            body: msg.content?.substring(0, 100) || 'Sent a message',
            channelId: msg.channelId,
          });
        } else if (isMention) {
          notify({
            type: 'mention',
            title: `${senderName} mentioned you`,
            body: msg.content?.substring(0, 100) || '',
            channelId: msg.channelId,
            serverId: msg.serverId,
          });
        }
        break;
      }

      case 'friend:request': {
        const senderName = data.user?.displayName || data.user?.username || 'Someone';
        notify({
          type: 'friend_request',
          title: 'Friend Request',
          body: `${senderName} sent you a friend request`,
        });
        break;
      }
    }
  }, [lastJsonMessage, currentUserId, notify]);
}
