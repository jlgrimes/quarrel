import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useServerStore } from '../../stores/serverStore';

vi.mock('../../lib/api', () => ({
  api: {
    getServers: vi.fn(),
    getChannels: vi.fn(),
    getMembers: vi.fn(),
    createServer: vi.fn(),
    joinServer: vi.fn(),
  },
}));

import { api } from '../../lib/api';

const mockedApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
  useServerStore.setState({ servers: [], channels: [], members: [], activeServerId: null });
});

describe('serverStore', () => {
  it('fetchServers populates servers array', async () => {
    const mockServers = [
      { id: '1', name: 'Server 1', iconUrl: null, ownerId: 'u1', inviteCode: 'abc', createdAt: '' },
      { id: '2', name: 'Server 2', iconUrl: null, ownerId: 'u2', inviteCode: 'def', createdAt: '' },
    ];
    mockedApi.getServers.mockResolvedValueOnce(mockServers);

    await useServerStore.getState().fetchServers();

    expect(useServerStore.getState().servers).toEqual(mockServers);
  });

  it('createServer adds to list', async () => {
    useServerStore.setState({ servers: [{ id: '1', name: 'Existing', iconUrl: null, ownerId: 'u1', inviteCode: 'abc', createdAt: '' }] });
    const newServer = { id: '2', name: 'New Server', iconUrl: null, ownerId: 'u1', inviteCode: 'xyz', createdAt: '' };
    mockedApi.createServer.mockResolvedValueOnce(newServer);

    const result = await useServerStore.getState().createServer('New Server');

    expect(result).toEqual(newServer);
    expect(useServerStore.getState().servers).toHaveLength(2);
    expect(useServerStore.getState().servers[1]).toEqual(newServer);
  });

  it('setActiveServer updates activeServerId', () => {
    useServerStore.getState().setActiveServer('server-123');
    expect(useServerStore.getState().activeServerId).toBe('server-123');

    useServerStore.getState().setActiveServer(null);
    expect(useServerStore.getState().activeServerId).toBeNull();
  });
});
