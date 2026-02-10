import { useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import type { Message, Member, Channel, UserStatus } from '@quarrel/shared';
import { useAuthStore } from '../stores/authStore';
import { useVoiceStore } from '../stores/voiceStore';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from './queryKeys';
import { getWsUrl } from '../lib/getWsUrl';
import { setWsSend } from '../lib/wsBridge';

export function useWebSocketEvents() {
  const token = useAuthStore((s) => s.token);
  const url = token ? getWsUrl() : null;
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
          return {
            ...old,
            pages: [
              ...old.pages.slice(0, -1),
              { ...lastPage, messages: [...lastPage.messages, msg] },
            ],
          };
        });
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
        const { userId, status } = data as { userId: string; status: UserStatus };
        // Update all cached member lists
        queryClient.getQueryCache().findAll({ queryKey: ['members'] }).forEach((query) => {
          queryClient.setQueryData<Member[]>(query.queryKey, (old) =>
            old
              ? old.map((m) =>
                  m.userId === userId && m.user
                    ? { ...m, user: { ...m.user, status } }
                    : m,
                )
              : old,
          );
        });
        // Update current user in auth store
        const currentUser = useAuthStore.getState().user;
        if (currentUser && userId === currentUser.id) {
          useAuthStore.setState({ user: { ...currentUser, status } });
        }
        break;
      }

      // Voice events
      case 'voice:state':
        useVoiceStore.getState()._handleVoiceState(data);
        break;
      case 'voice:user-joined':
        useVoiceStore.getState()._handleUserJoined(data);
        break;
      case 'voice:user-left':
        useVoiceStore.getState()._handleUserLeft(data);
        break;
      case 'voice:offer':
        useVoiceStore.getState()._handleOffer(data);
        break;
      case 'voice:answer':
        useVoiceStore.getState()._handleAnswer(data);
        break;
      case 'voice:ice-candidate':
        useVoiceStore.getState()._handleIceCandidate(data);
        break;
      case 'voice:mute':
        useVoiceStore.getState()._handleMuteUpdate(data);
        break;
    }
  }, [lastJsonMessage]);

  return { sendJsonMessage, readyState };
}
