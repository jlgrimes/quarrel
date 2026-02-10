import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';

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
  });
}

export function useDeleteMessage() {
  return useMutation({
    mutationFn: (messageId: string) => api.deleteMessage(messageId),
  });
}
