import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNotificationStore, _resetToastId } from '../../stores/notificationStore';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../lib/analytics', () => ({
  analytics: {
    capture: vi.fn(),
  },
}));

import NotificationToast from '../../components/NotificationToast';

beforeEach(() => {
  vi.clearAllMocks();
  _resetToastId();
  useNotificationStore.setState({
    enabled: true,
    soundEnabled: true,
    desktopEnabled: true,
    browserPermission: 'default',
    channelOverrides: {},
    toasts: [],
  });
});

describe('NotificationToast', () => {
  it('renders nothing when no toasts', () => {
    const { container } = render(<NotificationToast />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toast with title and body', () => {
    useNotificationStore.getState().addToast({
      title: 'New DM',
      body: 'Hello there!',
      channelId: 'ch-1',
    });

    render(<NotificationToast />);

    expect(screen.getByText('New DM')).toBeInTheDocument();
    expect(screen.getByText('Hello there!')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    useNotificationStore.getState().addToast({ title: 'Toast 1', body: 'Body 1' });
    useNotificationStore.getState().addToast({ title: 'Toast 2', body: 'Body 2' });

    render(<NotificationToast />);

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
  });

  it('dismisses toast on X click', async () => {
    const user = userEvent.setup();

    useNotificationStore.getState().addToast({ title: 'Dismiss me', body: 'Test' });

    render(<NotificationToast />);

    expect(screen.getByText('Dismiss me')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Dismiss notification'));

    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('navigates to DM channel on toast click', async () => {
    const user = userEvent.setup();

    useNotificationStore.getState().addToast({
      title: 'DM Toast',
      body: 'Hello',
      channelId: 'dm-1',
    });

    render(<NotificationToast />);

    await user.click(screen.getByText('DM Toast'));

    expect(mockNavigate).toHaveBeenCalledWith('/channels/@me/dm-1');
  });

  it('navigates to server channel on toast click', async () => {
    const user = userEvent.setup();

    useNotificationStore.getState().addToast({
      title: 'Mention',
      body: 'You were mentioned',
      channelId: 'ch-1',
      serverId: 'srv-1',
    });

    render(<NotificationToast />);

    await user.click(screen.getByText('Mention'));

    expect(mockNavigate).toHaveBeenCalledWith('/channels/srv-1/ch-1');
  });

  it('has role=alert for accessibility', () => {
    useNotificationStore.getState().addToast({ title: 'Alert', body: 'Test' });

    render(<NotificationToast />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
