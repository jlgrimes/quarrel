import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateServerModal from '../../components/modals/CreateServerModal';

const mockNavigate = vi.fn();
const mockCreateServer = vi.fn();
const mockCloseModal = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../stores/serverStore', () => ({
  useServerStore: (selector: any) =>
    selector({
      createServer: mockCreateServer,
    }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      closeModal: mockCloseModal,
    }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateServerModal', () => {
  it('renders server name input', () => {
    render(<CreateServerModal />);

    expect(screen.getByLabelText(/server name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('create button calls createServer', async () => {
    const mockServer = { id: 's-new', name: 'My Server', iconUrl: null, ownerId: 'u1', inviteCode: 'xyz', createdAt: '' };
    mockCreateServer.mockResolvedValueOnce(mockServer);
    const user = userEvent.setup();

    render(<CreateServerModal />);

    await user.type(screen.getByLabelText(/server name/i), 'My Server');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(mockCreateServer).toHaveBeenCalledWith('My Server');
  });

  it('closes modal on success', async () => {
    const mockServer = { id: 's-new', name: 'Test', iconUrl: null, ownerId: 'u1', inviteCode: 'xyz', createdAt: '' };
    mockCreateServer.mockResolvedValueOnce(mockServer);
    const user = userEvent.setup();

    render(<CreateServerModal />);

    await user.type(screen.getByLabelText(/server name/i), 'Test');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(mockCloseModal).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/channels/s-new');
  });
});
