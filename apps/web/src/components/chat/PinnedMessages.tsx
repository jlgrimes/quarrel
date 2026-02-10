import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../hooks/queryKeys';
import { useUIStore } from '../../stores/uiStore';
import type { Message } from '@quarrel/shared';
import { analytics } from '../../lib/analytics';

function formatTimestamp(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PinnedMessages({ channelId }: { channelId: string }) {
  const togglePins = useUIStore((s) => s.togglePins);
  const { data: pinnedMessages = [], isLoading } = useQuery({
    queryKey: queryKeys.pins(channelId),
    queryFn: () => api.getPinnedMessages(channelId),
  });

  const handleUnpin = async (messageId: string) => {
    await api.unpinMessage(messageId);
    analytics.capture('message:unpin', { messageId, channelId });
  };

  return (
    <div className="border-b border-[#1e1f22] bg-[#2b2d31] max-h-64 overflow-y-auto flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1f22]">
        <span className="text-sm font-semibold text-white">Pinned Messages</span>
        <button
          onClick={togglePins}
          className="text-[#949ba4] hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 text-sm text-[#949ba4]">Loading...</div>
      ) : pinnedMessages.length === 0 ? (
        <div className="p-4 text-sm text-[#949ba4] text-center">No pinned messages yet.</div>
      ) : (
        <div>
          {pinnedMessages.map((msg: Message) => (
            <div key={msg.id} className="group px-4 py-2 hover:bg-[#383a40] border-b border-[#1e1f22] last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-white truncate">
                    {msg.author?.displayName ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-[#949ba4]">
                    {formatTimestamp(msg.createdAt)}
                  </span>
                </div>
                <button
                  onClick={() => handleUnpin(msg.id)}
                  className="hidden group-hover:block text-[#949ba4] hover:text-white text-xs"
                  title="Unpin"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
                  </svg>
                </button>
              </div>
              <div className="text-sm text-[#dbdee1] mt-0.5 break-words">{msg.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
