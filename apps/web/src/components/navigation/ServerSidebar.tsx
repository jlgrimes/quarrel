import { memo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServers } from '../../hooks/useServers';
import { useChannels } from '../../hooks/useChannels';
import { useUIStore } from '../../stores/uiStore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ServerIcon = memo(function ServerIcon({
  server,
  isActive,
  hasUnread,
  onClick,
}: {
  server: { id: string; name: string; iconUrl: string | null };
  isActive: boolean;
  hasUnread: boolean;
  onClick: () => void;
}) {
  const letter = server.name.charAt(0).toUpperCase();
  const colors = [
    'bg-brand',
    'bg-green',
    'bg-yellow',
    'bg-red',
    'bg-blurple',
    'bg-bg-neutral',
    'bg-brand-hover',
    'bg-green-dark',
  ];
  const colorIdx =
    server.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    colors.length;
  const bgColor = colors[colorIdx];

  return (
    <div className="relative flex items-center justify-center mb-2 group">
      <div
        className={`absolute left-0 w-[3px] bg-white rounded-r-sm transition-all ${
          isActive ? 'h-10' : hasUnread ? 'h-2' : 'h-0 group-hover:h-5'
        }`}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-lg"
            onClick={onClick}
            className={`h-12 w-12 transition-all duration-200 text-white font-semibold text-lg ${bgColor} ${
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
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-bg-floating text-white text-sm font-semibold border-none">
          {server.name}
        </TooltipContent>
      </Tooltip>
    </div>
  );
});

function ServerWithUnread({
  server,
  isActive,
  onClick,
}: {
  server: { id: string; name: string; iconUrl: string | null };
  isActive: boolean;
  onClick: () => void;
}) {
  const { data: channels = [] } = useChannels(server.id);
  const hasUnread = channels.some((ch: any) => (ch.unreadCount ?? 0) > 0);

  return (
    <ServerIcon
      server={server}
      isActive={isActive}
      hasUnread={hasUnread}
      onClick={onClick}
    />
  );
}

export default function ServerSidebar() {
  const navigate = useNavigate();
  const { serverId } = useParams();
  const { data: servers = [] } = useServers();
  const openModal = useUIStore((s) => s.openModal);
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);

  const handleServerClick = useCallback((server: { id: string }) => {
    navigate(`/channels/${server.id}`);
    setMobileSidebarOpen(false);
  }, [navigate, setMobileSidebarOpen]);

  return (
    <div
      className={`w-[72px] bg-bg-tertiary flex flex-col items-center py-3 overflow-y-auto shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transition-transform max-md:duration-200 ${
        mobileSidebarOpen
          ? 'max-md:translate-x-0'
          : 'max-md:-translate-x-full max-md:pointer-events-none'
      }`}
    >
      <div className="relative flex items-center justify-center mb-2 group">
        <Button
          variant="ghost"
          onClick={() => {
            navigate('/channels/@me');
            setMobileSidebarOpen(false);
          }}
          className={`w-12 h-12 p-0 transition-all duration-200 font-bold text-xl ${
            !serverId
              ? 'bg-brand rounded-[16px] text-white hover:bg-brand'
              : 'bg-bg-primary rounded-[24px] text-text-normal hover:bg-brand hover:text-white hover:rounded-[16px]'
          }`}
        >
          Q
        </Button>
      </div>

      <div className="w-8 h-[2px] bg-bg-modifier-hover rounded-full mb-2" />

      {servers.map((server) => (
        <ServerWithUnread
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
          className="w-12 h-12 p-0 rounded-[24px] bg-bg-primary text-green hover:bg-green hover:text-white hover:rounded-[16px] transition-all duration-200 text-2xl font-light"
        >
          +
        </Button>
      </div>

      <div className="relative flex items-center justify-center mb-2 group">
        <Button
          variant="ghost"
          onClick={() => openModal('joinServer')}
          className="w-12 h-12 p-0 rounded-[24px] bg-bg-primary text-green hover:bg-green hover:text-white hover:rounded-[16px] transition-all duration-200 text-sm font-semibold"
        >
          Join
        </Button>
      </div>
    </div>
  );
}
