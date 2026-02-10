import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConversations, useDMs, useSendDM } from '../hooks/useDMs';
import { useAuthStore } from '../stores/authStore';
import type { Conversation } from '@quarrel/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function DMPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { data: conversations = [] } = useConversations();
  const { data: dmData, isLoading: loading } = useDMs(conversationId);
  const sendDM = useSendDM();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = useMemo(
    () => dmData?.pages.flatMap((p) => p.messages) ?? [],
    [dmData],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const value = inputRef.current?.value.trim();
    if (!value || !conversationId) return;
    try {
      await sendDM.mutateAsync({ conversationId, content: value });
      if (inputRef.current) inputRef.current.value = '';
    } catch {}
  }, [conversationId, sendDM]);

  const getOtherUser = (conv: Conversation) => {
    return conv.members?.find((m) => m.id !== currentUser?.id) || conv.members?.[0];
  };

  return (
    <div className="flex flex-1 bg-[#313338]">
      {/* Conversation list */}
      <div className="flex w-60 flex-col border-r border-[#1f2023] bg-[#2b2d31]">
        <div className="flex h-12 items-center border-b border-[#1f2023] px-4">
          <Input
            type="text"
            placeholder="Find or start a conversation"
            className="w-full rounded border-none bg-[#1e1f22] px-2 py-1 text-sm text-[#dbdee1] placeholder-[#949ba4] shadow-none h-auto"
          />
        </div>
        <ScrollArea className="flex-1 p-2">
          <h3 className="mb-1 px-2 text-xs font-semibold uppercase text-[#949ba4]">
            Direct Messages
          </h3>
          {conversations.map((conv) => {
            const other = getOtherUser(conv);
            const isActive = conv.id === conversationId;
            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/channels/@me/${conv.id}`)}
                className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left ${
                  isActive ? 'bg-[#404249] text-white' : 'text-[#949ba4] hover:bg-[#383a40] hover:text-[#dbdee1]'
                }`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-[#5865f2] text-xs font-medium text-white">
                    {(other?.displayName || other?.username || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {other?.displayName || other?.username || 'Unknown'}
                  </div>
                </div>
              </button>
            );
          })}
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-[#949ba4]">No conversations yet</p>
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {conversationId ? (
          <>
            {/* Header */}
            <div className="flex h-12 items-center border-b border-[#1f2023] px-4">
              <span className="text-[#949ba4]">@</span>
              <span className="ml-2 font-semibold text-white">
                {(() => {
                  const conv = conversations.find((c) => c.id === conversationId);
                  const other = conv ? getOtherUser(conv) : null;
                  return other?.displayName || other?.username || 'Direct Message';
                })()}
              </span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-2">
              {loading && (
                <div className="py-4 text-center text-[#949ba4]">Loading messages...</div>
              )}
              {messages.map((msg) => {
                const time = new Date(msg.createdAt);
                const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={msg.id} className="group flex items-start py-0.5 hover:bg-[#2e3035]">
                    <Avatar className="ml-4 mr-4 mt-0.5 h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-[#5865f2] text-sm font-medium text-white">
                        {(msg.author?.displayName || msg.author?.username || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-white">
                          {msg.author?.displayName || msg.author?.username || 'Unknown'}
                        </span>
                        <span className="text-xs text-[#949ba4]">{timeStr}</span>
                      </div>
                      <div className="text-[#dbdee1]">{msg.content}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </ScrollArea>

            {/* Input */}
            <div className="px-4 pb-6">
              <div className="flex items-end rounded-lg bg-[#383a40]">
                <textarea
                  ref={inputRef}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Message"
                  rows={1}
                  className="max-h-[50vh] flex-1 resize-none bg-transparent py-3 pl-4 text-[#dbdee1] placeholder-[#6d6f78] outline-none"
                />
                <Button
                  variant="ghost"
                  onClick={handleSend}
                  className="p-3 text-[#b5bac1] hover:text-[#dbdee1] disabled:opacity-30"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-[#949ba4]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="mb-4 opacity-30">
              <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
            </svg>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
