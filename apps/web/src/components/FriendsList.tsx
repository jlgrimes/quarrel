import { useState } from 'react';
import { useFriends, useAddFriend, useAcceptFriend, useRemoveFriend } from '../hooks/useFriends';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

type Tab = 'all' | 'online' | 'pending' | 'blocked';

export default function FriendsList() {
  const [tab, setTab] = useState<Tab>('online');
  const [addInput, setAddInput] = useState('');
  const [addStatus, setAddStatus] = useState('');
  const { data: friends = [] } = useFriends();
  const addFriend = useAddFriend();
  const acceptFriend = useAcceptFriend();
  const removeFriend = useRemoveFriend();

  const filtered = friends.filter((f) => {
    if (tab === 'all') return f.status === 'accepted';
    if (tab === 'online') return f.status === 'accepted' && f.friend?.status !== 'offline';
    if (tab === 'pending') return f.status === 'pending';
    if (tab === 'blocked') return f.status === 'blocked';
    return false;
  });

  const handleAdd = async () => {
    if (!addInput.trim()) return;
    try {
      await addFriend.mutateAsync(addInput.trim());
      setAddStatus('Friend request sent!');
      setAddInput('');
    } catch (err: any) {
      setAddStatus(err.message || 'Failed to send request');
    }
  };

  const handleAccept = (id: string) => {
    acceptFriend.mutate(id);
  };

  const handleRemove = (id: string) => {
    removeFriend.mutate(id);
  };

  const tabs: { label: string; value: Tab }[] = [
    { label: 'Online', value: 'online' },
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Blocked', value: 'blocked' },
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* Header with tabs */}
      <div className="flex h-12 items-center gap-4 border-b border-[#1f2023] px-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#949ba4">
          <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
        </svg>
        <span className="font-semibold text-white">Friends</span>
        <div className="h-6 w-px bg-[#3f4147]" />
        {tabs.map((t) => (
          <Button
            key={t.value}
            variant="ghost"
            size="sm"
            onClick={() => setTab(t.value)}
            className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
              tab === t.value
                ? 'bg-[#404249] text-white hover:bg-[#404249]'
                : 'text-[#b5bac1] hover:bg-[#383a40] hover:text-[#dbdee1]'
            }`}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Add friend input */}
      <div className="border-b border-[#1f2023] p-4">
        <h2 className="mb-2 text-sm font-bold uppercase text-white">Add Friend</h2>
        <div className="flex items-center gap-2 rounded-lg bg-[#1e1f22] p-2">
          <Input
            type="text"
            value={addInput}
            onChange={(e) => {
              setAddInput(e.target.value);
              setAddStatus('');
            }}
            placeholder="Enter a username"
            className="flex-1 border-none bg-transparent text-[#dbdee1] placeholder-[#949ba4] shadow-none h-auto p-0"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button
            onClick={handleAdd}
            disabled={!addInput.trim()}
            className="rounded bg-[#5865f2] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
          >
            Send Friend Request
          </Button>
        </div>
        {addStatus && <p className="mt-1 text-sm text-[#949ba4]">{addStatus}</p>}
      </div>

      {/* Friends list */}
      <ScrollArea className="flex-1 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase text-[#949ba4]">
          {tab} — {filtered.length}
        </h3>
        {filtered.map((friend) => {
          const user = friend.friend || friend.user;
          return (
            <div key={friend.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#383a40]">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[#5865f2] text-xs font-medium text-white">
                    {(user?.displayName || user?.username || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {user?.status && (
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#313338] ${
                      user.status === 'online' ? 'bg-[#23a559]' :
                      user.status === 'idle' ? 'bg-[#f0b232]' :
                      user.status === 'dnd' ? 'bg-[#f23f43]' : 'bg-[#80848e]'
                    }`}
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{user?.displayName || user?.username}</div>
                <div className="text-xs text-[#949ba4]">{user?.customStatus || user?.status}</div>
              </div>
              {friend.status === 'pending' && (
                <Button
                  onClick={() => handleAccept(friend.id)}
                  size="sm"
                  className="rounded bg-[#23a559] px-3 py-1 text-sm text-white hover:bg-[#1a7d42]"
                >
                  Accept
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(friend.id)}
                className="rounded p-1.5 text-[#949ba4] hover:text-[#f23f43]"
                title="Remove"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.4 4L12 10.4 5.6 4 4 5.6 10.4 12 4 18.4 5.6 20 12 13.6 18.4 20 20 18.4 13.6 12 20 5.6z" />
                </svg>
              </Button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="mt-8 text-center text-[#949ba4]">
            {tab === 'online' && "No friends online right now."}
            {tab === 'all' && "You don't have any friends yet."}
            {tab === 'pending' && "No pending friend requests."}
            {tab === 'blocked' && "No blocked users."}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
