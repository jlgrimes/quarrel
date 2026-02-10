import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServerStore } from '../../stores/serverStore';
import { useUIStore } from '../../stores/uiStore';
import type { Channel } from '@quarrel/shared';
import UserBar from './UserBar';

function CategorySection({
  category,
  channels,
  serverId,
  activeChannelId,
  onChannelClick,
  onAddChannel,
}: {
  category: Channel | null;
  channels: Channel[];
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
          <button
            onClick={onAddChannel}
            className="text-[#949ba4] hover:text-[#dbdee1] opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none ml-auto"
            aria-label="Create channel"
          >
            +
          </button>
        </div>
      )}

      {!collapsed &&
        channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onChannelClick(channel)}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 mx-2 rounded text-sm group ${
              activeChannelId === channel.id
                ? 'bg-[#404249] text-white'
                : 'text-[#949ba4] hover:bg-[#383a40] hover:text-[#dbdee1]'
            }`}
            style={{ maxWidth: 'calc(100% - 16px)' }}
          >
            <span className="text-lg leading-none shrink-0 w-5 text-center">
              {channel.type === 'voice' ? '\u{1F50A}' : '#'}
            </span>
            <span className="truncate">{channel.name}</span>
          </button>
        ))}
    </div>
  );
}

export default function ChannelSidebar() {
  const navigate = useNavigate();
  const { serverId, channelId } = useParams();
  const servers = useServerStore((s) => s.servers) || [];
  const channels = useServerStore((s) => s.channels) || [];
  const openModal = useUIStore((s) => s.openModal);

  const server = servers.find((s) => s.id === serverId);

  if (!server) return null;

  // Separate categories from channels
  const categories = channels
    .filter((c) => c.type === 'category')
    .sort((a, b) => a.position - b.position);

  const nonCategoryChannels = channels
    .filter((c) => c.type !== 'category')
    .sort((a, b) => a.position - b.position);

  // Group channels by categoryId
  const uncategorized = nonCategoryChannels.filter((c) => !c.categoryId);
  const categorized = categories.map((cat) => ({
    category: cat,
    channels: nonCategoryChannels.filter((c) => c.categoryId === cat.id),
  }));

  const handleChannelClick = (channel: Channel) => {
    navigate(`/channels/${serverId}/${channel.id}`);
  };

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0">
      {/* Server header */}
      <div className="h-12 flex items-center px-4 border-b border-[#1e1f22] shrink-0">
        <h2 className="font-semibold text-white truncate">{server.name}</h2>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {/* Uncategorized channels */}
        {uncategorized.length > 0 && (
          <CategorySection
            category={null}
            channels={uncategorized}
            serverId={server.id}
            activeChannelId={channelId}
            onChannelClick={handleChannelClick}
            onAddChannel={() => openModal('createChannel')}
          />
        )}

        {/* Categorized channels */}
        {categorized.map(({ category, channels: catChannels }) => (
          <CategorySection
            key={category.id}
            category={category}
            channels={catChannels}
            serverId={server.id}
            activeChannelId={channelId}
            onChannelClick={handleChannelClick}
            onAddChannel={() => openModal('createChannel')}
          />
        ))}
      </div>

      {/* User bar */}
      <UserBar />
    </div>
  );
}
