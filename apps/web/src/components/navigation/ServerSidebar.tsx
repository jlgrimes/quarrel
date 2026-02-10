import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServerStore } from '../../stores/serverStore';
import { useUIStore } from '../../stores/uiStore';

function ServerIcon({
  server,
  isActive,
  onClick,
}: {
  server: { id: string; name: string; iconUrl: string | null };
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const letter = server.name.charAt(0).toUpperCase();
  // Deterministic color from server id
  const colors = [
    'bg-indigo-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-pink-500',
    'bg-purple-500',
    'bg-blue-500',
    'bg-teal-500',
  ];
  const colorIdx =
    server.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    colors.length;
  const bgColor = colors[colorIdx];

  return (
    <div className="relative flex items-center justify-center mb-2 group">
      {/* Active indicator */}
      <div
        className={`absolute left-0 w-[3px] bg-white rounded-r-sm transition-all ${
          isActive ? 'h-10' : hovered ? 'h-5' : 'h-0'
        }`}
      />

      <button
        onClick={onClick}
        onMouseEnter={() => {
          setHovered(true);
          setShowTooltip(true);
        }}
        onMouseLeave={() => {
          setHovered(false);
          setShowTooltip(false);
        }}
        className={`w-12 h-12 flex items-center justify-center transition-all duration-200 text-white font-semibold text-lg ${bgColor} ${
          isActive || hovered ? 'rounded-[16px]' : 'rounded-[24px]'
        }`}
      >
        {server.iconUrl ? (
          <img
            src={server.iconUrl}
            alt={server.name}
            className="w-full h-full object-cover rounded-[inherit]"
          />
        ) : (
          letter
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-[68px] z-50 px-3 py-2 bg-[#111214] text-white text-sm font-semibold rounded-md shadow-lg whitespace-nowrap pointer-events-none">
          {server.name}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-[#111214] rotate-45" />
        </div>
      )}
    </div>
  );
}

export default function ServerSidebar() {
  const navigate = useNavigate();
  const { serverId } = useParams();
  const servers = useServerStore((s) => s.servers) || [];
  const channels = useServerStore((s) => s.channels);
  const openModal = useUIStore((s) => s.openModal);

  const handleServerClick = (server: { id: string }) => {
    // Navigate to first text channel if available
    const serverChannels = channels.filter(
      (c) => c.serverId === server.id && c.type === 'text'
    );
    const firstChannel = serverChannels.sort(
      (a, b) => a.position - b.position
    )[0];
    if (firstChannel) {
      navigate(`/channels/${server.id}/${firstChannel.id}`);
    } else {
      navigate(`/channels/${server.id}`);
    }
  };

  return (
    <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 overflow-y-auto shrink-0">
      {/* Home / DM button */}
      <div className="relative flex items-center justify-center mb-2 group">
        <button
          onClick={() => navigate('/channels/@me')}
          className={`w-12 h-12 flex items-center justify-center transition-all duration-200 font-bold text-xl ${
            !serverId
              ? 'bg-indigo-500 rounded-[16px] text-white'
              : 'bg-[#313338] rounded-[24px] text-[#dcddde] hover:bg-indigo-500 hover:text-white hover:rounded-[16px]'
          }`}
        >
          Q
        </button>
      </div>

      {/* Separator */}
      <div className="w-8 h-[2px] bg-[#35363c] rounded-full mb-2" />

      {/* Server list */}
      {servers.map((server) => (
        <ServerIcon
          key={server.id}
          server={server}
          isActive={serverId === server.id}
          onClick={() => handleServerClick(server)}
        />
      ))}

      {/* Add server button */}
      <div className="relative flex items-center justify-center mb-2 group">
        <button
          onClick={() => openModal('createServer')}
          className="w-12 h-12 flex items-center justify-center rounded-[24px] bg-[#313338] text-green-500 hover:bg-green-500 hover:text-white hover:rounded-[16px] transition-all duration-200 text-2xl font-light"
        >
          +
        </button>
      </div>

      {/* Join server button */}
      <div className="relative flex items-center justify-center mb-2 group">
        <button
          onClick={() => openModal('joinServer')}
          className="w-12 h-12 flex items-center justify-center rounded-[24px] bg-[#313338] text-green-500 hover:bg-green-500 hover:text-white hover:rounded-[16px] transition-all duration-200 text-sm font-semibold"
        >
          Join
        </button>
      </div>
    </div>
  );
}
