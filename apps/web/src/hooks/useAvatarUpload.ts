import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { analytics } from '../lib/analytics';
import { MAX_AVATAR_SIZE_BYTES, ALLOWED_AVATAR_TYPES } from '@quarrel/shared';

export function useUploadAvatar() {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  return useMutation({
    mutationFn: async (file: File) => {
      if (!ALLOWED_AVATAR_TYPES.includes(file.type as any)) {
        throw new Error('Invalid file type. Please use PNG, JPEG, GIF, or WebP.');
      }
      if (file.size > MAX_AVATAR_SIZE_BYTES) {
        throw new Error('File too large. Maximum size is 8 MB.');
      }
      return api.uploadAvatar(file);
    },
    onSuccess: () => {
      fetchUser();
      analytics.capture('profile:avatar_uploaded');
    },
  });
}

export function useRemoveAvatar() {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  return useMutation({
    mutationFn: () => api.removeAvatar(),
    onSuccess: () => {
      fetchUser();
      analytics.capture('profile:avatar_removed');
    },
  });
}
