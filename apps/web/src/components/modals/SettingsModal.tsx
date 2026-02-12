import { useState, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUploadAvatar, useRemoveAvatar } from '../../hooks/useAvatarUpload';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Modal from './Modal';

export default function SettingsModal() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const fetchUser = useAuthStore(s => s.fetchUser);
  const closeModal = useUIStore(s => s.closeModal);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const notifEnabled = useNotificationStore(s => s.enabled);
  const soundEnabled = useNotificationStore(s => s.soundEnabled);
  const desktopEnabled = useNotificationStore(s => s.desktopEnabled);
  const browserPermission = useNotificationStore(s => s.browserPermission);
  const setNotifEnabled = useNotificationStore(s => s.setEnabled);
  const setSoundEnabled = useNotificationStore(s => s.setSoundEnabled);
  const setDesktopEnabled = useNotificationStore(s => s.setDesktopEnabled);
  const requestBrowserPermission = useNotificationStore(s => s.requestBrowserPermission);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar.mutate(file, {
        onError: (err: any) =>
          setError(err.message || 'Failed to upload avatar'),
      });
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateProfile({
        displayName: displayName.trim(),
        customStatus: customStatus.trim(),
      });
      await fetchUser();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    closeModal();
  };

  return (
    <Modal
      title='User Settings'
      description='Manage your profile and notification preferences.'
      onClose={closeModal}
    >
      {error && (
        <div className='mb-4 border border-red/30 bg-red/10 p-2 text-sm text-red'>
          {error}
        </div>
      )}

      <Card className='mb-4 border-white/10 bg-bg-secondary/70 py-0'>
        <CardHeader>
          <CardTitle className='text-sm text-white'>Profile</CardTitle>
          <CardDescription className='text-text-muted'>
            Update your public identity.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4 pb-5'>
          <div className='flex items-center gap-4'>
            <div
              className='group relative cursor-pointer'
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className='h-20 w-20'>
                <AvatarImage
                  src={user?.avatarUrl ?? undefined}
                  alt={user?.username}
                />
                <AvatarFallback className='bg-brand text-2xl font-medium text-white'>
                  {(user?.displayName || user?.username || '?')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100'>
                <span className='text-xs font-medium text-white'>Change</span>
              </div>
              {uploadAvatar.isPending && (
                <div className='absolute inset-0 flex items-center justify-center bg-black/60'>
                  <div className='h-6 w-6 animate-spin border-2 border-white/30 border-t-white' />
                </div>
              )}
            </div>
            <div className='flex flex-col gap-1'>
              <span className='text-sm font-medium text-white'>Avatar</span>
              {user?.avatarUrl && (
                <Button
                  variant='link'
                  size='sm'
                  onClick={() => removeAvatar.mutate()}
                  disabled={removeAvatar.isPending}
                  className='h-auto justify-start p-0 text-xs text-red hover:text-red-hover'
                >
                  {removeAvatar.isPending ? 'Removing...' : 'Remove Avatar'}
                </Button>
              )}
            </div>
            <Input
              ref={fileInputRef}
              type='file'
              accept='image/png,image/jpeg,image/gif,image/webp'
              onChange={handleFileSelect}
              className='hidden'
            />
          </div>

          <label className='block text-xs font-bold uppercase text-text-label'>
            Display Name
            <Input
              type='text'
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className='mt-2 h-auto border border-white/10 bg-bg-tertiary/85 p-2 text-base font-normal text-text-normal shadow-none normal-case'
            />
          </label>

          <label className='block text-xs font-bold uppercase text-text-label'>
            Custom Status
            <Input
              type='text'
              value={customStatus}
              onChange={e => setCustomStatus(e.target.value)}
              className='mt-2 h-auto border border-white/10 bg-bg-tertiary/85 p-2 text-base font-normal text-text-normal shadow-none normal-case'
              placeholder="What's on your mind?"
            />
          </label>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className='mb-6 border-white/10 bg-bg-secondary/70 py-0'>
        <CardHeader>
          <CardTitle className='text-sm text-white'>Notifications</CardTitle>
          <CardDescription className='text-text-muted'>
            Control app and browser notification behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-2 pb-5'>
          <label className='flex items-center justify-between'>
            <span className='text-sm text-text-normal'>Enable Notifications</span>
            <Switch
              checked={notifEnabled}
              onCheckedChange={setNotifEnabled}
              className='data-[state=checked]:bg-brand data-[state=unchecked]:bg-bg-neutral'
              data-testid='notif-enabled'
            />
          </label>
          <label className='flex items-center justify-between'>
            <span className='text-sm text-text-normal'>Notification Sounds</span>
            <Switch
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
              className='data-[state=checked]:bg-brand data-[state=unchecked]:bg-bg-neutral'
              data-testid='notif-sound'
            />
          </label>
          <label className='flex items-center justify-between'>
            <span className='text-sm text-text-normal'>Desktop Notifications</span>
            <Switch
              checked={desktopEnabled}
              onCheckedChange={setDesktopEnabled}
              className='data-[state=checked]:bg-brand data-[state=unchecked]:bg-bg-neutral'
              data-testid='notif-desktop'
            />
          </label>
          {desktopEnabled && browserPermission !== 'granted' && (
            <Button
              onClick={requestBrowserPermission}
              size='sm'
              className='mt-1 bg-brand px-3 py-1 text-xs text-white hover:bg-brand-hover'
            >
              {browserPermission === 'denied' ? 'Permission Denied' : 'Allow Browser Notifications'}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className='flex gap-3'>
        <Button
          onClick={handleSave}
          disabled={saving}
          className='flex-1 bg-brand p-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50'
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          onClick={handleLogout}
          className=' bg-red px-4 p-2.5 font-medium text-white hover:bg-red-hover'
        >
          Log Out
        </Button>
      </div>
    </Modal>
  );
}
