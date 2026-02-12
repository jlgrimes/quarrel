import { useParams } from 'react-router-dom';
import { useVoiceStore } from '../../stores/voiceStore';
import { useChannels } from '../../hooks/useChannels';
import { PhoneOff, Mic, MicOff, Headphones, HeadphoneOff, MonitorUp, MonitorOff } from 'lucide-react';

export function VoiceConnectionBar() {
  const { serverId } = useParams();
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const screenShareUserId = useVoiceStore((s) => s.screenShareUserId);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const startScreenShare = useVoiceStore((s) => s.startScreenShare);
  const stopScreenShare = useVoiceStore((s) => s.stopScreenShare);
  const leaveChannel = useVoiceStore((s) => s.leaveChannel);
  const { data: channels = [] } = useChannels(serverId);

  if (!currentChannelId) return null;

  const channel = channels.find((c) => c.id === currentChannelId);
  const channelName = channel?.name ?? 'Voice Channel';
  const someoneElseSharing = screenShareUserId !== null && !isScreenSharing;

  return (
    <div className="bg-bg-tertiary px-3 py-2">
      {/* Connection info */}
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-green">Voice Connected</div>
          <div className="text-[11px] text-text-muted truncate">{channelName}</div>
        </div>
        <button
          onClick={leaveChannel}
          className="text-text-muted hover:text-red p-1 ml-2 shrink-0"
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
              ? 'bg-red/20 text-red'
              : 'bg-bg-modifier-hover text-text-normal hover:bg-bg-modifier-active'
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
              ? 'bg-red/20 text-red'
              : 'bg-bg-modifier-hover text-text-normal hover:bg-bg-modifier-active'
          }`}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          {isDeafened ? <HeadphoneOff size={14} /> : <Headphones size={14} />}
          {isDeafened ? 'Undeafen' : 'Deafen'}
        </button>
        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          disabled={someoneElseSharing}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
            isScreenSharing
              ? 'bg-brand/20 text-brand'
              : someoneElseSharing
                ? 'bg-bg-modifier-hover text-text-muted opacity-50 cursor-not-allowed'
                : 'bg-bg-modifier-hover text-text-normal hover:bg-bg-modifier-active'
          }`}
          title={isScreenSharing ? 'Stop Sharing' : someoneElseSharing ? 'Someone is sharing' : 'Share Screen'}
          data-testid="screen-share-toggle"
        >
          {isScreenSharing ? <MonitorOff size={14} /> : <MonitorUp size={14} />}
          {isScreenSharing ? 'Stop' : 'Share'}
        </button>
      </div>
    </div>
  );
}
