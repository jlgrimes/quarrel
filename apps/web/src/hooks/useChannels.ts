import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '@quarrel/shared';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';

export function useChannels(serverId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.channels(serverId!),
    queryFn: () => api.getChannels(serverId!),
    enabled: !!serverId,
    staleTime: 60_000,
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serverId, data }: { serverId: string; data: { name: string; type?: string; categoryId?: string } }) =>
      api.createChannel(serverId, data),
    onSuccess: (channel, { serverId }) => {
      qc.setQueryData<Channel[]>(queryKeys.channels(serverId), (old) =>
        old ? [...old, channel] : [channel],
      );
    },
  });
}
