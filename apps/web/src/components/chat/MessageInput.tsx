import { useRef, useState, useCallback } from 'react';
import type { Message } from '@quarrel/shared';
import { useSendMessage } from '../../hooks/useMessages';
import { useMessages } from '../../hooks/useMessages';
import { useUIStore } from '../../stores/uiStore';
import useWebSocket from 'react-use-websocket';
import { useAuthStore } from '../../stores/authStore';
import { getWsUrl } from '../../lib/getWsUrl';

export function MessageInput({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage();
  const replyingTo = useUIStore((s) => s.replyingTo);
  const setReplyingTo = useUIStore((s) => s.setReplyingTo);
  const { data } = useMessages(channelId);
  const messages = data?.pages.flatMap((p) => p.messages) ?? [];
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useAuthStore((s) => s.token);
  const { sendJsonMessage } = useWebSocket(token ? getWsUrl() : null, { share: true });

  const replyMessage = replyingTo ? messages.find((m: Message) => m.id === replyingTo) : null;

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    await sendMessage.mutateAsync({ channelId, content: trimmed, replyToId: replyingTo ?? undefined });
    setContent('');
    setReplyingTo(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, channelId, replyingTo, sendMessage, setReplyingTo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 300) + 'px';

    // Send typing indicator (throttled)
    if (!typingTimerRef.current) {
      sendJsonMessage({ event: 'typing:start', data: { channelId } });
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
      }, 3000);
    }
  };

  return (
    <div className="px-4 pb-2 flex-shrink-0">
      {replyMessage && (
        <div className="flex items-center gap-2 px-3 py-2 mb-1 bg-[#2b2d31] rounded-t-lg text-sm text-[#949ba4]">
          <span>
            Replying to <span className="font-medium text-white">{replyMessage.author?.displayName ?? 'Unknown'}</span>
          </span>
          <button
            onClick={() => setReplyingTo(null)}
            className="ml-auto text-[#949ba4] hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
          </button>
        </div>
      )}
      <div className={`bg-[#383a40] ${replyMessage ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="w-full bg-transparent text-[#dbdee1] placeholder-[#6d6f78] p-3 resize-none outline-none max-h-[300px]"
        />
      </div>
    </div>
  );
}
