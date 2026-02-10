import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '../../components/chat/MessageInput';

const mockSendMessage = vi.fn();
const mockSetReplyingTo = vi.fn();

let mockReplyingTo: string | null = null;

vi.mock('../../stores/messageStore', () => ({
  useMessageStore: (selector: any) =>
    selector({
      sendMessage: mockSendMessage,
      messages: {
        'ch-1': [
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
        ],
      },
    }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      replyingTo: mockReplyingTo,
      setReplyingTo: mockSetReplyingTo,
    }),
}));

vi.mock('../../lib/ws', () => ({
  wsClient: { send: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockReplyingTo = null;
});

describe('MessageInput', () => {
  it('renders textarea with placeholder', () => {
    render(<MessageInput channelId="ch-1" channelName="general" />);

    expect(screen.getByPlaceholderText('Message #general')).toBeInTheDocument();
  });

  it('calls sendMessage on Enter', async () => {
    mockSendMessage.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<MessageInput channelId="ch-1" channelName="general" />);

    const textarea = screen.getByPlaceholderText('Message #general');
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('ch-1', 'Hello world', undefined);
  });

  it('Shift+Enter does not send', async () => {
    const user = userEvent.setup();
    render(<MessageInput channelId="ch-1" channelName="general" />);

    const textarea = screen.getByPlaceholderText('Message #general');
    await user.type(textarea, 'Hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('shows reply bar when replying', () => {
    mockReplyingTo = 'msg-1';

    render(<MessageInput channelId="ch-1" channelName="general" />);

    expect(screen.getByText(/replying to/i)).toBeInTheDocument();
  });
});
