import { memo, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServers } from '../../hooks/useServers';
import { useChannels } from '../../hooks/useChannels';
import { useAckChannel } from '../../hooks/useReadState';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { analytics } from '../../lib/analytics';
import type { Channel } from '@quarrel/shared';
import { Button } from '@/components/ui/button';
import { Volume2, Hash, Settings } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { VoiceConnectionBar } from '../voice/VoiceConnectionBar';
import UserBar from './UserBar';
import { SecondarySidebarLayout } from './SecondarySidebarLayout';
import {
  SIDEBAR_BADGE_CLASS,
  sidebarItemButtonClass,
} from './sidebarItemStyles';

function VoiceParticipants({ channelId }: { channelId: string }) {
  const currentChannelId = useVoiceStore(s => s.currentChannelId);
  const participants = useVoiceStore(s => s.participants);
  const speakingUsers = useVoiceStore(s => s.speakingUsers);

  if (currentChannelId !== channelId || participants.length === 0) return null;

  return (
    <div className='ml-8 mt-0.5 mb-1'>
      {participants.map(p => (
        <div
          key={p.userId}
          className='flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-text-muted'
        >
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white ${
              speakingUsers.has(p.userId) ? 'ring-2 ring-brand/60' : ''
            }`}
          >
            {(p.displayName || p.username).charAt(0).toUpperCase()}
          </div>
          <span className='truncate'>{p.displayName || p.username}</span>
          {p.isMuted && (
            <span className='text-red text-[10px] shrink-0'>&#x1F507;</span>
          )}
        </div>
      ))}
    </div>
  );
}

const CategorySection = memo(function CategorySection({
  category,
  channels,
  activeChannelId,
  onChannelClick,
  onAddChannel,
}: {
  category: Channel | null;
  channels: (Channel & { unreadCount?: number })[];
  activeChannelId: string | undefined;
  onChannelClick: (channel: Channel) => void;
  onAddChannel: () => void;
}) {
  if (!category) {
    return (
      <div className='relative flex w-full min-w-0 flex-col px-1 py-0'>
        <div className='w-full text-sm'>
          <ul className='flex w-full min-w-0 flex-col gap-1'>
            {channels.map(channel => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={activeChannelId === channel.id}
                onClick={() => onChannelClick(channel)}
              />
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <Collapsible defaultOpen className='group/collapsible'>
      <div className='relative mt-4 flex w-full min-w-0 flex-col px-1 py-0'>
        <div className='flex h-8 items-center px-1 pr-8 text-xs font-bold uppercase tracking-wide text-text-muted'>
          <CollapsibleTrigger className='flex items-center gap-0.5'>
            <span className='text-[10px] transition-transform group-data-[state=closed]/collapsible:-rotate-90'>
              &#x25BC;
            </span>
            <span className='truncate'>{category.name}</span>
          </CollapsibleTrigger>
        </div>
        <button
          type='button'
          onClick={onAddChannel}
          className='absolute right-1 top-1.5 flex size-5 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-modifier-hover hover:text-text-normal'
          aria-label='Create channel'
        >
          +
        </button>
        <CollapsibleContent>
          <div className='w-full text-sm'>
            <ul className='flex w-full min-w-0 flex-col gap-1'>
              {channels.map(channel => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannelId === channel.id}
                  onClick={() => onChannelClick(channel)}
                />
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

const ChannelItem = memo(function ChannelItem({
  channel,
  isActive,
  onClick,
}: {
  channel: Channel & { unreadCount?: number };
  isActive: boolean;
  onClick: () => void;
}) {
  const hasUnread = (channel.unreadCount ?? 0) > 0;

  return (
    <li className='group/menu-item relative'>
      <button
        type='button'
        onClick={onClick}
        className={sidebarItemButtonClass({ isActive, hasUnread })}
      >
        <span className='shrink-0 w-5 flex items-center justify-center'>
          {channel.type === 'voice' ? (
            <Volume2 size={16} />
          ) : (
            <Hash size={16} />
          )}
        </span>
        <span className='truncate'>{channel.name}</span>
      </button>
      {!isActive && hasUnread && (
        <span
          className={`${SIDEBAR_BADGE_CLASS} pointer-events-none absolute right-1 top-1.5`}
        >
          {(channel.unreadCount ?? 0) > 99 ? '99+' : channel.unreadCount}
        </span>
      )}
      {channel.type === 'voice' && <VoiceParticipants channelId={channel.id} />}
    </li>
  );
});

export default function ChannelSidebar() {
  const navigate = useNavigate();
  const { serverId, channelId } = useParams();
  const { data: servers = [] } = useServers();
  const { data: channels = [] } = useChannels(serverId);
  const openModal = useUIStore(s => s.openModal);
  const ackChannel = useAckChannel();

  const server = servers.find(s => s.id === serverId);

  // Auto-ack when entering a channel
  useEffect(() => {
    if (channelId) {
      ackChannel.mutate(channelId);
    }
  }, [channelId]);

  const { uncategorized, categorized } = useMemo(() => {
    const cats = channels
      .filter((c: any) => c.type === 'category')
      .sort((a: any, b: any) => a.position - b.position);

    const nonCat = channels
      .filter((c: any) => c.type !== 'category')
      .sort((a: any, b: any) => a.position - b.position);

    return {
      uncategorized: nonCat.filter((c: any) => !c.categoryId),
      categorized: cats.map((cat: any) => ({
        category: cat,
        channels: nonCat.filter((c: any) => c.categoryId === cat.id),
      })),
    };
  }, [channels]);

  const handleChannelClick = useCallback(
    (channel: Channel) => {
      analytics.capture('channel:switch', {
        channelId: channel.id,
        channelType: channel.type,
        serverId,
      });
      navigate(`/channels/${serverId}/${channel.id}`);
      if (channel.type === 'voice') {
        useVoiceStore.getState().joinChannel(channel.id);
      }
    },
    [serverId, navigate],
  );

  const handleAddChannel = useCallback(() => {
    openModal('createChannel');
  }, [openModal]);

  if (!server) return null;

  return (
    <SecondarySidebarLayout
      header={
        <>
          <h2 className='flex-1 truncate text-sm font-semibold text-white'>
            {server.name}
          </h2>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => openModal('inviteServer')}
            className='ml-auto size-8 rounded-lg text-text-muted transition-opacity hover:bg-bg-modifier-hover hover:text-text-normal md:opacity-0 md:group-hover:opacity-100'
            aria-label='Invite people'
          >
            <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M14 8.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0M11.5 4a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9M17.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m0-5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7M3 19c0-3.04 2.46-5.5 5.5-5.5h6c3.04 0 5.5 2.46 5.5 5.5v1h-2v-1a3.5 3.5 0 0 0-3.5-3.5h-6A3.5 3.5 0 0 0 5 19v1H3zm18 1h-2v-1c0-.35-.07-.69-.18-1H21z' />
            </svg>
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => openModal('serverSettings')}
            className='ml-1 size-8 rounded-lg text-text-muted transition-opacity hover:bg-bg-modifier-hover hover:text-text-normal md:opacity-0 md:group-hover:opacity-100'
            aria-label='Server settings'
          >
            <Settings size={18} />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => openModal('createChannel')}
            className='ml-1 size-8 rounded-lg text-xl leading-none text-text-muted transition-opacity hover:bg-bg-modifier-hover hover:text-text-normal md:opacity-0 md:group-hover:opacity-100'
            aria-label='Create channel'
          >
            +
          </Button>
        </>
      }
      content={
        <>
          {uncategorized.length > 0 && (
            <CategorySection
              category={null}
              channels={uncategorized}
              activeChannelId={channelId}
              onChannelClick={handleChannelClick}
              onAddChannel={handleAddChannel}
            />
          )}

          {categorized.map(({ category, channels: catChannels }: any) => (
            <CategorySection
              key={category.id}
              category={category}
              channels={catChannels}
              activeChannelId={channelId}
              onChannelClick={handleChannelClick}
              onAddChannel={handleAddChannel}
            />
          ))}
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
