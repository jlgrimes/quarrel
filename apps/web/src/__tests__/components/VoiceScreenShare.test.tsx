import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VoiceChannelView } from '../../components/voice/VoiceChannelView';
import { VoiceConnectionBar } from '../../components/voice/VoiceConnectionBar';

const mockStartScreenShare = vi.fn();
const mockStopScreenShare = vi.fn();
const mockJoinChannel = vi.fn();
const mockLeaveChannel = vi.fn();
const mockToggleMute = vi.fn();
const mockToggleDeafen = vi.fn();

let mockVoiceState = {
  currentChannelId: null as string | null,
  participants: [] as any[],
  isConnecting: false,
  isMuted: false,
  isDeafened: false,
  isScreenSharing: false,
  screenShareUserId: null as string | null,
  screenStream: null as MediaStream | null,
  peerConnections: new Map(),
  speakingUsers: new Set<string>(),
  localStream: null as MediaStream | null,
  joinChannel: mockJoinChannel,
  leaveChannel: mockLeaveChannel,
  toggleMute: mockToggleMute,
  toggleDeafen: mockToggleDeafen,
  startScreenShare: mockStartScreenShare,
  stopScreenShare: mockStopScreenShare,
};

vi.mock('../../stores/voiceStore', () => ({
  useVoiceStore: (selector: any) => selector(mockVoiceState),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'user-1', username: 'TestUser', displayName: 'Test User' },
      token: 'test-token',
    }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({ setMobileSidebarOpen: vi.fn() }),
  },
}));

vi.mock('../../hooks/useChannels', () => ({
  useChannels: () => ({
    data: [
      { id: 'voice-ch-1', name: 'General Voice', type: 'voice', serverId: 'server-1' },
    ],
  }),
}));

vi.mock('../../lib/analytics', () => ({
  analytics: { capture: vi.fn() },
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderWithRouter(ui: React.ReactElement, path = '/channels/server-1/voice-ch-1') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/channels/:serverId/:channelId" element={ui} />
          <Route path="/channels/:serverId" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVoiceState = {
    currentChannelId: null,
    participants: [],
    isConnecting: false,
    isMuted: false,
    isDeafened: false,
    isScreenSharing: false,
    screenShareUserId: null,
    screenStream: null,
    peerConnections: new Map(),
    speakingUsers: new Set(),
    localStream: null,
    joinChannel: mockJoinChannel,
    leaveChannel: mockLeaveChannel,
    toggleMute: mockToggleMute,
    toggleDeafen: mockToggleDeafen,
    startScreenShare: mockStartScreenShare,
    stopScreenShare: mockStopScreenShare,
  };
});

describe('VoiceChannelView - Screen Sharing', () => {
  it('shows screen sharing indicator on participant card when sharing', () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';
    mockVoiceState.screenShareUserId = 'user-2';
    mockVoiceState.participants = [
      {
        userId: 'user-1',
        username: 'TestUser',
        displayName: 'Test User',
        avatarUrl: null,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: false,
      },
      {
        userId: 'user-2',
        username: 'SharerUser',
        displayName: 'Sharer',
        avatarUrl: null,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: true,
      },
    ];

    renderWithRouter(<VoiceChannelView channelId="voice-ch-1" />);

    // Both participants should be visible
    expect(screen.getByText('Test User (You)')).toBeInTheDocument();
    expect(screen.getByText('Sharer')).toBeInTheDocument();

    // Screen share video should be visible
    expect(screen.getByTestId('screen-share-video')).toBeInTheDocument();
  });

  it('shows stop sharing button when self is sharing', () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';
    mockVoiceState.screenShareUserId = 'user-1';
    mockVoiceState.isScreenSharing = true;
    mockVoiceState.participants = [
      {
        userId: 'user-1',
        username: 'TestUser',
        displayName: 'Test User',
        avatarUrl: null,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: true,
      },
    ];

    renderWithRouter(<VoiceChannelView channelId="voice-ch-1" />);

    expect(screen.getByTestId('stop-screen-share-btn')).toBeInTheDocument();
    expect(screen.getByText('Stop Sharing')).toBeInTheDocument();
  });

  it('does not show stop sharing button when someone else is sharing', () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';
    mockVoiceState.screenShareUserId = 'user-2';
    mockVoiceState.isScreenSharing = false;
    mockVoiceState.participants = [
      {
        userId: 'user-2',
        username: 'SharerUser',
        displayName: 'Sharer',
        avatarUrl: null,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: true,
      },
    ];

    renderWithRouter(<VoiceChannelView channelId="voice-ch-1" />);

    expect(screen.queryByTestId('stop-screen-share-btn')).not.toBeInTheDocument();
  });

  it('shows sharer name on screen share overlay', () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';
    mockVoiceState.screenShareUserId = 'user-2';
    mockVoiceState.participants = [
      {
        userId: 'user-2',
        username: 'SharerUser',
        displayName: 'Sharer',
        avatarUrl: null,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: true,
      },
    ];

    renderWithRouter(<VoiceChannelView channelId="voice-ch-1" />);

    expect(screen.getByText("Sharer's screen")).toBeInTheDocument();
  });

  it('does not show screen share when no one is sharing', () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';
    mockVoiceState.participants = [
      {
        userId: 'user-1',
        username: 'TestUser',
        displayName: 'Test User',
        avatarUrl: null,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: false,
      },
    ];

    renderWithRouter(<VoiceChannelView channelId="voice-ch-1" />);

    expect(screen.queryByTestId('screen-share-video')).not.toBeInTheDocument();
  });
});

describe('VoiceConnectionBar - Screen Share Button', () => {
  it('renders Share button when connected', () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';

    renderWithRouter(<VoiceConnectionBar />);

    const shareBtn = screen.getByTestId('screen-share-toggle');
    expect(shareBtn).toBeInTheDocument();
    expect(shareBtn).toHaveTextContent('Share');
  });

  it('calls startScreenShare when Share button is clicked', async () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';
    const user = userEvent.setup();

    renderWithRouter(<VoiceConnectionBar />);

    await user.click(screen.getByTestId('screen-share-toggle'));
    expect(mockStartScreenShare).toHaveBeenCalledTimes(1);
  });

  it('calls stopScreenShare when Stop button is clicked while sharing', async () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';
    mockVoiceState.isScreenSharing = true;
    const user = userEvent.setup();

    renderWithRouter(<VoiceConnectionBar />);

    const shareBtn = screen.getByTestId('screen-share-toggle');
    expect(shareBtn).toHaveTextContent('Stop');
    await user.click(shareBtn);
    expect(mockStopScreenShare).toHaveBeenCalledTimes(1);
  });

  it('disables Share button when someone else is sharing', () => {
    mockVoiceState.currentChannelId = 'voice-ch-1';
    mockVoiceState.screenShareUserId = 'user-2';
    mockVoiceState.isScreenSharing = false;

    renderWithRouter(<VoiceConnectionBar />);

    const shareBtn = screen.getByTestId('screen-share-toggle');
    expect(shareBtn).toBeDisabled();
  });

  it('does not render when not in a voice channel', () => {
    mockVoiceState.currentChannelId = null;

    const { container } = renderWithRouter(<VoiceConnectionBar />);

    expect(container.innerHTML).toBe('');
  });
});
