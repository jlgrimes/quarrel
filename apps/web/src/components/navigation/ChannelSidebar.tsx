import { useState, memo, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServers } from '../../hooks/useServers';
import { useChannels } from '../../hooks/useChannels';
import { useAckChannel } from '../../hooks/useReadState';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { analytics } from '../../lib/analytics';
import type { Channel } from '@quarrel/shared';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VoiceConnectionBar } from '../voice/VoiceConnectionBar';
import UserBar from './UserBar';

function VoiceParticipants({ channelId }: { channelId: string }) {
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const participants = useVoiceStore((s) => s.participants);
  const speakingUsers = useVoiceStore((s) => s.speakingUsers);

  if (currentChannelId !== channelId || participants.length === 0) return null;

  return (
    <div className="ml-8 mt-0.5 mb-1">
      {participants.map((p) => (
        <div key={p.userId} className="flex items-center gap-2 py-0.5 px-2 text-xs text-[#949ba4]">
          <div className={`w-5 h-5 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${
            speakingUsers.has(p.userId) ? 'ring-2 ring-[#23a559]' : ''
          }`}>
            {(p.displayName || p.username).charAt(0).toUpperCase()}
          </div>
          <span className="truncate">{p.displayName || p.username}</span>
          {p.isMuted && <span className="text-[#ed4245] text-[10px] shrink-0">&#x1F507;</span>}
        </div>
      ))}
    </div>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto bg-[#f23f43] text-white text-[10px] font-bold px-1.5 min-w-[18px] h-4 rounded-full flex items-center justify-center shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}

const CategorySection = memo(function CategorySection({
  category,
  channels,
  serverId,
  activeChannelId,
  onChannelClick,
  onAddChannel,
}: {
  category: Channel | null;
  channels: (Channel & { unreadCount?: number })[];
  serverId: string;
  activeChannelId: string | undefined;
  onChannelClick: (channel: Channel) => void;
  onAddChannel: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mt-4">
      {category && (
        <div className="flex items-center px-1 mb-1 group">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center flex-1 min-w-0"
          >
            <span
              className={`text-[10px] text-[#949ba4] mr-0.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            >
              &#x25BC;
            </span>
            <span className="text-[#949ba4] text-xs uppercase font-bold tracking-wide truncate">
              {category.name}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onAddChannel}
            className="text-[#949ba4] hover:text-[#dbdee1] opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none ml-auto"
            aria-label="Create channel"
          >
            +
          </Button>
        </div>
      )}

      {!collapsed &&
        channels.map((channel) => {
          const hasUnread = (channel.unreadCount ?? 0) > 0;
          const isActive = activeChannelId === channel.id;

          return (
            <div key={channel.id}>
              <button
                onClick={() => onChannelClick(channel)}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 mx-2 rounded text-sm group ${
                  isActive
                    ? 'bg-[#404249] text-white'
                    : hasUnread
                      ? 'text-white hover:bg-[#383a40]'
                      : 'text-[#949ba4] hover:bg-[#383a40] hover:text-[#dbdee1]'
                }`}
                style={{ maxWidth: 'calc(100% - 16px)' }}
              >
                <span className="text-lg leading-none shrink-0 w-5 text-center">
                  {channel.type === 'voice' ? '\u{1F50A}' : '#'}
                </span>
                <span className={`truncate ${hasUnread && !isActive ? 'font-bold' : ''}`}>
                  {channel.name}
                </span>
                {!isActive && <UnreadBadge count={channel.unreadCount ?? 0} />}
              </button>
              {channel.type === 'voice' && <VoiceParticipants channelId={channel.id} />}
            </div>
          );
        })}
    </div>
  );
});

export default function ChannelSidebar() {
  const navigate = useNavigate();
  const { serverId, channelId } = useParams();
  const { data: servers = [] } = useServers();
  const { data: channels = [] } = useChannels(serverId);
  const openModal = useUIStore((s) => s.openModal);
  const ackChannel = useAckChannel();
  const prevChannelIdRef = useRef<string | undefined>(channelId);

  const server = servers.find((s) => s.id === serverId);

  // Auto-ack when entering a channel
  useEffect(() => {
    if (channelId) {
      ackChannel.mutate(channelId);
    }
  }, [channelId]);

  // Ack previous channel when switching
  useEffect(() => {
    const prev = prevChannelIdRef.current;
    prevChannelIdRef.current = channelId;
    if (prev && prev !== channelId) {
      ackChannel.mutate(prev);
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

  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);

  const handleChannelClick = useCallback((channel: Channel) => {
    analytics.capture('channel:switch', { channelId: channel.id, channelType: channel.type, serverId });
    navigate(`/channels/${serverId}/${channel.id}`);
    setMobileSidebarOpen(false);
    if (channel.type === 'voice') {
      useVoiceStore.getState().joinChannel(channel.id);
    }
  }, [serverId, navigate, setMobileSidebarOpen]);

  const handleAddChannel = useCallback(() => {
    openModal('createChannel');
  }, [openModal]);

  if (!server) return null;

  return (
    <div className={`w-60 bg-[#2b2d31] flex flex-col shrink-0 ${mobileSidebarOpen ? 'max-md:fixed max-md:inset-y-0 max-md:left-[72px] max-md:z-50' : 'max-md:hidden'}`}>
      <div className="h-12 flex items-center px-4 border-b border-[#1e1f22] shrink-0 group">
        <h2 className="font-semibold text-white truncate flex-1">{server.name}</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => openModal('inviteServer')}
          className="text-[#949ba4] hover:text-[#dbdee1] opacity-0 group-hover:opacity-100 transition-opacity leading-none ml-auto"
          aria-label="Invite people"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 8.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0M11.5 4a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9M17.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m0-5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7M3 19c0-3.04 2.46-5.5 5.5-5.5h6c3.04 0 5.5 2.46 5.5 5.5v1h-2v-1a3.5 3.5 0 0 0-3.5-3.5h-6A3.5 3.5 0 0 0 5 19v1H3zm18 1h-2v-1c0-.35-.07-.69-.18-1H21z" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => openModal('createChannel')}
          className="text-[#949ba4] hover:text-[#dbdee1] opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none ml-1"
          aria-label="Create channel"
        >
          +
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2 px-1">
          {uncategorized.length > 0 && (
            <CategorySection
              category={null}
              channels={uncategorized}
              serverId={server.id}
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
              serverId={server.id}
              activeChannelId={channelId}
              onChannelClick={handleChannelClick}
              onAddChannel={handleAddChannel}
            />
          ))}
        </div>
      </ScrollArea>

      <VoiceConnectionBar />
      <UserBar />
    </div>
  );
}
