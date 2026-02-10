import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

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
      {/* Avatar */}
      <div className="relative">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-semibold">
            {avatarLetter}
          </div>
        )}
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#232428] ${statusColors[user.status] || statusColors.offline}`}
        />
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">
          {user.displayName || user.username}
        </div>
        <div className="text-[11px] text-[#949ba4] truncate">
          {user.customStatus || user.username}
        </div>
      </div>

      {/* Settings gear */}
      <button
        onClick={() => openModal('settings')}
        className="w-8 h-8 flex items-center justify-center rounded text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#383a40] transition-colors"
        aria-label="User settings"
      >
        <span className="text-lg">&#x2699;</span>
      </button>
    </div>
  );
}
