import { useParams } from 'react-router-dom';
import { useVoiceStore } from '../../stores/voiceStore';
import { useChannels } from '../../hooks/useChannels';

export function VoiceConnectionBar() {
  const { serverId } = useParams();
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const leaveChannel = useVoiceStore((s) => s.leaveChannel);
  const { data: channels = [] } = useChannels(serverId);

  if (!currentChannelId) return null;

  const channel = channels.find((c) => c.id === currentChannelId);
  const channelName = channel?.name ?? 'Voice Channel';

  return (
    <div className="bg-[#232428] px-3 py-2">
      {/* Connection info */}
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[#23a559]">Voice Connected</div>
          <div className="text-[11px] text-[#949ba4] truncate">{channelName}</div>
        </div>
        <button
          onClick={leaveChannel}
          className="text-[#949ba4] hover:text-[#dbdee1] p-1 ml-2 shrink-0"
          title="Disconnect"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.68 16.07l3.92-3.11V9.59c1.34-.65 2.86-1.09 4.4-1.09 1.54 0 3.06.44 4.4 1.09v3.37l3.92 3.11c.31.25.76.04.76-.35V5.93c0-.26-.16-.5-.41-.6C18.36 4.41 15.42 3.5 12 3.5S5.64 4.41 3.33 5.33c-.25.1-.41.34-.41.6v9.79c0 .39.45.6.76.35z" />
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="flex gap-1">
        <button
          onClick={toggleMute}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
            isMuted
              ? 'bg-[#ed4245]/20 text-[#ed4245]'
              : 'bg-[#383a40] text-[#dbdee1] hover:bg-[#404249]'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a3.5 3.5 0 0 0-3.5 3.5v5a3.5 3.5 0 0 0 7 0v-5A3.5 3.5 0 0 0 12 2z" />
            <path d="M6 9.5a1 1 0 0 0-2 0A8 8 0 0 0 11 17.42V20H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.58A8 8 0 0 0 20 9.5a1 1 0 0 0-2 0 6 6 0 0 1-12 0z" />
            {isMuted && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />}
          </svg>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={toggleDeafen}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
            isDeafened
              ? 'bg-[#ed4245]/20 text-[#ed4245]'
              : 'bg-[#383a40] text-[#dbdee1] hover:bg-[#404249]'
          }`}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.5 16.5v-9l7 4.5-7 4.5z" />
            {isDeafened && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />}
          </svg>
          {isDeafened ? 'Undeafen' : 'Deafen'}
        </button>
      </div>
    </div>
  );
}
