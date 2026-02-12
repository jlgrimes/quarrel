import { useState, useRef } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { useUploadAvatar, useRemoveAvatar } from '../../../hooks/useAvatarUpload';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar.mutate(file, {
        onError: (err: any) => setError(err.message || 'Failed to upload avatar'),
      });
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.updateProfile({
        displayName: displayName.trim(),
        customStatus: customStatus.trim(),
      });
      await fetchUser();
      setSuccess('Profile updated');
      analytics.capture('settings:profile_updated');
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-white">Profile</h1>

      {error && (
        <div className='mb-3 border border-red/30 bg-red/10 p-2 text-sm text-red'>
          {error}
        </div>
      )}
      {success && (
        <div className='mb-3 border border-brand/30 bg-brand/10 p-2 text-sm text-brand-light'>
          {success}
        </div>
      )}

      <Card className='mb-6 border-white/10 bg-bg-tertiary/65 py-0'>
        <CardHeader>
          <CardTitle className='text-base text-white'>Identity</CardTitle>
          <CardDescription className='text-text-muted'>
            Configure your profile card details.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4 pb-5'>
      <div className='flex items-center gap-4'>
        <div
          className='group relative cursor-pointer'
          onClick={() => fileInputRef.current?.click()}
        >
          <Avatar className="h-20 w-20">
            <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.username} />
            <AvatarFallback className="bg-brand text-2xl font-medium text-white">
              {(user?.displayName || user?.username || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs font-medium text-white">Change</span>
          </div>
          {uploadAvatar.isPending && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="h-6 w-6 animate-spin border-2 border-white/30 border-t-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-white">Avatar</span>
          {user?.avatarUrl && (
            <Button
              variant="link"
              size="sm"
              onClick={() => removeAvatar.mutate()}
              disabled={removeAvatar.isPending}
              className="h-auto justify-start p-0 text-xs text-red hover:text-red-hover"
            >
              {removeAvatar.isPending ? 'Removing...' : 'Remove Avatar'}
            </Button>
          )}
        </div>
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Display Name */}
      <label className='mb-4 block text-xs font-bold uppercase text-text-label'>
        Display Name
        <Input
          type='text'
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className='mt-2 h-auto border border-white/10 bg-bg-tertiary p-2 text-base font-normal text-text-normal shadow-none normal-case'
        />
      </label>

      {/* Custom Status */}
      <label className='mb-1 block text-xs font-bold uppercase text-text-label'>
        Custom Status
        <Input
          type='text'
          value={customStatus}
          onChange={e => setCustomStatus(e.target.value)}
          className='mt-2 h-auto border border-white/10 bg-bg-tertiary p-2 text-base font-normal text-text-normal shadow-none normal-case'
          placeholder="What's on your mind?"
        />
      </label>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className=' bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover disabled:opacity-50'
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
