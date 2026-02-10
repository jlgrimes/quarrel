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

vi.mock('../../lib/ws', () => ({
  wsClient: {
    setToken: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

import { api } from '../../lib/api';
import { wsClient } from '../../lib/ws';

const mockedApi = vi.mocked(api);
const mockedWs = vi.mocked(wsClient);

const mockUser = { id: '1', username: 'alice', displayName: 'Alice', email: 'alice@test.com', avatarUrl: null, status: 'online' as const, customStatus: null, createdAt: '' };

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

  it('fetchUser sets user and ws token on success', async () => {
    mockedApi.me.mockResolvedValueOnce({ user: mockUser, token: 'session-abc' });

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.loading).toBe(false);
    expect(mockedWs.setToken).toHaveBeenCalledWith('session-abc');
  });

  it('fetchUser sets user to null on failure', async () => {
    mockedApi.me.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(false);
    expect(mockedWs.setToken).not.toHaveBeenCalled();
  });

  it('login sets user and ws token', async () => {
    mockedApi.login.mockResolvedValueOnce({ user: mockUser, token: 'login-token' });

    await useAuthStore.getState().login('alice@test.com', 'password123');

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(mockedWs.setToken).toHaveBeenCalledWith('login-token');
  });

  it('register sets user and ws token', async () => {
    mockedApi.register.mockResolvedValueOnce({ user: mockUser, token: 'register-token' });

    await useAuthStore.getState().register('alice', 'alice@test.com', 'password123');

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(mockedWs.setToken).toHaveBeenCalledWith('register-token');
  });

  it('logout clears user', async () => {
    useAuthStore.setState({ user: mockUser });
    mockedApi.logout.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
  });
});
