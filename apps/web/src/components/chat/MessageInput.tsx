import { useRef, useState, useCallback, useMemo } from 'react';
import type { Message, Member } from '@quarrel/shared';
import { useSendMessage } from '../../hooks/useMessages';
import { useMessages } from '../../hooks/useMessages';
import { useUIStore } from '../../stores/uiStore';
import useWebSocket from 'react-use-websocket';
import { useAuthStore } from '../../stores/authStore';
import { getWsUrl } from '../../lib/getWsUrl';
import { analytics } from '../../lib/analytics';
import { EmojiPicker } from './EmojiPicker';
import { normalizeChronological } from '../../lib/messageOrder';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function MessageInput({ channelId, channelName, members }: { channelId: string; channelName: string; members?: Member[] }) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage();
  const replyingTo = useUIStore((s) => s.replyingTo);
  const setReplyingTo = useUIStore((s) => s.setReplyingTo);
  const { data } = useMessages(channelId);
  const messages = useMemo(
    () => normalizeChronological(data?.pages.flatMap((p) => p.messages) ?? []),
    [data],
  );
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useAuthStore((s) => s.token);
  const { sendJsonMessage } = useWebSocket(token ? getWsUrl(token) : null, { share: true });

  const replyMessage = replyingTo ? messages.find((m: Message) => m.id === replyingTo) : null;

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || !members) return [];
    const q = mentionQuery.toLowerCase();
    const results: Array<{ userId: string; displayName: string; username?: string; isBot?: boolean }> = [];
    // Always include @everyone
    if ('everyone'.startsWith(q)) {
      results.push({ userId: 'everyone', displayName: 'everyone' });
    }
    for (const m of members) {
      const name = m.user?.displayName ?? m.nickname ?? '';
      const username = m.user?.username ?? '';
      if (name.toLowerCase().startsWith(q) || username.toLowerCase().startsWith(q)) {
        results.push({ userId: m.userId, displayName: name || username, username, isBot: (m.user as any)?.isBot });
      }
    }
    return results.slice(0, 8);
  }, [mentionQuery, members]);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const hasMentions = /<@[a-zA-Z0-9-]+>/.test(trimmed);
    await sendMessage.mutateAsync({ channelId, content: trimmed, replyToId: replyingTo ?? undefined });
    analytics.capture('message:send', { channelId });
    if (hasMentions) {
      analytics.capture('message:mention', { channelId });
    }
    setContent('');
    setReplyingTo(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, channelId, replyingTo, sendMessage, setReplyingTo]);

  const insertMention = useCallback((userId: string, displayName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    // Find the @ that started this mention
    let atPos = cursorPos - 1;
    while (atPos >= 0 && text[atPos] !== '@') atPos--;
    if (atPos < 0) return;

    const before = text.slice(0, atPos);
    const after = text.slice(cursorPos);
    const mention = `<@${userId}> `;
    const newContent = before + mention + after;
    setContent(newContent);
    setMentionQuery(null);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      const newPos = before.length + mention.length;
      textarea.selectionStart = textarea.selectionEnd = newPos;
      textarea.focus();
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Mention autocomplete navigation
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selected = mentionSuggestions[mentionIndex];
        if (selected) {
          insertMention(selected.userId, selected.displayName);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      // Set cursor position after the inserted emoji
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      });
    } else {
      setContent(content + emoji);
    }
    setShowEmojiPicker(false);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 300) + 'px';

    // Detect @mention query
    const cursorPos = el.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }

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
        <div className="flex items-center gap-2 px-3 py-2 mb-1 bg-bg-secondary rounded-t-lg text-sm text-text-muted">
          <span>
            Replying to <span className="font-medium text-white">{replyMessage.author?.displayName ?? 'Unknown'}</span>
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setReplyingTo(null)}
            className="ml-auto text-text-muted hover:text-white hover:bg-transparent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
          </Button>
        </div>
      )}
      <div className={`relative bg-bg-modifier-hover ${replyMessage ? 'rounded-b-lg' : 'rounded-lg'}`}>
        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-bg-secondary border border-bg-tertiary rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
            {mentionSuggestions.map((s, idx) => (
              <Button
                key={s.userId}
                variant="ghost"
                size="sm"
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm ${
                  idx === mentionIndex ? 'bg-brand text-white' : 'text-text-normal hover:bg-bg-modifier-hover'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s.userId, s.displayName);
                }}
                onMouseEnter={() => setMentionIndex(idx)}
              >
                <span className="font-medium">{s.displayName}</span>
                {s.isBot && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white/85 leading-none bg-white/10 border border-white/10">
                    AI
                  </span>
                )}
                {s.username && s.userId !== 'everyone' && (
                  <span className="text-xs text-text-muted">@{s.username}</span>
                )}
              </Button>
            ))}
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="w-full border-none bg-transparent text-text-normal placeholder-text-muted p-3 pr-10 resize-none shadow-none outline-none focus-visible:ring-0 max-h-[300px] min-h-0"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="absolute right-2 top-2.5 text-text-label hover:text-white transition-colors hover:bg-transparent"
          title="Emoji"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        </Button>
        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-2 z-50">
            <EmojiPicker
              onSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
