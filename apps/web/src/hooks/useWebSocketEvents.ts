import { useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import type { Message, Member, Channel, UserStatus } from '@quarrel/shared';
import { useAuthStore } from '../stores/authStore';
import { useVoiceStore } from '../stores/voiceStore';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from './queryKeys';
import { getWsUrl } from '../lib/getWsUrl';
import { setWsSend } from '../lib/wsBridge';
import { useWebSocketNotifications } from './useNotifications';

export function useWebSocketEvents() {
  const token = useAuthStore((s) => s.token);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const url = token ? getWsUrl(token) : null;
  const didAuth = useRef(false);

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(url, {
    share: true,
    shouldReconnect: () => true,
    reconnectAttempts: Infinity,
    reconnectInterval: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  });

  // Expose sendJsonMessage to non-React code (voice store, etc.)
  useEffect(() => {
    setWsSend(sendJsonMessage);
  }, [sendJsonMessage]);

  // Send auth on connect
  useEffect(() => {
    if (readyState === ReadyState.OPEN && token && !didAuth.current) {
      sendJsonMessage({ event: 'auth', data: { token } });
      didAuth.current = true;
    }
    if (readyState !== ReadyState.OPEN) {
      didAuth.current = false;
    }
  }, [readyState, token, sendJsonMessage]);

  // Route incoming events to query cache
  useEffect(() => {
    if (!lastJsonMessage) return;
    const { event, data } = lastJsonMessage as { event: string; data: any };

    switch (event) {
      case 'message:new': {
        const msg = data as Message;
        queryClient.setQueryData(queryKeys.messages(msg.channelId), (old: any) => {
          if (!old) return old;
          const lastPage = old.pages[old.pages.length - 1];
          // Only check last page for duplicates since new messages are appended there
          if (lastPage.messages.some((m: Message) => m.id === msg.id)) return old;
          return {
            ...old,
            pages: [
              ...old.pages.slice(0, -1),
              { ...lastPage, messages: [...lastPage.messages, msg] },
            ],
          };
        });

        const path = window.location.pathname;
        const channelMatch = path.match(/\/channels\/[^/]+\/([^/]+)/);
        const dmMatch = path.match(/\/channels\/@me\/([^/]+)/);
        const activeChannelId = dmMatch?.[1] ?? channelMatch?.[1];
        const isViewingChannel = activeChannelId === msg.channelId && !document.hidden;
        const isOwnMessage = msg.authorId === currentUserId;

        // Keep read state in sync with what the user can currently see.
        for (const query of queryClient.getQueryCache().findAll({ queryKey: ['channels'] })) {
          const channels = queryClient.getQueryData<any[]>(query.queryKey);
          if (channels?.some((ch: any) => ch.id === msg.channelId)) {
            queryClient.setQueryData<any[]>(query.queryKey, (old) =>
              old?.map((ch) =>
                ch.id === msg.channelId
                  ? isOwnMessage || isViewingChannel
                    ? { ...ch, unreadCount: 0, lastReadMessageId: msg.id }
                    : { ...ch, unreadCount: (ch.unreadCount ?? 0) + 1 }
                  : ch
              )
            );
          }
        }
        break;
      }
      case 'message:updated': {
        const msg = data as Message;
        queryClient.setQueryData(queryKeys.messages(msg.channelId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((m: Message) => (m.id === msg.id ? msg : m)),
            })),
          };
        });
        break;
      }
      case 'message:stream': {
        const { channelId, messageId, delta } = data as {
          channelId: string;
          messageId: string;
          delta: string;
        };
        if (!delta) break;
        queryClient.setQueryData(queryKeys.messages(channelId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((m: Message) =>
                m.id === messageId ? { ...m, content: `${m.content ?? ''}${delta}` } : m
              ),
            })),
          };
        });
        break;
      }
      case 'message:deleted': {
        const { channelId, messageId } = data as { channelId: string; messageId: string };
        queryClient.setQueryData(queryKeys.messages(channelId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.filter((m: Message) => m.id !== messageId),
            })),
          };
        });
        break;
      }
      case 'member:joined': {
        const member = data as Member;
        queryClient.setQueryData<Member[]>(queryKeys.members(member.serverId), (old) => {
          if (!old) return old;
          const exists = old.some((m) => m.userId === member.userId);
          return exists
            ? old.map((m) => (m.userId === member.userId ? member : m))
            : [...old, member];
        });
        break;
      }
      case 'member:left': {
        const { serverId, userId } = data as { serverId: string; userId: string };
        queryClient.setQueryData<Member[]>(queryKeys.members(serverId), (old) =>
          old ? old.filter((m) => m.userId !== userId) : old,
        );
        break;
      }
      case 'channel:created': {
        const channel = data as Channel;
        queryClient.setQueryData<Channel[]>(queryKeys.channels(channel.serverId), (old) =>
          old ? [...old, channel] : [channel],
        );
        break;
      }
      case 'presence:update': {
        const { userId: presenceUserId, status } = data as { userId: string; status: UserStatus };
        // Update all cached member lists
        for (const query of queryClient.getQueryCache().findAll({ queryKey: ['members'] })) {
          const members = queryClient.getQueryData<Member[]>(query.queryKey);
          if (!members) continue;
          const idx = members.findIndex((m) => m.userId === presenceUserId && m.user);
          if (idx === -1) continue;
          const updated = [...members];
          updated[idx] = { ...updated[idx], user: { ...updated[idx].user!, status } };
          queryClient.setQueryData<Member[]>(query.queryKey, updated);
        }
        // Update current user in auth store
        const currentUser = useAuthStore.getState().user;
        if (currentUser && presenceUserId === currentUser.id) {
          useAuthStore.setState({ user: { ...currentUser, status } });
        }
        break;
      }

      // Pin events
      case 'message:pinned': {
        const { messageId, channelId, pinnedAt, pinnedBy } = data as {
          messageId: string;
          channelId: string;
          pinnedAt: string;
          pinnedBy: string;
        };
        queryClient.setQueryData(queryKeys.messages(channelId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((m: Message) =>
                m.id === messageId ? { ...m, pinnedAt, pinnedBy } : m
              ),
            })),
          };
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.pins(channelId) });
        break;
      }
      case 'message:unpinned': {
        const { messageId: unpinnedId, channelId: unpinnedChannelId } = data as {
          messageId: string;
          channelId: string;
        };
        queryClient.setQueryData(queryKeys.messages(unpinnedChannelId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((m: Message) =>
                m.id === unpinnedId ? { ...m, pinnedAt: null, pinnedBy: null } : m
              ),
            })),
          };
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.pins(unpinnedChannelId) });
        break;
      }

      // Reaction events
      case 'reaction:update':
      case 'reaction:updated': {
        const { messageId: reactMsgId, channelId: reactChannelId, reactions: newReactions } = data as {
          messageId: string;
          channelId: string;
          reactions: { emoji: string; count: number; me: boolean }[];
        };
        queryClient.setQueryData(queryKeys.messages(reactChannelId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((m: any) =>
                m.id === reactMsgId ? { ...m, reactions: newReactions } : m
              ),
            })),
          };
        });
        break;
      }

      // Voice events: ignore all signaling when we are not actively connected
      // to a voice channel. This prevents unsolicited events from creating
      // peer connections on clients that are only browsing text channels.
      case 'voice:state':
      case 'voice:user-joined':
      case 'voice:user-left':
      case 'voice:offer':
      case 'voice:answer':
      case 'voice:ice-candidate':
      case 'voice:mute':
      case 'voice:screen-share-started':
      case 'voice:screen-share-stopped': {
        const voiceStore = useVoiceStore.getState();
        if (!voiceStore.currentChannelId) break;
        if (event === 'voice:state') voiceStore._handleVoiceState(data);
        else if (event === 'voice:user-joined') voiceStore._handleUserJoined(data);
        else if (event === 'voice:user-left') voiceStore._handleUserLeft(data);
        else if (event === 'voice:offer') void voiceStore._handleOffer(data);
        else if (event === 'voice:answer') void voiceStore._handleAnswer(data);
        else if (event === 'voice:ice-candidate') void voiceStore._handleIceCandidate(data);
        else if (event === 'voice:mute') voiceStore._handleMuteUpdate(data);
        else if (event === 'voice:screen-share-started') voiceStore._handleScreenShareStarted(data);
        else if (event === 'voice:screen-share-stopped') voiceStore._handleScreenShareStopped(data);
        break;
      }
    }
  }, [lastJsonMessage, currentUserId]);

  // Trigger notifications for incoming events
  useWebSocketNotifications(lastJsonMessage);

  return { sendJsonMessage, readyState };
}
