import { memo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from '../../hooks/useDMs';
import { useAckDM } from '../../hooks/useReadState';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import type { Conversation } from '@quarrel/shared';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VoiceConnectionBar } from '../voice/VoiceConnectionBar';
import UserBar from './UserBar';

const DMItem = memo(function DMItem({
  conversation,
  isActive,
  currentUserId,
  onClick,
}: {
  conversation: Conversation & { unreadCount?: number };
  isActive: boolean;
  currentUserId: string | undefined;
  onClick: () => void;
}) {
  const other = conversation.members?.find((m) => m.id !== currentUserId) || conversation.members?.[0];
  const name = other?.displayName || other?.username || 'Unknown';
  const letter = name[0].toUpperCase();
  const unreadCount = (conversation as any).unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left ${
        isActive
          ? 'bg-[#404249] text-white'
          : hasUnread
            ? 'text-white hover:bg-[#383a40]'
            : 'text-[#949ba4] hover:bg-[#383a40] hover:text-[#dbdee1]'
      }`}
    >
      <div className="relative shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={other?.avatarUrl ?? undefined} alt={name} />
          <AvatarFallback className="bg-[#5865f2] text-xs font-medium text-white">
            {letter}
          </AvatarFallback>
        </Avatar>
        {other?.status && (
          <div
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#2b2d31] ${
              other.status === 'online' ? 'bg-[#23a559]' :
              other.status === 'idle' ? 'bg-[#f0b232]' :
              other.status === 'dnd' ? 'bg-[#f23f43]' : 'bg-[#80848e]'
            }`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm ${hasUnread && !isActive ? 'font-bold' : 'font-medium'}`}>{name}</div>
      </div>
      {!isActive && hasUnread && (
        <span className="bg-[#f23f43] text-white text-[10px] font-bold px-1.5 min-w-[18px] h-4 rounded-full flex items-center justify-center shrink-0">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
});

export default function DMSidebar() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const currentUser = useAuthStore((s) => s.user);
  const { data: conversations = [], isLoading } = useConversations();
  const ackDM = useAckDM();
  const prevConvIdRef = useRef<string | undefined>(conversationId);
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);

  // Auto-ack when entering a DM conversation
  useEffect(() => {
    if (conversationId) {
      ackDM.mutate(conversationId);
    }
  }, [conversationId]);

  // Ack previous conversation when switching
  useEffect(() => {
    const prev = prevConvIdRef.current;
    prevConvIdRef.current = conversationId;
    if (prev && prev !== conversationId) {
      ackDM.mutate(prev);
    }
  }, [conversationId]);

  return (
    <div className={`w-60 bg-[#2b2d31] flex flex-col shrink-0 ${mobileSidebarOpen ? 'max-md:fixed max-md:inset-y-0 max-md:left-[72px] max-md:z-50' : 'max-md:hidden'}`}>
      <div className="flex h-12 items-center border-b border-[#1e1f22] px-4">
        <Input
          type="text"
          placeholder="Find or start a conversation"
          className="w-full rounded border-none bg-[#1e1f22] px-2 py-1 text-sm text-[#dbdee1] placeholder-[#949ba4] shadow-none h-auto"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <button
            onClick={() => { navigate('/channels/@me'); setMobileSidebarOpen(false); }}
            className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left mb-1 ${
              !conversationId ? 'bg-[#404249] text-white' : 'text-[#949ba4] hover:bg-[#383a40] hover:text-[#dbdee1]'
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865f2] shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Friends</span>
          </button>

          <h3 className="mb-1 mt-3 px-2 text-xs font-semibold uppercase text-[#949ba4]">
            Direct Messages
          </h3>

          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#949ba4] border-t-white" />
            </div>
          )}

          {!isLoading && conversations.map((conv) => (
            <DMItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === conversationId}
              currentUserId={currentUser?.id}
              onClick={() => { navigate(`/channels/@me/${conv.id}`); setMobileSidebarOpen(false); }}
            />
          ))}

          {!isLoading && conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-[#949ba4]">No conversations yet</p>
          )}
        </div>
      </ScrollArea>

      <VoiceConnectionBar />
      <UserBar />
    </div>
  );
}
