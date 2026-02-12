import { useEffect, useRef, useCallback, useMemo, memo, useState } from 'react';
import type { Message, Member } from '@quarrel/shared';
import { useMessages } from '../../hooks/useMessages';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../lib/api';
import { useAddReaction, useRemoveReaction, type ReactionData } from '../../hooks/useReactions';
import { EmojiPicker } from './EmojiPicker';
import { EmbedPreview } from './EmbedPreview';
import { analytics } from '../../lib/analytics';
import { normalizeChronological } from '../../lib/messageOrder';

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

const MENTION_REGEX = /<@([a-zA-Z0-9-]+)>/g;
const EVERYONE_MENTION = '<@everyone>';

function renderMessageContent(
  content: string,
  memberMap: Map<string, Member>,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX);

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const userId = match[1];
    if (userId === 'everyone') {
      parts.push(
        <span
          key={`mention-${match.index}`}
          className="bg-brand/30 text-brand-light rounded px-0.5 font-medium"
        >
          @everyone
        </span>
      );
    } else {
      const member = memberMap.get(userId);
      const displayName = member?.user?.displayName ?? member?.nickname ?? 'Unknown';
      parts.push(
        <span
          key={`mention-${match.index}`}
          className="bg-brand/30 text-brand-light rounded px-0.5 font-medium cursor-pointer hover:bg-brand/50"
        >
          @{displayName}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

function isMentioned(content: string, currentUserId?: string): boolean {
  if (!currentUserId) return false;
  if (content.includes(EVERYONE_MENTION)) return true;
  return content.includes(`<@${currentUserId}>`);
}

const UserAvatar = memo(function UserAvatar({ user }: { user?: { displayName: string; avatarUrl: string | null } }) {
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />;
  }

  const name = user?.displayName ?? '?';
  const charCode = name.charCodeAt(0);
  const colors = ['#0ea5a6', '#57f287', '#fee75c', '#eb459e', '#ed4245', '#3ba55c'];
  const color = colors[charCode % colors.length];

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {name[0].toUpperCase()}
    </div>
  );
});

const MessageActions = memo(function MessageActions({
  message,
  isOwn,
  onOpenReactionPicker,
  onPin,
  onUnpin,
}: {
  message: Message;
  isOwn: boolean;
  onOpenReactionPicker: (messageId: string) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
}) {
  const setReplyingTo = useUIStore((s) => s.setReplyingTo);

  const handleDelete = async () => {
    await api.deleteMessage(message.id);
  };

  return (
    <div className="absolute -top-3 right-4 hidden group-hover:flex bg-bg-secondary border border-bg-tertiary rounded shadow-lg">
      <button
        onClick={() => onOpenReactionPicker(message.id)}
        className="px-2 py-1 text-text-label hover:text-white hover:bg-bg-modifier-hover text-xs"
        title="Add Reaction"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
        </svg>
      </button>
      <button
        onClick={() => setReplyingTo(message.id)}
        className="px-2 py-1 text-text-label hover:text-white hover:bg-bg-modifier-hover text-xs"
        title="Reply"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 8.26667V4L3 11.4667L10 18.9333V14.56C15 14.56 18.5 16.2667 21 20C20 14.6667 17 9.33333 10 8.26667Z" />
        </svg>
      </button>
      {message.pinnedAt ? (
        <button
          onClick={() => onUnpin(message.id)}
          className="px-2 py-1 text-yellow hover:text-white hover:bg-bg-modifier-hover text-xs"
          title="Unpin Message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 12.87C19 12.61 18.86 12.37 18.64 12.23L15 10V5.5C15.55 5.22 16 4.65 16 4C16 3.17 15.33 2.5 14.5 2.5H9.5C8.67 2.5 8 3.17 8 4C8 4.65 8.45 5.22 9 5.5V10L5.36 12.23C5.14 12.37 5 12.61 5 12.87V14C5 14.55 5.45 15 6 15H10.5V19L9 21.5V22H15V21.5L13.5 19V15H18C18.55 15 19 14.55 19 14V12.87Z" />
          </svg>
        </button>
      ) : (
        <button
          onClick={() => onPin(message.id)}
          className="px-2 py-1 text-text-label hover:text-white hover:bg-bg-modifier-hover text-xs"
          title="Pin Message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 12.87C19 12.61 18.86 12.37 18.64 12.23L15 10V5.5C15.55 5.22 16 4.65 16 4C16 3.17 15.33 2.5 14.5 2.5H9.5C8.67 2.5 8 3.17 8 4C8 4.65 8.45 5.22 9 5.5V10L5.36 12.23C5.14 12.37 5 12.61 5 12.87V14C5 14.55 5.45 15 6 15H10.5V19L9 21.5V22H15V21.5L13.5 19V15H18C18.55 15 19 14.55 19 14V12.87Z" />
          </svg>
        </button>
      )}
      {isOwn && (
        <button
          onClick={handleDelete}
          className="px-2 py-1 text-text-label hover:text-red hover:bg-bg-modifier-hover text-xs"
          title="Delete"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>
      )}
    </div>
  );
});

const MessageReactions = memo(function MessageReactions({
  reactions,
  messageId,
}: {
  reactions?: ReactionData[];
  messageId: string;
}) {
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();

  if (!reactions || reactions.length === 0) return null;

  const handleToggle = (emoji: string, me: boolean) => {
    if (me) {
      removeReaction.mutate({ messageId, emoji });
    } else {
      addReaction.mutate({ messageId, emoji });
    }
  };

  return (
    <div className="flex flex-wrap gap-1 ml-14 mt-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleToggle(r.emoji, r.me)}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border transition-colors ${
            r.me
              ? 'bg-brand/20 border-brand text-brand-light'
              : 'bg-bg-secondary border-bg-modifier-hover text-text-label hover:border-brand'
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
    </div>
  );
});

function ReplyIndicator({ replyToId, messages }: { replyToId: string; messages: Message[] }) {
  const replied = messages.find((m) => m.id === replyToId);
  return (
    <div className="flex items-center gap-1 ml-14 mb-0.5 text-xs text-text-muted">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-bg-neutral">
        <path d="M10 8.26667V4L3 11.4667L10 18.9333V14.56C15 14.56 18.5 16.2667 21 20C20 14.6667 17 9.33333 10 8.26667Z" />
      </svg>
      <span className="font-medium text-white text-xs">
        {replied?.author?.displayName ?? 'Unknown'}
      </span>
      <span className="truncate max-w-xs">{replied?.content ?? 'Original message was deleted'}</span>
    </div>
  );
}

export function MessageList({ channelId, lastReadMessageId, members: membersList }: { channelId: string; lastReadMessageId?: string | null; members?: Member[] }) {
  const { data, hasPreviousPage, fetchPreviousPage, isFetchingPreviousPage } = useMessages(channelId);
  const currentUser = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const addReaction = useAddReaction();

  const messages = useMemo(
    () => normalizeChronological(data?.pages.flatMap((p) => p.messages) ?? []),
    [data],
  );

  const memberMap = useMemo(() => {
    const map = new Map<string, Member>();
    if (membersList) {
      for (const m of membersList) {
        map.set(m.userId, m);
      }
    }
    return map;
  }, [membersList]);

  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView();
    }
  }, [lastMessageId]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    shouldAutoScroll.current = isNearBottom;

    if (el.scrollTop < 100 && hasPreviousPage && !isFetchingPreviousPage) {
      const prevHeight = el.scrollHeight;
      fetchPreviousPage().then(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

  const handlePin = useCallback(async (messageId: string) => {
    await api.pinMessage(messageId);
    analytics.capture('message:pin', { messageId, channelId });
  }, [channelId]);

  const handleUnpin = useCallback(async (messageId: string) => {
    await api.unpinMessage(messageId);
    analytics.capture('message:unpin', { messageId, channelId });
  }, [channelId]);

  const handleReactionSelect = useCallback((emoji: string) => {
    if (reactionPickerMessageId) {
      addReaction.mutate({ messageId: reactionPickerMessageId, emoji });
      setReactionPickerMessageId(null);
    }
  }, [reactionPickerMessageId, addReaction]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overflow-x-hidden"
    >
      <div className="flex flex-col justify-end min-h-full">
      {hasPreviousPage && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => fetchPreviousPage()}
            className="text-sm text-text-link hover:underline"
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
          const msgReactions = (msg as any).reactions as ReactionData[] | undefined;
          const showNewMessagesDivider = lastReadMessageId && prev && prev.id === lastReadMessageId && msg.id !== lastReadMessageId;
          const mentioned = isMentioned(msg.content, currentUser?.id);
          const renderedContent = renderMessageContent(msg.content, memberMap);

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center mx-4 my-4">
                  <div className="flex-1 h-px bg-bg-modifier-hover" />
                  <span className="px-2 text-xs text-text-muted font-semibold">
                    {formatDateSeparator(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-bg-modifier-hover" />
                </div>
              )}

              {showNewMessagesDivider && (
                <div className="flex items-center mx-4 my-2">
                  <div className="flex-1 h-px bg-red" />
                  <span className="px-2 text-xs text-red font-semibold">
                    New Messages
                  </span>
                  <div className="flex-1 h-px bg-red" />
                </div>
              )}

              {msg.replyToId && <ReplyIndicator replyToId={msg.replyToId} messages={messages} />}

              <div className={`group relative px-4 py-0.5 hover:bg-bg-modifier-hover ${mentioned ? 'bg-brand/10 border-l-2 border-brand' : ''}`}>
                <MessageActions message={msg} isOwn={isOwn} onOpenReactionPicker={setReactionPickerMessageId} onPin={handlePin} onUnpin={handleUnpin} />

                {grouped ? (
                  <div className="flex items-start pl-14">
                    <span className="invisible group-hover:visible text-[10px] text-text-muted w-0 -ml-11 mr-11 pt-0.5 flex-shrink-0 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <div className="text-text-normal leading-relaxed break-words min-w-0">
                      {msg.pinnedAt && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow inline mr-1 -mt-0.5">
                          <path d="M19 12.87C19 12.61 18.86 12.37 18.64 12.23L15 10V5.5C15.55 5.22 16 4.65 16 4C16 3.17 15.33 2.5 14.5 2.5H9.5C8.67 2.5 8 3.17 8 4C8 4.65 8.45 5.22 9 5.5V10L5.36 12.23C5.14 12.37 5 12.61 5 12.87V14C5 14.55 5.45 15 6 15H10.5V19L9 21.5V22H15V21.5L13.5 19V15H18C18.55 15 19 14.55 19 14V12.87Z" />
                        </svg>
                      )}
                      {renderedContent}
                      {msg.editedAt && <span className="text-[10px] text-text-muted ml-1">(edited)</span>}
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
                        {msg.author?.isBot && (
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold bg-brand text-white leading-none">
                            BOT
                          </span>
                        )}
                        <span className="text-xs text-text-muted">{formatTimestamp(msg.createdAt)}</span>
                        {msg.pinnedAt && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow -mt-0.5">
                            <path d="M19 12.87C19 12.61 18.86 12.37 18.64 12.23L15 10V5.5C15.55 5.22 16 4.65 16 4C16 3.17 15.33 2.5 14.5 2.5H9.5C8.67 2.5 8 3.17 8 4C8 4.65 8.45 5.22 9 5.5V10L5.36 12.23C5.14 12.37 5 12.61 5 12.87V14C5 14.55 5.45 15 6 15H10.5V19L9 21.5V22H15V21.5L13.5 19V15H18C18.55 15 19 14.55 19 14V12.87Z" />
                          </svg>
                        )}
                      </div>
                      <div className="text-text-normal leading-relaxed break-words">
                        {renderedContent}
                        {msg.editedAt && <span className="text-[10px] text-text-muted ml-1">(edited)</span>}
                      </div>
                    </div>
                  </div>
                )}

                {!msg.deleted && <EmbedPreview content={msg.content} />}

                <MessageReactions reactions={msgReactions} messageId={msg.id} />

                {reactionPickerMessageId === msg.id && (
                  <div className="absolute z-50 bottom-full right-4 mb-2">
                    <EmojiPicker
                      onSelect={handleReactionSelect}
                      onClose={() => setReactionPickerMessageId(null)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />
      </div>
    </div>
  );
}
