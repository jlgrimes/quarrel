import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ScrollArea uses ResizeObserver which jsdom doesn't provide
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// SidebarProvider uses matchMedia for mobile detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

import DMSidebar from '../../components/navigation/DMSidebar';
import { SidebarProvider } from '../../components/ui/sidebar';

const mockNavigate = vi.fn();
let mockConversationId: string | undefined;
let mockConversations: any[] = [];
let mockIsLoading = false;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ conversationId: mockConversationId }),
}));

vi.mock('../../hooks/useDMs', () => ({
  useConversations: () => ({
    data: mockConversations,
    isLoading: mockIsLoading,
  }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'u1', username: 'me', displayName: 'Me' },
    }),
}));

vi.mock('../voice/VoiceConnectionBar', () => ({
  VoiceConnectionBar: () => <div data-testid="voice-connection-bar" />,
}));

vi.mock('./UserBar', () => ({
  default: () => <div data-testid="user-bar" />,
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        {children}
      </SidebarProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConversationId = undefined;
  mockConversations = [];
  mockIsLoading = false;
});

describe('DMSidebar', () => {
  it('renders Friends button and Direct Messages heading', () => {
    render(<DMSidebar />, { wrapper: Wrapper });

    expect(screen.getByText('Friends')).toBeInTheDocument();
    expect(screen.getByText('Direct Messages')).toBeInTheDocument();
  });

  it('shows conversation items with user display names', () => {
    mockConversations = [
      {
        id: 'conv-1',
        createdAt: '2024-01-01',
        members: [
          { id: 'u1', username: 'me', displayName: 'Me', status: 'online', avatarUrl: null },
          { id: 'u2', username: 'alice', displayName: 'Alice', status: 'online', avatarUrl: null },
        ],
      },
      {
        id: 'conv-2',
        createdAt: '2024-01-02',
        members: [
          { id: 'u1', username: 'me', displayName: 'Me', status: 'online', avatarUrl: null },
          { id: 'u3', username: 'bob', displayName: 'Bob', status: 'idle', avatarUrl: null },
        ],
      },
    ];

    render(<DMSidebar />, { wrapper: Wrapper });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('highlights active conversation', () => {
    mockConversationId = 'conv-1';
    mockConversations = [
      {
        id: 'conv-1',
        createdAt: '2024-01-01',
        members: [
          { id: 'u1', username: 'me', displayName: 'Me', status: 'online', avatarUrl: null },
          { id: 'u2', username: 'alice', displayName: 'Alice', status: 'online', avatarUrl: null },
        ],
      },
      {
        id: 'conv-2',
        createdAt: '2024-01-02',
        members: [
          { id: 'u1', username: 'me', displayName: 'Me', status: 'online', avatarUrl: null },
          { id: 'u3', username: 'bob', displayName: 'Bob', status: 'idle', avatarUrl: null },
        ],
      },
    ];

    render(<DMSidebar />, { wrapper: Wrapper });

    const aliceButton = screen.getByText('Alice').closest('button')!;
    const bobButton = screen.getByText('Bob').closest('button')!;

    // Active conversation gets data-active="true" attribute
    expect(aliceButton.getAttribute('data-active')).toBe('true');
    expect(bobButton.getAttribute('data-active')).not.toBe('true');
  });

  it('clicking a conversation calls navigate with correct path', async () => {
    mockConversations = [
      {
        id: 'conv-1',
        createdAt: '2024-01-01',
        members: [
          { id: 'u1', username: 'me', displayName: 'Me', status: 'online', avatarUrl: null },
          { id: 'u2', username: 'alice', displayName: 'Alice', status: 'online', avatarUrl: null },
        ],
      },
    ];
    const user = userEvent.setup();

    render(<DMSidebar />, { wrapper: Wrapper });

    await user.click(screen.getByText('Alice'));

    expect(mockNavigate).toHaveBeenCalledWith('/channels/@me/conv-1');
  });

  it('shows empty state when no conversations', () => {
    mockConversations = [];

    render(<DMSidebar />, { wrapper: Wrapper });

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });

  it('shows loading skeletons while loading', () => {
    mockIsLoading = true;

    const { container } = render(<DMSidebar />, { wrapper: Wrapper });

    // The component renders SidebarMenuSkeleton components
    const skeletons = container.querySelectorAll('[data-sidebar="menu-skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('clicking Friends button navigates to /channels/@me', async () => {
    const user = userEvent.setup();

    render(<DMSidebar />, { wrapper: Wrapper });

    await user.click(screen.getByText('Friends'));

    expect(mockNavigate).toHaveBeenCalledWith('/channels/@me');
  });
});
