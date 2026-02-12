import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { analytics } from '../lib/analytics';
import { queryKeys } from './queryKeys';

function updateReactionInMessageCaches(messageId: string, reactions: ReactionData[]) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['messages'] })) {
    queryClient.setQueryData(query.queryKey, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          messages: page.messages.map((m: any) =>
            m.id === messageId ? { ...m, reactions } : m
          ),
        })),
      };
    });
  }
}

export function useAddReaction() {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.addReaction(messageId, emoji),
    onSuccess: (data, { messageId, emoji }) => {
      if (Array.isArray(data?.reactions)) {
        updateReactionInMessageCaches(messageId, data.reactions);
      }
      analytics.capture('message:reaction_add', { messageId, emoji });
    },
  });
}

export function useRemoveReaction() {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.removeReaction(messageId, emoji),
    onSuccess: (data, { messageId, emoji }) => {
      if (Array.isArray(data?.reactions)) {
        updateReactionInMessageCaches(messageId, data.reactions);
      }
      analytics.capture('message:reaction_remove', { messageId, emoji });
    },
  });
}

export type ReactionData = {
  emoji: string;
  count: number;
  me: boolean;
};

// Helper to update reactions in the message query cache
export function updateMessageReactions(
  channelId: string,
  messageId: string,
  newReactions: ReactionData[]
) {
  queryClient.setQueryData(queryKeys.messages(channelId), (old: any) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        messages: page.messages.map((m: any) =>
          m.id === messageId ? { ...m, reactions: newReactions } : m
        ),
      })),
    };
  });
}
