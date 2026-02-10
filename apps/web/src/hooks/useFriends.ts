import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from './queryKeys';

export function useFriends() {
  return useQuery({
    queryKey: queryKeys.friends,
    queryFn: api.getFriends,
  });
}

export function useAddFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.addFriend(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friends });
    },
  });
}

export function useAcceptFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acceptFriend(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friends });
    },
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeFriend(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friends });
    },
  });
}
