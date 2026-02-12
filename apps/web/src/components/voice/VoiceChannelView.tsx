import { memo, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVoiceStore } from '../../stores/voiceStore';
import { useAuthStore } from '../../stores/authStore';
import { useChannels } from '../../hooks/useChannels';
import { useUIStore } from '../../stores/uiStore';
import type { VoiceParticipant } from '@quarrel/shared';
import { Button } from '@/components/ui/button';

const ParticipantCard = memo(function ParticipantCard({ participant }: { participant: VoiceParticipant }) {
  const currentUser = useAuthStore((s) => s.user);
  const speakingUsers = useVoiceStore((s) => s.speakingUsers);
  const isSelf = participant.userId === currentUser?.id;
  const isSpeaking = speakingUsers.has(participant.userId);
  const name = participant.displayName || participant.username;
  const letter = name.charAt(0).toUpperCase();

  // Deterministic color from userId
  const colors = ['#0ea5a6', '#57f287', '#fee75c', '#eb459e', '#ed4245', '#3ba55c'];
  const colorIndex = participant.userId.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <div
        className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold transition-shadow ${
          isSpeaking ? 'ring-[3px] ring-green' : ''
        }`}
        style={{ backgroundColor: bgColor }}
      >
        {participant.avatarUrl ? (
          <img src={participant.avatarUrl} className="w-full h-full rounded-full object-cover" alt={name} />
        ) : (
          letter
        )}
        {participant.isMuted && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a3.5 3.5 0 0 0-3.5 3.5v5a3.5 3.5 0 0 0 7 0v-5A3.5 3.5 0 0 0 12 2z" />
              <path d="M6 9.5a1 1 0 0 0-2 0A8 8 0 0 0 11 17.42V20H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.58A8 8 0 0 0 20 9.5a1 1 0 0 0-2 0 6 6 0 0 1-12 0z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        )}
        {participant.isDeafened && !participant.isMuted && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        )}
        {participant.isScreenSharing && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-brand rounded-full flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="2" fill="none" />
              <path d="M8 21h8M12 17v4" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        )}
      </div>
      <span className={`text-sm ${isSelf ? 'text-white font-medium' : 'text-text-normal'}`}>
        {name}{isSelf ? ' (You)' : ''}
      </span>
    </div>
  );
});

function ScreenShareView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenShareUserId = useVoiceStore((s) => s.screenShareUserId);
  const participants = useVoiceStore((s) => s.participants);
  const peerConnections = useVoiceStore((s) => s.peerConnections);
  const screenStream = useVoiceStore((s) => s.screenStream);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const currentUser = useAuthStore((s) => s.user);
  const stopScreenShare = useVoiceStore((s) => s.stopScreenShare);

  const sharer = participants.find((p) => p.userId === screenShareUserId);
  const isSelfSharing = screenShareUserId === currentUser?.id;
  const sharerName = sharer ? (sharer.displayName || sharer.username) : 'Unknown';

  useEffect(() => {
    if (!videoRef.current || !screenShareUserId) return;

    if (isSelfSharing && screenStream) {
      videoRef.current.srcObject = screenStream;
    } else {
      // Get the remote screen stream from the peer connection
      const peer = peerConnections.get(screenShareUserId);
      if (peer) {
        const receivers = peer.connection.getReceivers();
        const videoReceiver = receivers.find((r) => r.track?.kind === 'video');
        if (videoReceiver?.track) {
          videoRef.current.srcObject = new MediaStream([videoReceiver.track]);
        }
      }
    }
  }, [screenShareUserId, isSelfSharing, screenStream, peerConnections]);

  if (!screenShareUserId) return null;

  return (
    <div className="flex flex-col items-center w-full px-4 pb-4">
      <div className="relative w-full max-w-4xl bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelfSharing}
          className="w-full h-auto max-h-[60vh] object-contain"
          data-testid="screen-share-video"
        />
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" />
          </svg>
          {sharerName}'s screen
        </div>
        {isSelfSharing && (
          <Button
            onClick={stopScreenShare}
            size="sm"
            className="absolute top-2 right-2 bg-red hover:bg-red-hover text-white text-xs"
            data-testid="stop-screen-share-btn"
          >
            Stop Sharing
          </Button>
        )}
      </div>
    </div>
  );
}

export function VoiceChannelView({ channelId }: { channelId: string }) {
  const { serverId } = useParams();
  const { data: channels = [] } = useChannels(serverId);
  const channel = channels.find((c) => c.id === channelId);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const participants = useVoiceStore((s) => s.participants);
  const joinChannel = useVoiceStore((s) => s.joinChannel);
  const isConnecting = useVoiceStore((s) => s.isConnecting);
  const screenShareUserId = useVoiceStore((s) => s.screenShareUserId);

  const isInThisChannel = currentChannelId === channelId;
  const channelName = channel?.name ?? 'Voice Channel';

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-bg-tertiary shrink-0 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => useUIStore.getState().setMobileSidebarOpen(true)}
          className="mr-2 text-text-label hover:text-white md:hidden flex-shrink-0 hover:bg-transparent"
          aria-label="Open sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </Button>
        <span className="text-lg mr-2">&#x1F50A;</span>
        <h2 className="font-semibold text-white">{channelName}</h2>
      </div>

      {/* Participants grid */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
        {isInThisChannel ? (
          <>
            {screenShareUserId && <ScreenShareView />}
            {participants.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-4 p-8">
                {participants.map((p) => (
                  <ParticipantCard key={p.userId} participant={p} />
                ))}
              </div>
            ) : (
              <p className="text-text-muted">No one else is here yet...</p>
            )}
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M12 2a3.5 3.5 0 0 0-3.5 3.5v5a3.5 3.5 0 0 0 7 0v-5A3.5 3.5 0 0 0 12 2z" />
                <path d="M6 9.5a1 1 0 0 0-2 0A8 8 0 0 0 11 17.42V20H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.58A8 8 0 0 0 20 9.5a1 1 0 0 0-2 0 6 6 0 0 1-12 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{channelName}</h3>
            <p className="text-text-muted mb-6">Click below to join the voice channel</p>
            <Button
              onClick={() => joinChannel(channelId)}
              disabled={isConnecting}
              className="bg-green-dark hover:bg-green-dark-hover text-white"
            >
              {isConnecting ? 'Connecting...' : 'Join Voice'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
