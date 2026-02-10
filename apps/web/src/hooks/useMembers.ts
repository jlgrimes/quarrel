import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';

export function useMembers(serverId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members(serverId!),
    queryFn: () => api.getMembers(serverId!),
    enabled: !!serverId,
    staleTime: 60_000,
  });
}
