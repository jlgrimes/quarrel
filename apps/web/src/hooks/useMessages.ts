import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';
import { queryClient } from '../lib/queryClient';

export function useMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(channelId),
    queryFn: ({ pageParam }) => api.getMessages(channelId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
    getPreviousPageParam: (firstPage) => firstPage.nextCursor ?? undefined,
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: ({ channelId, content, replyToId }: { channelId: string; content: string; replyToId?: string }) =>
      api.sendMessage(channelId, content, replyToId),
    onSuccess: (message, { channelId }) => {
      queryClient.setQueryData(queryKeys.messages(channelId), (old: any) => {
        if (!old) return old;
        const lastPage = old.pages[old.pages.length - 1];
        return {
          ...old,
          pages: [
            ...old.pages.slice(0, -1),
            { ...lastPage, messages: [...lastPage.messages, message] },
          ],
        };
      });
    },
  });
}

export function useDeleteMessage() {
  return useMutation({
    mutationFn: (messageId: string) => api.deleteMessage(messageId),
  });
}
