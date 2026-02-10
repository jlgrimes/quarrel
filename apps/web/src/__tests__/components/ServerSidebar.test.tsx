import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

vi.mock('../../stores/serverStore', () => ({
  useServerStore: (selector: any) =>
    selector({
      servers: mockServers,
      channels: [],
    }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      openModal: mockOpenModal,
    }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ServerSidebar', () => {
  it('renders server icons', () => {
    render(<ServerSidebar />);

    // Server icons show first letter of name
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('shows create server button', () => {
    render(<ServerSidebar />);

    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('renders home/DM button', () => {
    render(<ServerSidebar />);

    // The home button shows "Q" (for Quarrel)
    expect(screen.getByText('Q')).toBeInTheDocument();
  });
});
