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

vi.mock('../../stores/voiceStore', () => ({
  useVoiceStore: {
    getState: vi.fn(() => ({ cleanup: vi.fn() })),
  },
}));

import { api } from '../../lib/api';
import { useVoiceStore } from '../../stores/voiceStore';

const mockedApi = vi.mocked(api);

const mockUser = { id: '1', username: 'alice', displayName: 'Alice', email: 'alice@test.com', avatarUrl: null, status: 'online' as const, customStatus: null, createdAt: '' };

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, token: null, loading: true });
});

describe('authStore', () => {
  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.loading).toBe(true);
  });

  it('fetchUser sets user and token on success', async () => {
    mockedApi.me.mockResolvedValueOnce({ user: mockUser, token: 'session-abc' });

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('session-abc');
    expect(state.loading).toBe(false);
  });

  it('fetchUser sets user to null on failure', async () => {
    mockedApi.me.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('login sets user and token', async () => {
    mockedApi.login.mockResolvedValueOnce({ user: mockUser, token: 'login-token' });

    await useAuthStore.getState().login('alice@test.com', 'password123');

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe('login-token');
  });

  it('register sets user and token', async () => {
    mockedApi.register.mockResolvedValueOnce({ user: mockUser, token: 'register-token' });

    await useAuthStore.getState().register('alice', 'alice@test.com', 'password123');

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe('register-token');
  });

  it('logout clears user and token, calls voice cleanup', async () => {
    const mockCleanup = vi.fn();
    vi.mocked(useVoiceStore.getState).mockReturnValue({ cleanup: mockCleanup } as any);
    useAuthStore.setState({ user: mockUser, token: 'some-token' });
    mockedApi.logout.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(mockCleanup).toHaveBeenCalled();
  });
});
