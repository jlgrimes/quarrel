import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Server } from '@quarrel/shared';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';

export function useServers() {
  return useQuery({
    queryKey: queryKeys.servers,
    queryFn: api.getServers,
  });
}

export function useCreateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createServer(name),
    onSuccess: (server) => {
      qc.setQueryData<Server[]>(queryKeys.servers, (old) =>
        old ? [...old, server] : [server],
      );
    },
  });
}

export function useJoinServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) => api.joinServer(inviteCode),
    onSuccess: (server) => {
      qc.setQueryData<Server[]>(queryKeys.servers, (old) =>
        old ? [...old, server] : [server],
      );
    },
  });
}
