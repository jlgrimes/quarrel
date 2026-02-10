import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';

export function useAckChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => api.ackChannel(channelId),
    onSuccess: (_data, channelId) => {
      // Find which server this channel belongs to and invalidate its channels query
      for (const query of qc.getQueryCache().findAll({ queryKey: ['channels'] })) {
        const channels = qc.getQueryData<any[]>(query.queryKey);
        if (channels?.some((ch: any) => ch.id === channelId)) {
          qc.setQueryData<any[]>(query.queryKey, (old) =>
            old?.map((ch) =>
              ch.id === channelId ? { ...ch, unreadCount: 0 } : ch
            )
          );
        }
      }
    },
  });
}

export function useAckDM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.ackDM(conversationId),
    onSuccess: (_data, conversationId) => {
      qc.setQueryData<any[]>(queryKeys.conversations, (old) =>
        old?.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    },
  });
}
