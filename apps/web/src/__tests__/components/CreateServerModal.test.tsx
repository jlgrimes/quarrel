import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreateServerModal from '../../components/modals/CreateServerModal';

const mockNavigate = vi.fn();
const mockCloseModal = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../hooks/useServers', () => ({
  useCreateServer: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      closeModal: mockCloseModal,
    }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateServerModal', () => {
  it('renders server name input', () => {
    render(<CreateServerModal />, { wrapper: Wrapper });

    expect(screen.getByLabelText(/server name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('create button calls createServer', async () => {
    const mockServer = { id: 's-new', name: 'My Server', iconUrl: null, ownerId: 'u1', inviteCode: 'xyz', createdAt: '' };
    mockMutateAsync.mockResolvedValueOnce(mockServer);
    const user = userEvent.setup();

    render(<CreateServerModal />, { wrapper: Wrapper });

    await user.type(screen.getByLabelText(/server name/i), 'My Server');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith('My Server');
  });

  it('closes modal on success', async () => {
    const mockServer = { id: 's-new', name: 'Test', iconUrl: null, ownerId: 'u1', inviteCode: 'xyz', createdAt: '' };
    mockMutateAsync.mockResolvedValueOnce(mockServer);
    const user = userEvent.setup();

    render(<CreateServerModal />, { wrapper: Wrapper });

    await user.type(screen.getByLabelText(/server name/i), 'Test');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(mockCloseModal).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/channels/s-new');
  });
});
