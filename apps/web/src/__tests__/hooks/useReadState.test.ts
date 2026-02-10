import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

const mockAckChannel = vi.fn();
const mockAckDM = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    ackChannel: (...args: any[]) => mockAckChannel(...args),
    ackDM: (...args: any[]) => mockAckDM(...args),
  },
}));

import { useAckChannel, useAckDM } from '../../hooks/useReadState';

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe('useAckChannel', () => {
  it('sets unreadCount to 0 and updates lastReadMessageId on ack', async () => {
    // Seed the channel cache with unread state
    queryClient.setQueryData(['channels', 'server-1'], [
      { id: 'ch-1', name: 'general', unreadCount: 5, lastReadMessageId: 'old-msg-id' },
      { id: 'ch-2', name: 'random', unreadCount: 3, lastReadMessageId: 'other-msg' },
    ]);

    mockAckChannel.mockResolvedValue({ success: true, lastReadMessageId: 'latest-msg-id' });

    const { result } = renderHook(() => useAckChannel(), { wrapper });

    act(() => {
      result.current.mutate('ch-1');
    });

    await waitFor(() => {
      const channels = queryClient.getQueryData<any[]>(['channels', 'server-1']);
      expect(channels).toBeDefined();
      const ch1 = channels!.find((c: any) => c.id === 'ch-1');
      expect(ch1.unreadCount).toBe(0);
      expect(ch1.lastReadMessageId).toBe('latest-msg-id');
    });

    // Other channels unaffected
    const channels = queryClient.getQueryData<any[]>(['channels', 'server-1']);
    const ch2 = channels!.find((c: any) => c.id === 'ch-2');
    expect(ch2.unreadCount).toBe(3);
    expect(ch2.lastReadMessageId).toBe('other-msg');
  });

  it('updates lastReadMessageId to null when channel has no messages', async () => {
    queryClient.setQueryData(['channels', 'server-1'], [
      { id: 'ch-1', name: 'general', unreadCount: 0, lastReadMessageId: 'old-msg-id' },
    ]);

    mockAckChannel.mockResolvedValue({ success: true, lastReadMessageId: null });

    const { result } = renderHook(() => useAckChannel(), { wrapper });

    act(() => {
      result.current.mutate('ch-1');
    });

    await waitFor(() => {
      const channels = queryClient.getQueryData<any[]>(['channels', 'server-1']);
      const ch1 = channels!.find((c: any) => c.id === 'ch-1');
      expect(ch1.lastReadMessageId).toBeNull();
    });
  });

  it('finds channel across multiple server caches', async () => {
    queryClient.setQueryData(['channels', 'server-1'], [
      { id: 'ch-a', name: 'a', unreadCount: 0, lastReadMessageId: null },
    ]);
    queryClient.setQueryData(['channels', 'server-2'], [
      { id: 'ch-b', name: 'b', unreadCount: 2, lastReadMessageId: 'old-id' },
    ]);

    mockAckChannel.mockResolvedValue({ success: true, lastReadMessageId: 'new-id' });

    const { result } = renderHook(() => useAckChannel(), { wrapper });

    act(() => {
      result.current.mutate('ch-b');
    });

    await waitFor(() => {
      const channels = queryClient.getQueryData<any[]>(['channels', 'server-2']);
      const chB = channels!.find((c: any) => c.id === 'ch-b');
      expect(chB.unreadCount).toBe(0);
      expect(chB.lastReadMessageId).toBe('new-id');
    });

    // server-1 channels unaffected
    const server1 = queryClient.getQueryData<any[]>(['channels', 'server-1']);
    expect(server1![0].unreadCount).toBe(0);
    expect(server1![0].lastReadMessageId).toBeNull();
  });
});

describe('useAckDM', () => {
  it('sets unreadCount to 0 on ack', async () => {
    queryClient.setQueryData(['conversations'], [
      { id: 'conv-1', unreadCount: 4 },
      { id: 'conv-2', unreadCount: 1 },
    ]);

    mockAckDM.mockResolvedValue({ success: true, lastReadMessageId: 'dm-msg-id' });

    const { result } = renderHook(() => useAckDM(), { wrapper });

    act(() => {
      result.current.mutate('conv-1');
    });

    await waitFor(() => {
      const convs = queryClient.getQueryData<any[]>(['conversations']);
      const conv1 = convs!.find((c: any) => c.id === 'conv-1');
      expect(conv1.unreadCount).toBe(0);
    });

    // Other conversations unaffected
    const convs = queryClient.getQueryData<any[]>(['conversations']);
    const conv2 = convs!.find((c: any) => c.id === 'conv-2');
    expect(conv2.unreadCount).toBe(1);
  });
});
