import { memo, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServers } from '../../hooks/useServers';
import { useChannels } from '../../hooks/useChannels';
import { useAckChannel } from '../../hooks/useReadState';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { analytics } from '../../lib/analytics';
import type { Channel } from '@quarrel/shared';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
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
      <SidebarGroup className="px-1 py-0">
        <SidebarGroupContent>
          <SidebarMenu>
            {channels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={activeChannelId === channel.id}
                onClick={() => onChannelClick(channel)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="px-1 py-0 mt-4">
        <SidebarGroupLabel
          asChild
          className="text-[#949ba4] text-xs uppercase font-bold tracking-wide px-1"
        >
          <CollapsibleTrigger className="flex items-center gap-0.5">
            <span className="text-[10px] transition-transform group-data-[state=closed]/collapsible:-rotate-90">
              &#x25BC;
            </span>
            <span className="truncate">{category.name}</span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <SidebarGroupAction
          onClick={onAddChannel}
          className="text-[#949ba4] hover:text-[#dbdee1]"
          aria-label="Create channel"
        >
          +
        </SidebarGroupAction>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {channels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannelId === channel.id}
                  onClick={() => onChannelClick(channel)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
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
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onClick}
        className={
          !isActive && hasUnread
            ? 'text-white font-bold'
            : !isActive
              ? 'text-[#949ba4] hover:text-[#dbdee1]'
              : ''
        }
      >
        <span className="text-lg leading-none shrink-0 w-5 text-center">
          {channel.type === 'voice' ? '\u{1F50A}' : '#'}
        </span>
        <span className="truncate">{channel.name}</span>
      </SidebarMenuButton>
      {!isActive && hasUnread && (
        <SidebarMenuBadge className="bg-[#f23f43] text-white text-[10px] font-bold px-1.5 min-w-[18px] h-4 rounded-full flex items-center justify-center">
          {(channel.unreadCount ?? 0) > 99 ? '99+' : channel.unreadCount}
        </SidebarMenuBadge>
      )}
      {channel.type === 'voice' && <VoiceParticipants channelId={channel.id} />}
    </SidebarMenuItem>
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
  const { setOpenMobile } = useSidebar();

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

  const handleChannelClick = useCallback((channel: Channel) => {
    analytics.capture('channel:switch', { channelId: channel.id, channelType: channel.type, serverId });
    navigate(`/channels/${serverId}/${channel.id}`);
    setOpenMobile(false);
    if (channel.type === 'voice') {
      useVoiceStore.getState().joinChannel(channel.id);
    }
  }, [serverId, navigate, setOpenMobile]);

  const handleAddChannel = useCallback(() => {
    openModal('createChannel');
  }, [openModal]);

  if (!server) return null;

  return (
    <Sidebar side="left" collapsible="offcanvas">
      <SidebarHeader className="h-12 flex-row items-center px-4 border-b border-[#1e1f22] py-0 group">
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
      </SidebarHeader>

      <SidebarContent>
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
      </SidebarContent>

      <SidebarFooter className="p-0 gap-0">
        <VoiceConnectionBar />
        <UserBar />
      </SidebarFooter>
    </Sidebar>
  );
}
