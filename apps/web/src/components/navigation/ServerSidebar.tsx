import { memo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Compass, Sparkles } from 'lucide-react';
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
  const hasIcon = Boolean(server.iconUrl);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`group relative h-auto w-full aspect-square overflow-hidden transition-all duration-200 ${
            isActive
              ? 'rounded-[16px] ring-2 ring-brand/60 ring-inset'
              : 'rounded-[24px] hover:rounded-[16px] hover:bg-bg-modifier-hover/40'
          } ${!hasIcon ? 'bg-bg-neutral text-white' : ''}`}
        >
          {hasUnread && (
            <span className='absolute right-2 top-2 inline-flex h-2.5 w-2.5 rounded-full bg-brand' />
          )}
          {server.iconUrl ? (
            <img
              src={server.iconUrl}
              alt={server.name}
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center text-base font-semibold text-white'>
              {letter}
            </div>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side='right' className='border-none bg-bg-floating text-sm font-semibold text-white'>
        {server.name}
      </TooltipContent>
    </Tooltip>
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
  const openModal = useUIStore(s => s.openModal);
  const mobileSidebarOpen = useUIStore(s => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore(s => s.setMobileSidebarOpen);

  const handleServerClick = useCallback(
    (server: { id: string }) => {
      navigate(`/channels/${server.id}`);
      setMobileSidebarOpen(false);
    },
    [navigate, setMobileSidebarOpen],
  );

  return (
    <aside
      className={`quarrel-panel mr-1 flex w-[66px] shrink-0 flex-col overflow-y-auto p-1 max-md:fixed max-md:inset-y-1 max-md:left-1 max-md:z-50 max-md:w-[62px] max-md:transition-transform max-md:duration-200 ${
        mobileSidebarOpen
          ? 'max-md:translate-x-0'
          : 'max-md:-translate-x-full max-md:pointer-events-none'
      }`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            onClick={() => {
              navigate('/channels/@me');
              setMobileSidebarOpen(false);
            }}
            className={`mb-2 h-auto w-full aspect-square transition-all duration-200 ${
              !serverId
                ? 'rounded-[16px] bg-brand/25 text-white ring-2 ring-brand/60 ring-inset'
                : 'rounded-[24px] text-text-label hover:rounded-[16px] hover:bg-bg-modifier-hover/40 hover:text-white'
            }`}
          >
            <Sparkles size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='right' className='border-none bg-bg-floating text-sm font-semibold text-white'>
          Home
        </TooltipContent>
      </Tooltip>

      <div className='mb-2 h-px w-full bg-white/10' />

      <div className='flex flex-1 flex-col gap-2'>
        {servers.map(server => (
          <ServerWithUnread
            key={server.id}
            server={server}
            isActive={serverId === server.id}
            onClick={() => handleServerClick(server)}
          />
        ))}
      </div>

      <div className='mt-2 space-y-1.5'>
        <Button
          variant='ghost'
          onClick={() => openModal('createServer')}
          className='h-auto w-full aspect-square rounded-[24px] border border-brand/40 bg-brand/15 text-brand-light transition-all duration-200 hover:rounded-[16px] hover:bg-brand/25'
        >
          <Plus size={16} />
        </Button>
        <Button
          variant='ghost'
          onClick={() => openModal('joinServer')}
          className='h-auto w-full aspect-square rounded-[24px] border border-white/15 bg-bg-secondary/75 text-text-label transition-all duration-200 hover:rounded-[16px] hover:border-brand/30 hover:text-white'
        >
          <Compass size={16} />
        </Button>
      </div>
    </aside>
  );
}
