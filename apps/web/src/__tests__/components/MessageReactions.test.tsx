import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock analytics before importing component
vi.mock('../../lib/analytics', () => ({
  analytics: { capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), pageview: vi.fn() },
}));

// Mock the API module
vi.mock('../../lib/api', () => ({
  api: {
    addReaction: vi.fn().mockResolvedValue({ reaction: {} }),
    removeReaction: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// We need to test the MessageReactions behavior by testing how reactions render
// Since it's a private component inside MessageList, we'll test the hook and behavior

import { analytics } from '../../lib/analytics';
import { api } from '../../lib/api';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// Test the useReactions hooks
import { useAddReaction, useRemoveReaction } from '../../hooks/useReactions';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

function createWrapper() {
  const queryClient = createQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAddReaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls api.addReaction and captures analytics event', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddReaction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ messageId: 'msg1', emoji: '👍' });
    });

    expect(api.addReaction).toHaveBeenCalledWith('msg1', '👍');
    expect(analytics.capture).toHaveBeenCalledWith('message:reaction_add', {
      messageId: 'msg1',
      emoji: '👍',
    });
  });
});

describe('useRemoveReaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls api.removeReaction and captures analytics event', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRemoveReaction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ messageId: 'msg1', emoji: '👍' });
    });

    expect(api.removeReaction).toHaveBeenCalledWith('msg1', '👍');
    expect(analytics.capture).toHaveBeenCalledWith('message:reaction_remove', {
      messageId: 'msg1',
      emoji: '👍',
    });
  });
});
