import { useParams } from 'react-router-dom';
import { useVoiceStore } from '../../stores/voiceStore';
import { useChannels } from '../../hooks/useChannels';
import { PhoneOff, Mic, MicOff, Headphones, HeadphoneOff } from 'lucide-react';

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
          className="text-[#949ba4] hover:text-[#ed4245] p-1 ml-2 shrink-0"
          title="Disconnect"
        >
          <PhoneOff size={20} />
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
          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
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
          {isDeafened ? <HeadphoneOff size={14} /> : <Headphones size={14} />}
          {isDeafened ? 'Undeafen' : 'Deafen'}
        </button>
      </div>
    </div>
  );
}
