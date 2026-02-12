import { memo, useMemo } from 'react';
import { useMembers } from '../../hooks/useMembers';
import type { Member, UserStatus } from '@quarrel/shared';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

const statusDot: Record<UserStatus, string> = {
  online: 'bg-green',
  idle: 'bg-yellow',
  dnd: 'bg-red',
  offline: 'bg-status-offline',
};

type MemberWithRoles = Member & {
  roles?: { id: string; name: string; color: string | null; position: number }[];
};

const MemberRow = memo(function MemberRow({ member }: { member: MemberWithRoles }) {
  const user = member.user;
  if (!user) return null;

  const displayName = member.nickname || user.displayName || user.username;
  const letter = displayName.charAt(0).toUpperCase();
  const isOffline = user.status === 'offline';

  // Use the highest role's color for the member name
  const highestRole = member.roles && member.roles.length > 0
    ? member.roles.reduce((a, b) => (a.position < b.position ? a : b))
    : null;
  const nameColor = highestRole?.color || undefined;

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
    user.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    colors.length;

  return (
    <div
      className={`flex items-center gap-3 px-2 py-1.5 mx-2 rounded hover:bg-bg-modifier-hover cursor-pointer ${isOffline ? 'opacity-40' : ''}`}
    >
      <div className="relative shrink-0">
        <Avatar className="size-8">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className={`${colors[colorIdx]} text-white text-sm font-semibold`}>
            {letter}
          </AvatarFallback>
        </Avatar>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-secondary ${statusDot[user.status] || statusDot.offline}`}
        />
      </div>

      <span
        className={`text-sm truncate ${isOffline ? 'text-text-muted' : 'text-white'}`}
        style={nameColor ? { color: nameColor } : undefined}
      >
        {displayName}
      </span>
      {user.isBot && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white/85 leading-none shrink-0 bg-white/10 border border-white/10">
          AI
        </span>
      )}
    </div>
  );
});

const MemberSection = memo(function MemberSection({
  title,
  titleColor,
  members,
}: {
  title: string;
  titleColor?: string | null;
  members: MemberWithRoles[];
}) {
  if (members.length === 0) return null;

  return (
    <div className="mt-4">
      <h3
        className="text-text-muted text-xs uppercase font-semibold px-4 mb-1"
        style={titleColor ? { color: titleColor } : undefined}
      >
        {title} — {members.length}
      </h3>
      {members.map((member) => (
        <MemberRow key={member.id} member={member} />
      ))}
    </div>
  );
});

export default function MemberList({ serverId, className }: { serverId: string; className?: string }) {
  const { data: members = [] } = useMembers(serverId);

  const { roleSections, onlineNoRole, offlineMembers } = useMemo(() => {
    const typedMembers = members as MemberWithRoles[];

    // Collect unique roles with their members (online only)
    const roleMap = new Map<string, { role: { id: string; name: string; color: string | null; position: number }; members: MemberWithRoles[] }>();

    const onlineNoRole: MemberWithRoles[] = [];
    const offlineMembers: MemberWithRoles[] = [];

    for (const m of typedMembers) {
      if (!m.user) continue;

      if (m.user.status === 'offline') {
        offlineMembers.push(m);
        continue;
      }

      // Find the highest role (lowest position number) for grouping
      const highestRole = m.roles && m.roles.length > 0
        ? m.roles.reduce((a, b) => (a.position < b.position ? a : b))
        : null;

      if (highestRole) {
        const existing = roleMap.get(highestRole.id);
        if (existing) {
          existing.members.push(m);
        } else {
          roleMap.set(highestRole.id, { role: highestRole, members: [m] });
        }
      } else {
        onlineNoRole.push(m);
      }
    }

    // Sort role sections by position
    const roleSections = Array.from(roleMap.values()).sort(
      (a, b) => a.role.position - b.role.position,
    );

    return { roleSections, onlineNoRole, offlineMembers };
  }, [members]);

  return (
    <ScrollArea className={`w-60 bg-bg-secondary shrink-0 ${className ?? ''}`}>
      {roleSections.map((section) => (
        <MemberSection
          key={section.role.id}
          title={section.role.name}
          titleColor={section.role.color}
          members={section.members}
        />
      ))}
      <MemberSection title="Online" members={onlineNoRole} />
      <MemberSection title="Offline" members={offlineMembers} />
    </ScrollArea>
  );
}
