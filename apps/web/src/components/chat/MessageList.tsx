import { useEffect, useRef, useCallback } from 'react';
import type { Message } from '@quarrel/shared';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../lib/api';

function formatTimestamp(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
}

function formatDateSeparator(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function shouldGroup(prev: Message, curr: Message): boolean {
  if (prev.authorId !== curr.authorId) return false;
  if (curr.replyToId) return false;
  const timeDiff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return timeDiff < 5 * 60 * 1000;
}

function isDifferentDay(a: string, b: string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

function UserAvatar({ user }: { user?: { displayName: string; avatarUrl: string | null } }) {
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />;
  }

  const name = user?.displayName ?? '?';
  const charCode = name.charCodeAt(0);
  const colors = ['#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245', '#3ba55c'];
  const color = colors[charCode % colors.length];

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {name[0].toUpperCase()}
    </div>
  );
}

function MessageActions({
  message,
  channelId,
  isOwn,
}: {
  message: Message;
  channelId: string;
  isOwn: boolean;
}) {
  const setReplyingTo = useUIStore((s) => s.setReplyingTo);

  const handleDelete = async () => {
    await api.deleteMessage(channelId, message.id);
  };

  return (
    <div className="absolute -top-3 right-4 hidden group-hover:flex bg-[#2b2d31] border border-[#1e1f22] rounded shadow-lg">
      <button
        onClick={() => setReplyingTo(message.id)}
        className="px-2 py-1 text-[#b5bac1] hover:text-white hover:bg-[#383a40] text-xs"
        title="Reply"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 8.26667V4L3 11.4667L10 18.9333V14.56C15 14.56 18.5 16.2667 21 20C20 14.6667 17 9.33333 10 8.26667Z" />
        </svg>
      </button>
      {isOwn && (
        <button
          onClick={handleDelete}
          className="px-2 py-1 text-[#b5bac1] hover:text-[#ed4245] hover:bg-[#383a40] text-xs"
          title="Delete"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function ReplyIndicator({ replyToId, messages }: { replyToId: string; messages: Message[] }) {
  const replied = messages.find((m) => m.id === replyToId);
  return (
    <div className="flex items-center gap-1 ml-14 mb-0.5 text-xs text-[#949ba4]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#4e5058]">
        <path d="M10 8.26667V4L3 11.4667L10 18.9333V14.56C15 14.56 18.5 16.2667 21 20C20 14.6667 17 9.33333 10 8.26667Z" />
      </svg>
      <span className="font-medium text-white text-xs">
        {replied?.author?.displayName ?? 'Unknown'}
      </span>
      <span className="truncate max-w-xs">{replied?.content ?? 'Original message was deleted'}</span>
    </div>
  );
}

export function MessageList({ channelId }: { channelId: string }) {
  const messages = useMessageStore((s) => s.messages[channelId] || []);
  const hasMore = useMessageStore((s) => s.hasMore[channelId] ?? true);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const fetchMoreMessages = useMessageStore((s) => s.fetchMoreMessages);
  const currentUser = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    fetchMessages(channelId);
  }, [channelId, fetchMessages]);

  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView();
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Auto-scroll when near bottom
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    shouldAutoScroll.current = isNearBottom;

    // Load more when near top
    if (el.scrollTop < 100 && hasMore) {
      const prevHeight = el.scrollHeight;
      fetchMoreMessages(channelId).then(() => {
        // Preserve scroll position after loading older messages
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [channelId, hasMore, fetchMoreMessages]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overflow-x-hidden"
    >
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => fetchMoreMessages(channelId)}
            className="text-sm text-[#00a8fc] hover:underline"
          >
            Load more messages
          </button>
        </div>
      )}

      <div className="pb-4">
        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const grouped = prev ? shouldGroup(prev, msg) : false;
          const showDateSep = prev ? isDifferentDay(prev.createdAt, msg.createdAt) : true;
          const isOwn = msg.authorId === currentUser?.id;

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center mx-4 my-4">
                  <div className="flex-1 h-px bg-[#3f4147]" />
                  <span className="px-2 text-xs text-[#949ba4] font-semibold">
                    {formatDateSeparator(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-[#3f4147]" />
                </div>
              )}

              {msg.replyToId && <ReplyIndicator replyToId={msg.replyToId} messages={messages} />}

              <div className="group relative px-4 py-0.5 hover:bg-[#2e3035]">
                <MessageActions message={msg} channelId={channelId} isOwn={isOwn} />

                {grouped ? (
                  <div className="flex items-start pl-14">
                    <span className="invisible group-hover:visible text-[10px] text-[#949ba4] w-0 -ml-11 mr-11 pt-0.5 flex-shrink-0 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <div className="text-[#dbdee1] leading-relaxed break-words min-w-0">
                      {msg.content}
                      {msg.editedAt && <span className="text-[10px] text-[#949ba4] ml-1">(edited)</span>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4 mt-3">
                    <UserAvatar user={msg.author} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-white hover:underline cursor-pointer">
                          {msg.author?.displayName ?? 'Unknown User'}
                        </span>
                        <span className="text-xs text-[#949ba4]">{formatTimestamp(msg.createdAt)}</span>
                      </div>
                      <div className="text-[#dbdee1] leading-relaxed break-words">
                        {msg.content}
                        {msg.editedAt && <span className="text-[10px] text-[#949ba4] ml-1">(edited)</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
