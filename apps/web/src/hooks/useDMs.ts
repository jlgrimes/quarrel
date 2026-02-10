import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Conversation } from '@quarrel/shared';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: api.getConversations,
    staleTime: 60_000,
  });
}

export function useDMs(conversationId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.dms(conversationId!),
    queryFn: ({ pageParam }) => api.getDMs(conversationId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
    getPreviousPageParam: (firstPage) => firstPage.nextCursor ?? undefined,
    enabled: !!conversationId,
  });
}

export function useSendDM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      api.sendDM(conversationId, content),
    onSuccess: (msg, { conversationId }) => {
      qc.setQueryData(queryKeys.dms(conversationId), (old: any) => {
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
    },
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.createConversation(userId),
    onSuccess: (conv) => {
      qc.setQueryData<Conversation[]>(queryKeys.conversations, (old) =>
        old ? [...old, conv] : [conv],
      );
    },
  });
}
