import { memo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from '../../hooks/useDMs';
import { useAckDM } from '../../hooks/useReadState';
import { useAuthStore } from '../../stores/authStore';
import type { Conversation } from '@quarrel/shared';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { VoiceConnectionBar } from '../voice/VoiceConnectionBar';
import UserBar from './UserBar';
import { SecondarySidebarLayout } from './SecondarySidebarLayout';
import {
  SIDEBAR_BADGE_CLASS,
  sidebarItemButtonClass,
} from './sidebarItemStyles';

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
  const other =
    conversation.members?.find(m => m.id !== currentUserId) ||
    conversation.members?.[0];
  const name = other?.displayName || other?.username || 'Unknown';
  const letter = name[0].toUpperCase();
  const unreadCount = (conversation as any).unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  return (
    <li className='group/menu-item relative'>
      <button
        type='button'
        onClick={onClick}
        data-active={isActive}
        className={sidebarItemButtonClass({ isActive, hasUnread, tall: true })}
      >
        <div className='relative shrink-0'>
          <Avatar className='h-8 w-8'>
            <AvatarImage src={other?.avatarUrl ?? undefined} alt={name} />
            <AvatarFallback className='bg-brand text-xs font-medium text-white'>
              {letter}
            </AvatarFallback>
          </Avatar>
          {other?.status && (
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-secondary ${
                other.status === 'online'
                  ? 'bg-green'
                  : other.status === 'idle'
                    ? 'bg-yellow'
                    : other.status === 'dnd'
                      ? 'bg-red'
                      : 'bg-status-offline'
              }`}
            />
          )}
        </div>
        <span className='truncate text-sm'>{name}</span>
      </button>
      {!isActive && hasUnread && (
        <span
          className={`${SIDEBAR_BADGE_CLASS} pointer-events-none absolute right-1 top-2`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </li>
  );
});

export default function DMSidebar() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const currentUser = useAuthStore(s => s.user);
  const { data: conversations = [], isLoading } = useConversations();
  const ackDM = useAckDM();
  const prevConvIdRef = useRef<string | undefined>(conversationId);

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
    <SecondarySidebarLayout
      header={
        <Input
          type='text'
          placeholder='Find or start a conversation'
          className='h-8 w-full rounded-lg border-none bg-bg-tertiary/80 px-3 py-0 text-sm text-text-normal placeholder-text-muted shadow-none'
        />
      }
      content={
        <>
          <div className='relative flex w-full min-w-0 flex-col px-1 py-0'>
            <ul className='flex w-full min-w-0 flex-col gap-1'>
              <li className='group/menu-item relative'>
                <button
                  type='button'
                  onClick={() => {
                    navigate('/channels/@me');
                  }}
                  data-active={!conversationId}
                  className={sidebarItemButtonClass({
                    isActive: !conversationId,
                    hasUnread: false,
                    tall: true,
                  })}
                >
                  <span className='flex w-5 shrink-0 items-center justify-center'>
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='currentColor'
                    >
                      <path d='M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z' />
                    </svg>
                  </span>
                  <span className='truncate'>Friends</span>
                </button>
              </li>
            </ul>
          </div>

          <div className='relative flex w-full min-w-0 flex-col px-1 py-0'>
            <div className='flex h-8 items-center px-1 text-xs font-bold uppercase tracking-wide text-text-muted'>
              Direct Messages
            </div>
            <div className='w-full text-sm'>
              <ul className='flex w-full min-w-0 flex-col gap-1'>
                {isLoading && (
                  <>
                    <li
                      data-sidebar='menu-skeleton'
                      className='flex h-10 items-center gap-2 rounded-md px-2'
                    >
                      <div className='size-8 rounded-full bg-bg-modifier-hover animate-pulse' />
                      <div className='h-4 w-24 rounded bg-bg-modifier-hover animate-pulse' />
                    </li>
                    <li
                      data-sidebar='menu-skeleton'
                      className='flex h-10 items-center gap-2 rounded-md px-2'
                    >
                      <div className='size-8 rounded-full bg-bg-modifier-hover animate-pulse' />
                      <div className='h-4 w-20 rounded bg-bg-modifier-hover animate-pulse' />
                    </li>
                    <li
                      data-sidebar='menu-skeleton'
                      className='flex h-10 items-center gap-2 rounded-md px-2'
                    >
                      <div className='size-8 rounded-full bg-bg-modifier-hover animate-pulse' />
                      <div className='h-4 w-28 rounded bg-bg-modifier-hover animate-pulse' />
                    </li>
                  </>
                )}

                {!isLoading &&
                  conversations.map(conv => (
                    <DMItem
                      key={conv.id}
                      conversation={conv}
                      isActive={conv.id === conversationId}
                      currentUserId={currentUser?.id}
                      onClick={() => {
                        navigate(`/channels/@me/${conv.id}`);
                      }}
                    />
                  ))}

                {!isLoading && conversations.length === 0 && (
                  <li className='px-2 py-4 text-center text-sm text-text-muted'>
                    No conversations yet
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>
      }
      footer={
        <>
          <VoiceConnectionBar />
          <UserBar />
        </>
      }
    />
  );
}
