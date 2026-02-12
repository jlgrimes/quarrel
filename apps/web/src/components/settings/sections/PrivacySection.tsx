import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
        <div className="h-6 w-6 animate-spin border-2 border-text-muted border-t-white" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-white">Privacy</h1>

      {success && (
        <div className='mb-3 border border-brand/30 bg-brand/10 p-2 text-sm text-brand-light'>
          {success}
        </div>
      )}

      {/* DM Settings */}
      <Card className='mb-6 border-white/10 bg-bg-tertiary/65 py-0'>
        <CardHeader>
          <CardTitle className='text-sm uppercase tracking-wide text-text-label'>
            Who can send you direct messages
          </CardTitle>
        </CardHeader>
        <CardContent className='pb-5'>
          <Select
            value={allowDms}
            onValueChange={value => setAllowDms(value as typeof allowDms)}
          >
            <SelectTrigger className='w-full border border-white/10 bg-bg-tertiary'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='everyone'>Everyone</SelectItem>
              <SelectItem value='friends'>Friends Only</SelectItem>
              <SelectItem value='none'>No one</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className='mb-8 bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover disabled:opacity-50'
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>

      {/* Blocked Users */}
      <Card className='border-white/10 bg-bg-tertiary/65 py-0'>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-text-label">
          Blocked Users
          </CardTitle>
        </CardHeader>
        <CardContent className='pb-5'>
        {blockedUsers.length === 0 ? (
          <p className="text-sm text-text-muted">No blocked users</p>
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((blocked) => {
              const u = blocked.friend || blocked.user || {};
              return (
                <div
                  key={blocked.id}
                  className="flex items-center justify-between bg-bg-tertiary p-3"
                >
                  <span className="text-sm text-white">
                    {u.username || 'Unknown'}
                  </span>
                  <Button
                    onClick={() => handleUnblock(blocked.id)}
                    className=" bg-bg-neutral px-3 py-1 text-xs font-medium text-white hover:bg-bg-neutral-hover"
                  >
                    Unblock
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
