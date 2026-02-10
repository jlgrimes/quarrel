import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import ServerSidebar from '../../components/navigation/ServerSidebar';

const mockNavigate = vi.fn();
const mockOpenModal = vi.fn();

const mockServers = [
  { id: 's1', name: 'Gaming', iconUrl: null, ownerId: 'u1', inviteCode: 'abc', createdAt: '' },
  { id: 's2', name: 'Dev', iconUrl: null, ownerId: 'u2', inviteCode: 'def', createdAt: '' },
];

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ serverId: 's1' }),
}));

vi.mock('../../hooks/useServers', () => ({
  useServers: () => ({ data: mockServers }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      openModal: mockOpenModal,
    }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ServerSidebar', () => {
  it('renders server icons', () => {
    render(<ServerSidebar />, { wrapper: Wrapper });

    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('shows create server button', () => {
    render(<ServerSidebar />, { wrapper: Wrapper });

    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('renders home/DM button', () => {
    render(<ServerSidebar />, { wrapper: Wrapper });

    expect(screen.getByText('Q')).toBeInTheDocument();
  });
});
