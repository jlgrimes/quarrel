import { memo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from '../../hooks/useDMs';
import { useAckDM } from '../../hooks/useReadState';
import { useAuthStore } from '../../stores/authStore';
import type { Conversation } from '@quarrel/shared';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from '@/components/ui/sidebar';
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
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onClick}
        className={
          !isActive && hasUnread
            ? 'text-white font-bold'
            : !isActive
              ? 'text-text-muted hover:text-text-normal'
              : ''
        }
      >
        <div className="relative shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={other?.avatarUrl ?? undefined} alt={name} />
            <AvatarFallback className="bg-brand text-xs font-medium text-white">
              {letter}
            </AvatarFallback>
          </Avatar>
          {other?.status && (
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-secondary ${
                other.status === 'online' ? 'bg-green' :
                other.status === 'idle' ? 'bg-yellow' :
                other.status === 'dnd' ? 'bg-red' : 'bg-status-offline'
              }`}
            />
          )}
        </div>
        <span className="truncate text-sm">{name}</span>
      </SidebarMenuButton>
      {!isActive && hasUnread && (
        <SidebarMenuBadge className="bg-red text-white text-[10px] font-bold px-1.5 min-w-[18px] h-4 rounded-full flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
});

export default function DMSidebar() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const currentUser = useAuthStore((s) => s.user);
  const { data: conversations = [], isLoading } = useConversations();
  const ackDM = useAckDM();
  const prevConvIdRef = useRef<string | undefined>(conversationId);
  const { setOpenMobile } = useSidebar();

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
    <Sidebar side="left" collapsible="offcanvas">
      <SidebarHeader className="h-12 flex-row items-center border-b border-bg-tertiary px-4 py-0">
        <Input
          type="text"
          placeholder="Find or start a conversation"
          className="w-full rounded border-none bg-bg-tertiary px-2 py-1 text-sm text-text-normal placeholder-text-muted shadow-none h-auto"
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="py-0 px-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={!conversationId}
                onClick={() => { navigate('/channels/@me'); setOpenMobile(false); }}
                className={conversationId ? 'text-text-muted hover:text-text-normal' : ''}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Friends</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="px-2">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase text-text-muted">
            Direct Messages
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading && (
                <>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                </>
              )}

              {!isLoading && conversations.map((conv) => (
                <DMItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === conversationId}
                  currentUserId={currentUser?.id}
                  onClick={() => { navigate(`/channels/@me/${conv.id}`); setOpenMobile(false); }}
                />
              ))}

              {!isLoading && conversations.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-text-muted">No conversations yet</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-0 gap-0">
        <VoiceConnectionBar />
        <UserBar />
      </SidebarFooter>
    </Sidebar>
  );
}
