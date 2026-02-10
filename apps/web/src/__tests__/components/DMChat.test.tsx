import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// jsdom doesn't provide scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

import { DMChat } from '../../components/chat/DMChat';

const mockSendDMMutateAsync = vi.fn();
const mockCapture = vi.fn();
const mockFetchPreviousPage = vi.fn();

let mockDMData: any = null;
let mockIsLoading = false;

vi.mock('../../hooks/useDMs', () => ({
  useDMs: () => ({
    data: mockDMData,
    isLoading: mockIsLoading,
    hasPreviousPage: false,
    fetchPreviousPage: mockFetchPreviousPage,
    isFetchingPreviousPage: false,
  }),
  useSendDM: () => ({
    mutateAsync: mockSendDMMutateAsync,
  }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'u1', username: 'me', displayName: 'Me' },
    }),
}));

vi.mock('../../lib/analytics', () => ({
  analytics: {
    capture: (...args: any[]) => mockCapture(...args),
  },
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockConversation = {
  id: 'conv-1',
  createdAt: '2024-01-01',
  members: [
    { id: 'u1', username: 'me', displayName: 'Me', status: 'online' as const, avatarUrl: null, email: 'me@test.com', customStatus: null, createdAt: '2024-01-01' },
    { id: 'u2', username: 'alice', displayName: 'Alice', status: 'online' as const, avatarUrl: null, email: 'alice@test.com', customStatus: null, createdAt: '2024-01-01' },
  ],
};

const mockMessages = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    authorId: 'u2',
    content: 'Hey there!',
    attachments: [],
    createdAt: '2024-01-15T10:00:00Z',
    editedAt: null,
    deleted: false,
    author: { displayName: 'Alice', username: 'alice', avatarUrl: null },
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    authorId: 'u1',
    content: 'Hi Alice!',
    attachments: [],
    createdAt: '2024-01-15T10:01:00Z',
    editedAt: null,
    deleted: false,
    author: { displayName: 'Me', username: 'me', avatarUrl: null },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockDMData = null;
  mockIsLoading = false;
});

describe('DMChat', () => {
  it('renders header with other user display name', () => {
    mockDMData = { pages: [{ messages: [] }] };

    render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    // The header contains a span.font-semibold with the display name
    const allAlice = screen.getAllByText('Alice');
    expect(allAlice.length).toBeGreaterThanOrEqual(1);
    // The header span specifically
    const headerName = allAlice.find((el) => el.classList.contains('font-semibold'));
    expect(headerName).toBeInTheDocument();
  });

  it('renders messages with author names and content', () => {
    mockDMData = { pages: [{ messages: mockMessages }] };

    render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Hey there!')).toBeInTheDocument();
    expect(screen.getByText('Hi Alice!')).toBeInTheDocument();
    // Author names appear in message headers (font-medium hover:underline)
    const allAlice = screen.getAllByText('Alice');
    const messageAuthor = allAlice.find((el) => el.classList.contains('font-medium') && el.classList.contains('cursor-pointer'));
    expect(messageAuthor).toBeInTheDocument();
    expect(screen.getByText('Me')).toBeInTheDocument();
  });

  it('sending a message calls sendDM.mutateAsync', async () => {
    mockDMData = { pages: [{ messages: [] }] };
    mockSendDMMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    const textarea = screen.getByPlaceholderText('Message @Alice');
    await user.type(textarea, 'Hello!');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockSendDMMutateAsync).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: 'Hello!',
      });
    });
  });

  it('Enter key sends message', async () => {
    mockDMData = { pages: [{ messages: [] }] };
    mockSendDMMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    const textarea = screen.getByPlaceholderText('Message @Alice');
    await user.type(textarea, 'Test message{Enter}');

    await waitFor(() => {
      expect(mockSendDMMutateAsync).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: 'Test message',
      });
    });
  });

  it('empty input does not send', async () => {
    mockDMData = { pages: [{ messages: [] }] };
    const user = userEvent.setup();

    render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    const textarea = screen.getByPlaceholderText('Message @Alice');
    await user.click(textarea);
    await user.keyboard('{Enter}');

    expect(mockSendDMMutateAsync).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    mockIsLoading = true;

    const { container } = render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('captures dm:open analytics on mount', () => {
    mockDMData = { pages: [{ messages: [] }] };

    render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    expect(mockCapture).toHaveBeenCalledWith('dm:open', { conversationId: 'conv-1' });
  });

  it('captures dm:send analytics after sending', async () => {
    mockDMData = { pages: [{ messages: [] }] };
    mockSendDMMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    const textarea = screen.getByPlaceholderText('Message @Alice');
    await user.type(textarea, 'Hello!{Enter}');

    await waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith('dm:send', { conversationId: 'conv-1' });
    });
  });

  it('clears input after sending', async () => {
    mockDMData = { pages: [{ messages: [] }] };
    mockSendDMMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(
      <DMChat conversationId="conv-1" conversation={mockConversation} />,
      { wrapper: Wrapper },
    );

    const textarea = screen.getByPlaceholderText('Message @Alice');
    await user.type(textarea, 'Hello!{Enter}');

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('shows fallback display name when no conversation', () => {
    mockDMData = { pages: [{ messages: [] }] };

    render(
      <DMChat conversationId="conv-1" />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Direct Message')).toBeInTheDocument();
  });
});
