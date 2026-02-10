import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsModal from '../../components/modals/SettingsModal';

const mockCloseModal = vi.fn();
const mockLogout = vi.fn();
const mockFetchUser = vi.fn();
const mockUploadMutate = vi.fn();
const mockRemoveMutate = vi.fn();

let mockUser: any = {
  id: 'u1',
  username: 'testuser',
  displayName: 'Test User',
  customStatus: 'Hello',
  avatarUrl: null,
};

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: mockUser,
      logout: mockLogout,
      fetchUser: mockFetchUser,
    }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      closeModal: mockCloseModal,
    }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    updateProfile: vi.fn(),
  },
}));

vi.mock('../../lib/analytics', () => ({
  analytics: { capture: vi.fn() },
}));

vi.mock('../../hooks/useAvatarUpload', () => ({
  useUploadAvatar: () => ({
    mutate: mockUploadMutate,
    isPending: false,
  }),
  useRemoveAvatar: () => ({
    mutate: mockRemoveMutate,
    isPending: false,
  }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = {
    id: 'u1',
    username: 'testuser',
    displayName: 'Test User',
    customStatus: 'Hello',
    avatarUrl: null,
  };
});

describe('SettingsModal', () => {
  it('renders avatar fallback when no avatarUrl', () => {
    render(<SettingsModal />, { wrapper: Wrapper });

    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders remove avatar option when avatarUrl exists', () => {
    mockUser = { ...mockUser, avatarUrl: 'https://example.com/avatar.png' };

    render(<SettingsModal />, { wrapper: Wrapper });

    // When avatarUrl is set, the Remove Avatar button should appear
    expect(screen.getByText('Remove Avatar')).toBeInTheDocument();
    // The Avatar label should also be present
    expect(screen.getByText('Avatar')).toBeInTheDocument();
  });

  it('file input triggers on avatar click', async () => {
    const user = userEvent.setup();
    render(<SettingsModal />, { wrapper: Wrapper });

    const avatarArea = screen.getByText('T').closest('.group');
    expect(avatarArea).toBeTruthy();
    await user.click(avatarArea!);

    // The hidden file input should exist
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/gif,image/webp');
  });

  it('shows remove button only when avatar exists', () => {
    // No avatar - no remove button
    render(<SettingsModal />, { wrapper: Wrapper });
    expect(screen.queryByText('Remove Avatar')).not.toBeInTheDocument();

    // With avatar - show remove button
    mockUser = { ...mockUser, avatarUrl: 'https://example.com/avatar.png' };
    const { unmount } = render(<SettingsModal />, { wrapper: Wrapper });
    expect(screen.getByText('Remove Avatar')).toBeInTheDocument();
    unmount();
  });
});
