import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@quarrel/shared';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';

export function useRoles(serverId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roles(serverId!),
    queryFn: () => api.getRoles(serverId!),
    enabled: !!serverId,
    staleTime: 60_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serverId, data }: { serverId: string; data: { name: string; color?: string; permissions?: number } }) =>
      api.createRole(serverId, data),
    onSuccess: (role, { serverId }) => {
      qc.setQueryData<Role[]>(queryKeys.roles(serverId), (old) =>
        old ? [...old, role] : [role],
      );
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, serverId, data }: { roleId: string; serverId: string; data: { name?: string; color?: string; permissions?: number } }) =>
      api.updateRole(roleId, data),
    onSuccess: (role, { serverId }) => {
      qc.setQueryData<Role[]>(queryKeys.roles(serverId), (old) =>
        old ? old.map((r) => (r.id === role.id ? role : r)) : [role],
      );
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, serverId }: { roleId: string; serverId: string }) =>
      api.deleteRole(roleId),
    onSuccess: (_, { roleId, serverId }) => {
      qc.setQueryData<Role[]>(queryKeys.roles(serverId), (old) =>
        old ? old.filter((r) => r.id !== roleId) : [],
      );
    },
  });
}
