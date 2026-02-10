import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { Button } from '@/components/ui/button';

export function PrivacySection() {
  const [allowDms, setAllowDms] = useState<'everyone' | 'friends' | 'none'>('everyone');
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      api.getSettings(),
      api.getFriends(),
    ]).then(([settings, friends]) => {
      setAllowDms(settings.allowDms || 'everyone');
      // Filter for blocked friends
      const blocked = friends.filter((f: any) => f.status === 'blocked');
      setBlockedUsers(blocked);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleUnblock = async (friendId: string) => {
    try {
      await api.removeFriend(friendId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== friendId));
      analytics.capture('settings:user_unblocked');
    } catch {
      // silent
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    try {
      await api.updateSettings({ allowDms });
      setSuccess('Privacy settings saved');
      analytics.capture('settings:privacy_updated', { allowDms });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#949ba4] border-t-white" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-white">Privacy</h1>

      {success && (
        <div className="mb-3 rounded bg-green-500/10 p-2 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* DM Settings */}
      <div className="mb-6">
        <h2 className="mb-3 text-xs font-bold uppercase text-[#b5bac1]">
          Who can send you direct messages
        </h2>
        <div className="space-y-2">
          {(['everyone', 'friends', 'none'] as const).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#1e1f22] p-3"
            >
              <input
                type="radio"
                name="allowDms"
                checked={allowDms === option}
                onChange={() => setAllowDms(option)}
                className="accent-[#5865f2]"
              />
              <span className="text-sm capitalize text-white">
                {option === 'none' ? 'No one' : option}
              </span>
            </label>
          ))}
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="mb-8 rounded bg-[#5865f2] px-4 py-2 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>

      {/* Blocked Users */}
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase text-[#b5bac1]">
          Blocked Users
        </h2>
        {blockedUsers.length === 0 ? (
          <p className="text-sm text-[#949ba4]">No blocked users</p>
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((blocked) => {
              const u = blocked.friend || blocked.user || {};
              return (
                <div
                  key={blocked.id}
                  className="flex items-center justify-between rounded-lg bg-[#1e1f22] p-3"
                >
                  <span className="text-sm text-white">
                    {u.username || 'Unknown'}
                  </span>
                  <Button
                    onClick={() => handleUnblock(blocked.id)}
                    className="rounded bg-[#4e5058] px-3 py-1 text-xs font-medium text-white hover:bg-[#6d6f78]"
                  >
                    Unblock
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
