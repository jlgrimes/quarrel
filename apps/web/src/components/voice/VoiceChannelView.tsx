import { memo } from 'react';
import { useParams } from 'react-router-dom';
import { useVoiceStore } from '../../stores/voiceStore';
import { useAuthStore } from '../../stores/authStore';
import { useChannels } from '../../hooks/useChannels';
import { useUIStore } from '../../stores/uiStore';
import type { VoiceParticipant } from '@quarrel/shared';

const ParticipantCard = memo(function ParticipantCard({ participant }: { participant: VoiceParticipant }) {
  const currentUser = useAuthStore((s) => s.user);
  const speakingUsers = useVoiceStore((s) => s.speakingUsers);
  const isSelf = participant.userId === currentUser?.id;
  const isSpeaking = speakingUsers.has(participant.userId);
  const name = participant.displayName || participant.username;
  const letter = name.charAt(0).toUpperCase();

  // Deterministic color from userId
  const colors = ['#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245', '#3ba55c'];
  const colorIndex = participant.userId.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <div
        className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold transition-shadow ${
          isSpeaking ? 'ring-[3px] ring-[#23a559]' : ''
        }`}
        style={{ backgroundColor: bgColor }}
      >
        {participant.avatarUrl ? (
          <img src={participant.avatarUrl} className="w-full h-full rounded-full object-cover" alt={name} />
        ) : (
          letter
        )}
        {participant.isMuted && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#ed4245] rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a3.5 3.5 0 0 0-3.5 3.5v5a3.5 3.5 0 0 0 7 0v-5A3.5 3.5 0 0 0 12 2z" />
              <path d="M6 9.5a1 1 0 0 0-2 0A8 8 0 0 0 11 17.42V20H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.58A8 8 0 0 0 20 9.5a1 1 0 0 0-2 0 6 6 0 0 1-12 0z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        )}
        {participant.isDeafened && !participant.isMuted && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#ed4245] rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        )}
      </div>
      <span className={`text-sm ${isSelf ? 'text-white font-medium' : 'text-[#dbdee1]'}`}>
        {name}{isSelf ? ' (You)' : ''}
      </span>
    </div>
  );
});

export function VoiceChannelView({ channelId }: { channelId: string }) {
  const { serverId } = useParams();
  const { data: channels = [] } = useChannels(serverId);
  const channel = channels.find((c) => c.id === channelId);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const participants = useVoiceStore((s) => s.participants);
  const joinChannel = useVoiceStore((s) => s.joinChannel);
  const isConnecting = useVoiceStore((s) => s.isConnecting);

  const isInThisChannel = currentChannelId === channelId;
  const channelName = channel?.name ?? 'Voice Channel';

  return (
    <div className="flex flex-col h-full bg-[#313338]">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-[#1e1f22] shrink-0 shadow-sm">
        <button
          onClick={() => useUIStore.getState().setMobileSidebarOpen(true)}
          className="mr-2 text-[#b5bac1] hover:text-white md:hidden flex-shrink-0"
          aria-label="Open sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
        <span className="text-lg mr-2">&#x1F50A;</span>
        <h2 className="font-semibold text-white">{channelName}</h2>
      </div>

      {/* Participants grid */}
      <div className="flex-1 flex items-center justify-center">
        {isInThisChannel ? (
          participants.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-4 p-8">
              {participants.map((p) => (
                <ParticipantCard key={p.userId} participant={p} />
              ))}
            </div>
          ) : (
            <p className="text-[#949ba4]">No one else is here yet...</p>
          )
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#5865f2] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M12 2a3.5 3.5 0 0 0-3.5 3.5v5a3.5 3.5 0 0 0 7 0v-5A3.5 3.5 0 0 0 12 2z" />
                <path d="M6 9.5a1 1 0 0 0-2 0A8 8 0 0 0 11 17.42V20H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.58A8 8 0 0 0 20 9.5a1 1 0 0 0-2 0 6 6 0 0 1-12 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{channelName}</h3>
            <p className="text-[#949ba4] mb-6">Click below to join the voice channel</p>
            <button
              onClick={() => joinChannel(channelId)}
              disabled={isConnecting}
              className="px-6 py-2.5 bg-[#248046] hover:bg-[#1a6334] text-white rounded font-medium transition-colors disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Join Voice'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
