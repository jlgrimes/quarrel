import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ScrollArea uses ResizeObserver which jsdom doesn't provide
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import FriendsList from '../../components/FriendsList';

const mockMutateAsync = vi.fn();
const mockAcceptMutate = vi.fn();
const mockRemoveMutate = vi.fn();
const mockCapture = vi.fn();
const mockCreateConversationMutateAsync = vi.fn();
const mockNavigate = vi.fn();

let friendsData: any[] = [];

vi.mock('../../hooks/useFriends', () => ({
  useFriends: () => ({
    data: friendsData,
  }),
  useAddFriend: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useAcceptFriend: () => ({
    mutate: mockAcceptMutate,
    isPending: false,
  }),
  useRemoveFriend: () => ({
    mutate: mockRemoveMutate,
    isPending: false,
  }),
}));

vi.mock('../../hooks/useDMs', () => ({
  useCreateConversation: () => ({
    mutateAsync: mockCreateConversationMutateAsync,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

beforeEach(() => {
  vi.clearAllMocks();
  friendsData = [];
});

describe('FriendsList', () => {
  it('renders tabs and add friend input', () => {
    render(<FriendsList />, { wrapper: Wrapper });

    expect(screen.getByText('Friends')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Online' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blocked' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Friend Request' })).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', () => {
    render(<FriendsList />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: 'Send Friend Request' })).toBeDisabled();
  });

  it('sends friend request and shows success', async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    await user.type(screen.getByPlaceholderText('Enter a username'), 'bob');
    await user.click(screen.getByRole('button', { name: 'Send Friend Request' }));

    expect(mockMutateAsync).toHaveBeenCalledWith('bob');
    await waitFor(() => {
      expect(screen.getByText('Friend request sent!')).toBeInTheDocument();
    });
  });

  it('captures friend:request_sent analytics on success', async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    await user.type(screen.getByPlaceholderText('Enter a username'), 'bob');
    await user.click(screen.getByRole('button', { name: 'Send Friend Request' }));

    await waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith('friend:request_sent');
    });
  });

  it('shows error message on failed request', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('User not found'));
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    await user.type(screen.getByPlaceholderText('Enter a username'), 'nobody');
    await user.click(screen.getByRole('button', { name: 'Send Friend Request' }));

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });

  it('does not capture analytics on failed request', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('User not found'));
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    await user.type(screen.getByPlaceholderText('Enter a username'), 'nobody');
    await user.click(screen.getByRole('button', { name: 'Send Friend Request' }));

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('clears input after successful request', async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    const input = screen.getByPlaceholderText('Enter a username');
    await user.type(input, 'bob');
    await user.click(screen.getByRole('button', { name: 'Send Friend Request' }));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('sends request on Enter key', async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    await user.type(screen.getByPlaceholderText('Enter a username'), 'bob{Enter}');

    expect(mockMutateAsync).toHaveBeenCalledWith('bob');
  });

  it('trims whitespace from username', async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    await user.type(screen.getByPlaceholderText('Enter a username'), '  bob  ');
    await user.click(screen.getByRole('button', { name: 'Send Friend Request' }));

    expect(mockMutateAsync).toHaveBeenCalledWith('bob');
  });

  it('shows empty states per tab', async () => {
    const user = userEvent.setup();
    render(<FriendsList />, { wrapper: Wrapper });

    // Default tab is 'online'
    expect(screen.getByText('No friends online right now.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText("You don't have any friends yet.")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByText('No pending friend requests.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Blocked' }));
    expect(screen.getByText('No blocked users.')).toBeInTheDocument();
  });
});

describe('FriendsList with friends data', () => {
  const pendingFriend = {
    id: 'f1',
    userId: 'u1',
    friendId: 'u2',
    status: 'pending',
    friend: { id: 'u2', username: 'bob', displayName: 'Bob', status: 'online' },
  };
  const acceptedFriend = {
    id: 'f2',
    userId: 'u1',
    friendId: 'u3',
    status: 'accepted',
    friend: { id: 'u3', username: 'carol', displayName: 'Carol', status: 'online' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    friendsData = [pendingFriend, acceptedFriend];
  });

  it('shows accept button for pending requests', async () => {
    render(<FriendsList />, { wrapper: Wrapper });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Pending' }));

    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
  });

  it('captures friend:request_accepted analytics on accept', async () => {
    render(<FriendsList />, { wrapper: Wrapper });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Pending' }));
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(mockAcceptMutate).toHaveBeenCalledWith('f1');
    expect(mockCapture).toHaveBeenCalledWith('friend:request_accepted');
  });

  it('captures friend:removed analytics on remove', async () => {
    render(<FriendsList />, { wrapper: Wrapper });

    // Online tab shows accepted friends that are online
    const removeButtons = screen.getAllByTitle('Remove');
    await userEvent.click(removeButtons[0]);

    expect(mockRemoveMutate).toHaveBeenCalled();
    expect(mockCapture).toHaveBeenCalledWith('friend:removed');
  });

  it('shows Message button for accepted friends', () => {
    render(<FriendsList />, { wrapper: Wrapper });

    // Online tab shows accepted friends that are online (Carol is accepted + online)
    expect(screen.getByTitle('Message')).toBeInTheDocument();
  });

  it('clicking Message creates conversation and navigates to it', async () => {
    mockCreateConversationMutateAsync.mockResolvedValueOnce({ id: 'conv-1' });
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    await user.click(screen.getByTitle('Message'));

    // acceptedFriend has userId='u1' (same as currentUser.id) so otherUserId = friendId = 'u3'
    expect(mockCreateConversationMutateAsync).toHaveBeenCalledWith('u3');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/channels/@me/conv-1');
    });
  });

  it('clicking Message uses userId when currentUser is friendId', async () => {
    // Swap: currentUser is the friendId side of the relationship
    friendsData = [
      {
        id: 'f3',
        userId: 'u5',
        friendId: 'u1',
        status: 'accepted',
        friend: { id: 'u5', username: 'dave', displayName: 'Dave', status: 'online' },
      },
    ];
    mockCreateConversationMutateAsync.mockResolvedValueOnce({ id: 'conv-2' });
    const user = userEvent.setup();

    render(<FriendsList />, { wrapper: Wrapper });

    await user.click(screen.getByTitle('Message'));

    // friend.userId='u5', friend.friendId='u1', currentUser.id='u1'
    // Since friend.userId !== currentUser.id, otherUserId = friend.userId = 'u5'
    expect(mockCreateConversationMutateAsync).toHaveBeenCalledWith('u5');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/channels/@me/conv-2');
    });
  });
});
