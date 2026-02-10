import { memo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServers } from '../../hooks/useServers';
import { useUIStore } from '../../stores/uiStore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ServerIcon = memo(function ServerIcon({
  server,
  isActive,
  onClick,
}: {
  server: { id: string; name: string; iconUrl: string | null };
  isActive: boolean;
  onClick: () => void;
}) {
  const letter = server.name.charAt(0).toUpperCase();
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
      <div
        className={`absolute left-0 w-[3px] bg-white rounded-r-sm transition-all ${
          isActive ? 'h-10' : 'h-0 group-hover:h-5'
        }`}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`w-12 h-12 flex items-center justify-center transition-all duration-200 text-white font-semibold text-lg ${bgColor} ${
              isActive ? 'rounded-[16px]' : 'rounded-[24px] hover:rounded-[16px]'
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
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[#111214] text-white text-sm font-semibold border-none">
          {server.name}
        </TooltipContent>
      </Tooltip>
    </div>
  );
});

export default function ServerSidebar() {
  const navigate = useNavigate();
  const { serverId } = useParams();
  const { data: servers = [] } = useServers();
  const openModal = useUIStore((s) => s.openModal);

  const handleServerClick = useCallback((server: { id: string }) => {
    navigate(`/channels/${server.id}`);
  }, [navigate]);

  return (
    <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 overflow-y-auto shrink-0">
      <div className="relative flex items-center justify-center mb-2 group">
        <Button
          variant="ghost"
          onClick={() => navigate('/channels/@me')}
          className={`w-12 h-12 p-0 transition-all duration-200 font-bold text-xl ${
            !serverId
              ? 'bg-indigo-500 rounded-[16px] text-white hover:bg-indigo-500'
              : 'bg-[#313338] rounded-[24px] text-[#dcddde] hover:bg-indigo-500 hover:text-white hover:rounded-[16px]'
          }`}
        >
          Q
        </Button>
      </div>

      <div className="w-8 h-[2px] bg-[#35363c] rounded-full mb-2" />

      {servers.map((server) => (
        <ServerIcon
          key={server.id}
          server={server}
          isActive={serverId === server.id}
          onClick={() => handleServerClick(server)}
        />
      ))}

      <div className="relative flex items-center justify-center mb-2 group">
        <Button
          variant="ghost"
          onClick={() => openModal('createServer')}
          className="w-12 h-12 p-0 rounded-[24px] bg-[#313338] text-green-500 hover:bg-green-500 hover:text-white hover:rounded-[16px] transition-all duration-200 text-2xl font-light"
        >
          +
        </Button>
      </div>

      <div className="relative flex items-center justify-center mb-2 group">
        <Button
          variant="ghost"
          onClick={() => openModal('joinServer')}
          className="w-12 h-12 p-0 rounded-[24px] bg-[#313338] text-green-500 hover:bg-green-500 hover:text-white hover:rounded-[16px] transition-all duration-200 text-sm font-semibold"
        >
          Join
        </Button>
      </div>
    </div>
  );
}
