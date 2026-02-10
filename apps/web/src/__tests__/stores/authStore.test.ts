import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../stores/authStore';

vi.mock('../../lib/api', () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

import { api } from '../../lib/api';

const mockedApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, loading: true });
});

describe('authStore', () => {
  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(true);
  });

  it('fetchUser sets user on success', async () => {
    const mockUser = { id: '1', username: 'alice', displayName: 'Alice', email: 'alice@test.com', avatarUrl: null, status: 'online' as const, customStatus: null, createdAt: '' };
    mockedApi.me.mockResolvedValueOnce(mockUser);

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.loading).toBe(false);
  });

  it('fetchUser sets user to null on failure', async () => {
    mockedApi.me.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('logout clears user', async () => {
    useAuthStore.setState({ user: { id: '1', username: 'alice', displayName: 'Alice', email: 'a@b.com', avatarUrl: null, status: 'online', customStatus: null, createdAt: '' } });
    mockedApi.logout.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
  });
});
