import { useMemo, useEffect } from 'react';
import { useChannels } from '../../hooks/useChannels';
import { useMembers } from '../../hooks/useMembers';
import { useAckChannel } from '../../hooks/useReadState';
import { useUIStore } from '../../stores/uiStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { PinnedMessages } from './PinnedMessages';
import { Button } from '@/components/ui/button';

export function ChatArea({ channelId, serverId }: { channelId: string; serverId: string }) {
  const { data: channels = [] } = useChannels(serverId);
  const { data: members } = useMembers(serverId);
  const channel = useMemo(() => channels.find((c) => c.id === channelId), [channels, channelId]);
  const ackChannel = useAckChannel();
  const channelLoaded = !!channel;

  // Auto-ack when channel data is available (ensures cache is populated for the update)
  useEffect(() => {
    if (channelId && channelLoaded) {
      ackChannel.mutate(channelId);
    }
  }, [channelId, channelLoaded]);

  const toggleMemberList = useUIStore((s) => s.toggleMemberList);
  const showMemberList = useUIStore((s) => s.showMemberList);
  const togglePins = useUIStore((s) => s.togglePins);
  const showPins = useUIStore((s) => s.showPins);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const channelName = channel?.name ?? 'unknown';

  return (
    <div className="flex flex-col h-full bg-[#313338]">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-[#1e1f22] flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="mr-1 text-[#b5bac1] hover:text-white md:hidden flex-shrink-0"
            aria-label="Open sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#80848e" className="flex-shrink-0">
            <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41001 9L8.35001 15H14.35L15.41 9H9.41001Z" />
          </svg>
          <h2 className="font-semibold text-white truncate">{channelName}</h2>
          {channel?.topic && (
            <>
              <div className="w-px h-5 bg-[#3f4147] mx-2 flex-shrink-0" />
              <span className="text-sm text-[#949ba4] truncate">{channel.topic}</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePins}
          className={`${showPins ? 'text-white' : 'text-[#949ba4]'} hover:text-white hover:bg-transparent`}
          title="Pinned Messages"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 12.87C19 12.61 18.86 12.37 18.64 12.23L15 10V5.5C15.55 5.22 16 4.65 16 4C16 3.17 15.33 2.5 14.5 2.5H9.5C8.67 2.5 8 3.17 8 4C8 4.65 8.45 5.22 9 5.5V10L5.36 12.23C5.14 12.37 5 12.61 5 12.87V14C5 14.55 5.45 15 6 15H10.5V19L9 21.5V22H15V21.5L13.5 19V15H18C18.55 15 19 14.55 19 14V12.87Z" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMemberList}
          className={`${showMemberList ? 'text-white' : 'text-[#949ba4]'} hover:text-white hover:bg-transparent`}
          title="Toggle Member List"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006ZM20 20.006H22V19.006C22 16.4498 20.2085 14.4503 17.2164 13.3384C19.3019 14.4484 20 16.2273 20 18.006V20.006Z" />
            <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM18 8.00598C18 9.54498 17.254 10.906 16.1 11.716C17.545 10.891 18.5 9.356 18.5 7.60598C18.5 5.67698 17.345 4.00598 15.75 3.39698C17.1 3.83398 18 5.79798 18 8.00598Z" />
          </svg>
        </Button>
      </div>

      {/* Pinned Messages Panel */}
      {showPins && <PinnedMessages channelId={channelId} />}

      {/* Messages */}
      <MessageList channelId={channelId} lastReadMessageId={(channel as any)?.lastReadMessageId} members={members} />

      {/* Input */}
      <MessageInput channelId={channelId} channelName={channelName} members={members} />
      <TypingIndicator channelId={channelId} />
    </div>
  );
}
