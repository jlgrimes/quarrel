import { useMembers } from '../../hooks/useMembers';
import type { Member, UserStatus } from '@quarrel/shared';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

const statusDot: Record<UserStatus, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

function MemberRow({ member }: { member: Member }) {
  const user = member.user;
  if (!user) return null;

  const displayName = member.nickname || user.displayName || user.username;
  const letter = displayName.charAt(0).toUpperCase();
  const isOffline = user.status === 'offline';

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
    user.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    colors.length;

  return (
    <div
      className={`flex items-center gap-3 px-2 py-1.5 mx-2 rounded hover:bg-[#383a40] cursor-pointer ${isOffline ? 'opacity-40' : ''}`}
    >
      <div className="relative shrink-0">
        <Avatar className="size-8">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className={`${colors[colorIdx]} text-white text-sm font-semibold`}>
            {letter}
          </AvatarFallback>
        </Avatar>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${statusDot[user.status] || statusDot.offline}`}
        />
      </div>

      <span
        className={`text-sm truncate ${isOffline ? 'text-[#949ba4]' : 'text-[#f2f3f5]'}`}
      >
        {displayName}
      </span>
    </div>
  );
}

function MemberSection({
  title,
  members,
}: {
  title: string;
  members: Member[];
}) {
  if (members.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-[#949ba4] text-xs uppercase font-semibold px-4 mb-1">
        {title} — {members.length}
      </h3>
      {members.map((member) => (
        <MemberRow key={member.id} member={member} />
      ))}
    </div>
  );
}

export default function MemberList({ serverId }: { serverId: string }) {
  const { data: members = [] } = useMembers(serverId);

  const online = members.filter(
    (m) => m.user && m.user.status !== 'offline'
  );
  const offline = members.filter(
    (m) => m.user && m.user.status === 'offline'
  );

  return (
    <ScrollArea className="w-60 bg-[#2b2d31] shrink-0">
      <MemberSection title="Online" members={online} />
      <MemberSection title="Offline" members={offline} />
    </ScrollArea>
  );
}
