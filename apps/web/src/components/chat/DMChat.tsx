import { useEffect, useRef, useCallback, useMemo, useState, memo } from 'react';
import type { DirectMessage, Conversation } from '@quarrel/shared';
import { useDMs, useSendDM } from '../../hooks/useDMs';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { analytics } from '../../lib/analytics';
import { normalizeChronological } from '../../lib/messageOrder';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MainPaneLayout } from '../layout/MainPaneLayout';

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

function shouldGroup(prev: DirectMessage, curr: DirectMessage): boolean {
  if (prev.authorId !== curr.authorId) return false;
  const timeDiff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return timeDiff < 5 * 60 * 1000;
}

function isDifferentDay(a: string, b: string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
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

const StatusDot = memo(function StatusDot({ status }: { status?: string }) {
  const colorMap: Record<string, string> = {
    online: 'bg-green',
    idle: 'bg-yellow',
    dnd: 'bg-red',
    offline: 'bg-status-offline',
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorMap[status ?? 'offline']}`} />
  );
});

export function DMChat({
  conversationId,
  conversation,
}: {
  conversationId: string;
  conversation?: Conversation;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const { data: dmData, isLoading, hasPreviousPage, fetchPreviousPage, isFetchingPreviousPage } = useDMs(conversationId);
  const sendDM = useSendDM();
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const otherUser = conversation?.members?.find((m) => m.id !== currentUser?.id) ?? conversation?.members?.[0];

  const messages = useMemo(
    () => normalizeChronological(dmData?.pages.flatMap((p) => p.messages) ?? []),
    [dmData],
  );

  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView();
    }
  }, [lastMessageId]);

  useEffect(() => {
    analytics.capture('dm:open', { conversationId });
  }, [conversationId]);

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

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    await sendDM.mutateAsync({ conversationId, content: trimmed });
    analytics.capture('dm:send', { conversationId });
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, conversationId, sendDM]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 300) + 'px';
  };

  const displayName = otherUser?.displayName || otherUser?.username || 'Direct Message';

  return (
    <MainPaneLayout
      headerClassName="quarrel-panel gap-2.5 border-none"
      header={
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
            className="mr-1 shrink-0 rounded-lg text-text-label hover:bg-bg-modifier-hover hover:text-white md:hidden"
            aria-label="Open sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </Button>
          <span className="text-text-muted text-xl">@</span>
          <UserAvatar user={otherUser ? { displayName: otherUser.displayName, avatarUrl: otherUser.avatarUrl } : undefined} />
          <span className="font-semibold text-white">{displayName}</span>
          <StatusDot status={otherUser?.status} />
        </>
      }
    >

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="quarrel-panel flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="flex flex-col justify-end min-h-full">
        {hasPreviousPage && (
          <div className="flex justify-center py-4">
            <Button variant="link" className="h-auto p-0 text-sm text-text-link hover:underline"
              onClick={() => fetchPreviousPage()}
            >
              Load more messages
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-white" />
          </div>
        )}

        {/* Beginning of conversation */}
        {!isLoading && !hasPreviousPage && otherUser && (
          <div className="px-4 pt-8 pb-4">
            <UserAvatar user={{ displayName: otherUser.displayName, avatarUrl: otherUser.avatarUrl }} />
            <h2 className="mt-2 text-xl font-bold text-white">{otherUser.displayName}</h2>
            <p className="text-sm text-text-muted">{otherUser.username}</p>
            <p className="mt-1 text-sm text-text-muted">
              This is the beginning of your direct message history with <strong className="text-white">{otherUser.displayName}</strong>.
            </p>
            <div className="mt-4 h-px bg-bg-modifier-hover" />
          </div>
        )}

        <div className="pb-4">
          {messages.map((msg, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            const grouped = prev ? shouldGroup(prev, msg) : false;
            const showDateSep = prev ? isDifferentDay(prev.createdAt, msg.createdAt) : false;

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

                <div className="group relative px-4 py-0.5 hover:bg-bg-modifier-hover">
                  {grouped ? (
                    <div className="flex items-start pl-14">
                      <span className="invisible group-hover:visible text-[10px] text-text-muted w-0 -ml-11 mr-11 pt-0.5 flex-shrink-0 text-right">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <div className="text-text-normal leading-relaxed break-words min-w-0">
                        {msg.content}
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
                          <span className="text-xs text-text-muted">{formatTimestamp(msg.createdAt)}</span>
                        </div>
                        <div className="text-text-normal leading-relaxed break-words">
                          {msg.content}
                          {msg.editedAt && <span className="text-[10px] text-text-muted ml-1">(edited)</span>}
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
      </div>

      {/* Input */}
      <div className="mt-1.5 px-0 pb-1 shrink-0">
        <div className="quarrel-panel-soft">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message @${displayName}`}
            rows={1}
            className="min-h-0 max-h-[300px] w-full resize-none border-none bg-transparent p-2 text-text-normal placeholder-text-muted shadow-none outline-none focus-visible:ring-0"
          />
        </div>
      </div>
    </MainPaneLayout>
  );
}
