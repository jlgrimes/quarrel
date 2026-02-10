import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: {
        id: 'u1',
        username: 'testuser',
        displayName: 'Test User',
        email: 'test@test.com',
        customStatus: 'Hello',
        avatarUrl: null,
      },
      logout: vi.fn(),
      fetchUser: vi.fn(),
    }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      closeModal: vi.fn(),
    }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    updateProfile: vi.fn().mockResolvedValue({}),
    changePassword: vi.fn().mockResolvedValue({ success: true }),
    deleteAccount: vi.fn().mockResolvedValue({ success: true }),
    getSettings: vi.fn().mockResolvedValue({
      theme: 'dark',
      fontSize: 'normal',
      compactMode: false,
      notificationsEnabled: true,
      notificationSounds: true,
      allowDms: 'everyone',
    }),
    updateSettings: vi.fn().mockResolvedValue({}),
    getFriends: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../lib/analytics', () => ({
  analytics: { capture: vi.fn(), reset: vi.fn() },
}));

vi.mock('../../hooks/useAvatarUpload', () => ({
  useUploadAvatar: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useRemoveAvatar: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Import after mocks
import UserSettingsOverlay from '../../components/settings/UserSettingsOverlay';
import { analytics } from '../../lib/analytics';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserSettingsOverlay', () => {
  it('renders the full-screen overlay with section navigation', () => {
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    expect(screen.getByTestId('settings-overlay')).toBeInTheDocument();
    expect(screen.getByText('User Settings')).toBeInTheDocument();

    // Check navigation buttons exist in sidebar
    const nav = screen.getAllByRole('button');
    const navLabels = nav.map((b) => b.textContent);
    expect(navLabels).toContain('My Account');
    expect(navLabels).toContain('Profile');
    expect(navLabels).toContain('Appearance');
    expect(navLabels).toContain('Notifications');
    expect(navLabels).toContain('Voice & Audio');
    expect(navLabels).toContain('Privacy');
  });

  it('shows My Account section by default', () => {
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('test@test.com')).toBeInTheDocument();
    // "Change Password" appears as heading and button; verify heading exists
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('switches to Profile section on click', async () => {
    const user = userEvent.setup();
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    // Click the Profile nav button (it's a button element, not a heading)
    const profileBtn = screen.getAllByRole('button').find(
      (b) => b.textContent === 'Profile'
    )!;
    await user.click(profileBtn);

    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByText('Custom Status')).toBeInTheDocument();
  });

  it('switches to Appearance section on click', async () => {
    const user = userEvent.setup();
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    const appearanceBtn = screen.getAllByRole('button').find(
      (b) => b.textContent === 'Appearance'
    )!;
    await user.click(appearanceBtn);

    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });
    expect(screen.getByText('Font Size')).toBeInTheDocument();
    expect(screen.getByText('Compact Mode')).toBeInTheDocument();
  });

  it('closes on X button click', async () => {
    const user = userEvent.setup();
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    await user.click(screen.getByLabelText('Close settings'));
    expect(screen.getByLabelText('Close settings')).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('settings-overlay')).toBeInTheDocument();
  });

  it('captures analytics on open', () => {
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    expect(analytics.capture).toHaveBeenCalledWith('settings:opened');
  });

  it('captures section change analytics', async () => {
    const user = userEvent.setup();
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    const profileBtn = screen.getAllByRole('button').find(
      (b) => b.textContent === 'Profile'
    )!;
    await user.click(profileBtn);

    expect(analytics.capture).toHaveBeenCalledWith('settings:section_changed', {
      section: 'profile',
    });
  });

  it('shows delete confirmation when Delete Account button is clicked', async () => {
    const user = userEvent.setup();
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    // Find the Delete Account button in the danger zone (not the h2 heading)
    const deleteSection = screen.getByText('This action is irreversible.', { exact: false }).closest('div')!;
    const deleteBtn = within(deleteSection).getByRole('button', { name: /delete account/i });
    await user.click(deleteBtn);

    expect(
      screen.getByText('Enter your password to confirm')
    ).toBeInTheDocument();
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('hides delete confirmation on Cancel click', async () => {
    const user = userEvent.setup();
    render(<UserSettingsOverlay />, { wrapper: Wrapper });

    // Open delete confirmation
    const deleteSection = screen.getByText('This action is irreversible.', { exact: false }).closest('div')!;
    const deleteBtn = within(deleteSection).getByRole('button', { name: /delete account/i });
    await user.click(deleteBtn);
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Confirm Delete')).not.toBeInTheDocument();
  });
});
