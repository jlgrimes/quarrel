import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

export default function UserBar() {
  const user = useAuthStore((s) => s.user);
  const openModal = useUIStore((s) => s.openModal);

  if (!user) return null;

  const avatarLetter = (user.displayName || user.username)
    .charAt(0)
    .toUpperCase();

  return (
    <div className="h-[52px] bg-[#232428] flex items-center px-2 gap-2 shrink-0">
      <div className="relative">
        <Avatar className="size-8">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
          <AvatarFallback className="bg-indigo-500 text-white text-sm font-semibold">
            {avatarLetter}
          </AvatarFallback>
        </Avatar>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#232428] ${statusColors[user.status] || statusColors.offline}`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">
          {user.displayName || user.username}
        </div>
        <div className="text-[11px] text-[#949ba4] truncate">
          {user.customStatus || user.username}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => openModal('settings')}
        className="text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#383a40]"
        aria-label="User settings"
      >
        <span className="text-lg">&#x2699;</span>
      </Button>
    </div>
  );
}
