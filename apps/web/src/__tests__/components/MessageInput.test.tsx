import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessageInput } from '../../components/chat/MessageInput';

const mockMutateAsync = vi.fn();
const mockSetReplyingTo = vi.fn();
let mockReplyingTo: string | null = null;

const mockMessages = [
  {
    id: 'msg-1',
    content: 'Hello',
    author: { displayName: 'Bob' },
    authorId: 'u2',
    channelId: 'ch-1',
    createdAt: '',
    editedAt: null,
    attachments: [],
    replyToId: null,
    deleted: false,
  },
];

vi.mock('../../hooks/useMessages', () => ({
  useSendMessage: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useMessages: () => ({
    data: { pages: [{ messages: mockMessages, nextCursor: null }] },
  }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      replyingTo: mockReplyingTo,
      setReplyingTo: mockSetReplyingTo,
    }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ token: null }),
}));

vi.mock('react-use-websocket', () => ({
  default: () => ({ sendJsonMessage: vi.fn() }),
}));

vi.mock('../../lib/getWsUrl', () => ({
  getWsUrl: () => 'ws://localhost:3001/ws',
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReplyingTo = null;
});

describe('MessageInput', () => {
  it('renders textarea with placeholder', () => {
    render(<MessageInput channelId="ch-1" channelName="general" />, { wrapper: Wrapper });

    expect(screen.getByPlaceholderText('Message #general')).toBeInTheDocument();
  });

  it('calls sendMessage on Enter', async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<MessageInput channelId="ch-1" channelName="general" />, { wrapper: Wrapper });

    const textarea = screen.getByPlaceholderText('Message #general');
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    expect(mockMutateAsync).toHaveBeenCalledWith({
      channelId: 'ch-1',
      content: 'Hello world',
      replyToId: undefined,
    });
  });

  it('Shift+Enter does not send', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="ch-1" channelName="general" />, { wrapper: Wrapper });

    const textarea = screen.getByPlaceholderText('Message #general');
    await user.type(textarea, 'Hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('shows reply bar when replying', () => {
    mockReplyingTo = 'msg-1';

    render(<MessageInput channelId="ch-1" channelName="general" />, { wrapper: Wrapper });

    expect(screen.getByText(/replying to/i)).toBeInTheDocument();
  });
});
