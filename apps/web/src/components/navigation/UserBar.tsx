import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bug, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const statusColors: Record<string, string> = {
  online: 'bg-green',
  idle: 'bg-yellow',
  dnd: 'bg-red',
  offline: 'bg-status-offline',
};

export default function UserBar() {
  const user = useAuthStore((s) => s.user);
  const openModal = useUIStore((s) => s.openModal);

  if (!user) return null;

  const avatarLetter = (user.displayName || user.username)
    .charAt(0)
    .toUpperCase();

  return (
    <div className="quarrel-footer-card flex shrink-0 items-center gap-1.5 px-1.5">
      <div className="relative">
        <Avatar className="size-8">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
          <AvatarFallback className="bg-brand text-white text-sm font-semibold">
            {avatarLetter}
          </AvatarFallback>
        </Avatar>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-bg-tertiary ${statusColors[user.status] || statusColors.offline}`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">
          {user.displayName || user.username}
        </div>
        <div className="text-[11px] text-text-muted truncate">
          {user.customStatus || user.username}
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://github.com/jlgrimes/quarrel/issues"
            target="_blank"
            rel="noopener noreferrer"
          className="inline-flex size-8 items-center justify-center rounded-lg text-text-label hover:bg-bg-modifier-hover hover:text-text-normal"
            aria-label="Report a bug"
          >
            <Bug size={18} />
          </a>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-bg-floating text-white text-sm font-semibold border-none">
          Report a bug
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openModal('settings')}
            className="rounded-lg text-text-label hover:bg-bg-modifier-hover hover:text-text-normal"
            aria-label="User settings"
          >
            <Settings size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-bg-floating text-white text-sm font-semibold border-none">
          Settings
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
