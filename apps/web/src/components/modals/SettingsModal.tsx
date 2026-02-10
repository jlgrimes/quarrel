import { useState, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUploadAvatar, useRemoveAvatar } from '../../hooks/useAvatarUpload';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
    <Modal title='User Settings' onClose={closeModal}>
      {error && (
        <div className='mb-3 rounded bg-[#f23f43]/10 p-2 text-sm text-[#f23f43]'>
          {error}
        </div>
      )}

      <div className='mb-4 flex items-center gap-4'>
        <div
          className='relative cursor-pointer group'
          onClick={() => fileInputRef.current?.click()}
        >
          <Avatar className='h-20 w-20'>
            <AvatarImage
              src={user?.avatarUrl ?? undefined}
              alt={user?.username}
            />
            <AvatarFallback className='bg-[#5865f2] text-2xl font-medium text-white'>
              {(user?.displayName || user?.username || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className='absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity'>
            <span className='text-xs font-medium text-white'>Change</span>
          </div>
          {uploadAvatar.isPending && (
            <div className='absolute inset-0 flex items-center justify-center rounded-full bg-black/60'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white' />
            </div>
          )}
        </div>
        <div className='flex flex-col gap-1'>
          <span className='text-sm font-medium text-white'>Avatar</span>
          {user?.avatarUrl && (
            <button
              onClick={() => removeAvatar.mutate()}
              disabled={removeAvatar.isPending}
              className='text-xs text-[#f23f43] hover:underline disabled:opacity-50 text-left'
            >
              {removeAvatar.isPending ? 'Removing...' : 'Remove Avatar'}
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/png,image/jpeg,image/gif,image/webp'
          onChange={handleFileSelect}
          className='hidden'
        />
      </div>

      <label className='mb-4 block text-xs font-bold uppercase text-[#b5bac1]'>
        Display Name
        <Input
          type='text'
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className='mt-2 h-auto rounded border-none bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] shadow-none normal-case'
        />
      </label>

      <label className='mb-6 block text-xs font-bold uppercase text-[#b5bac1]'>
        Custom Status
        <Input
          type='text'
          value={customStatus}
          onChange={e => setCustomStatus(e.target.value)}
          className='mt-2 h-auto rounded border-none bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] shadow-none normal-case'
          placeholder="What's on your mind?"
        />
      </label>

      {/* Notification Settings */}
      <div className='mb-6'>
        <h3 className='mb-3 text-xs font-bold uppercase text-[#b5bac1]'>Notifications</h3>
        <div className='space-y-2'>
          <label className='flex items-center justify-between'>
            <span className='text-sm text-[#dbdee1]'>Enable Notifications</span>
            <input
              type='checkbox'
              checked={notifEnabled}
              onChange={(e) => setNotifEnabled(e.target.checked)}
              className='h-4 w-4 accent-[#5865f2]'
              data-testid='notif-enabled'
            />
          </label>
          <label className='flex items-center justify-between'>
            <span className='text-sm text-[#dbdee1]'>Notification Sounds</span>
            <input
              type='checkbox'
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className='h-4 w-4 accent-[#5865f2]'
              data-testid='notif-sound'
            />
          </label>
          <label className='flex items-center justify-between'>
            <span className='text-sm text-[#dbdee1]'>Desktop Notifications</span>
            <input
              type='checkbox'
              checked={desktopEnabled}
              onChange={(e) => setDesktopEnabled(e.target.checked)}
              className='h-4 w-4 accent-[#5865f2]'
              data-testid='notif-desktop'
            />
          </label>
          {desktopEnabled && browserPermission !== 'granted' && (
            <Button
              onClick={requestBrowserPermission}
              size='sm'
              className='mt-1 rounded bg-[#5865f2] px-3 py-1 text-xs text-white hover:bg-[#4752c4]'
            >
              {browserPermission === 'denied' ? 'Permission Denied' : 'Allow Browser Notifications'}
            </Button>
          )}
        </div>
      </div>

      <div className='flex gap-3'>
        <Button
          onClick={handleSave}
          disabled={saving}
          className='flex-1 rounded bg-[#5865f2] p-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50'
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          onClick={handleLogout}
          className='rounded bg-[#f23f43] px-4 p-2.5 font-medium text-white hover:bg-[#da373c]'
        >
          Log Out
        </Button>
      </div>
    </Modal>
  );
}
