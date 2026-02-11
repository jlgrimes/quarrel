import { useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function MyAccountSection() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const closeModal = useUIStore((s) => s.closeModal);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Account deletion
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      analytics.capture('settings:password_changed');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await api.deleteAccount(deletePassword);
      analytics.capture('settings:account_deleted');
      analytics.reset();
      closeModal();
      // Force logout after deletion
      await logout();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-white">My Account</h1>

      {/* Account info */}
      <div className="mb-8 rounded-lg bg-[#1e1f22] p-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">{user?.username}</span>
            <span className="text-sm text-[#949ba4]">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="mb-8">
        <h2 className="mb-4 text-base font-bold text-white">Change Password</h2>

        {passwordError && (
          <div className="mb-3 rounded bg-[#f23f43]/10 p-2 text-sm text-[#f23f43]">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="mb-3 rounded bg-green-500/10 p-2 text-sm text-green-400">
            {passwordSuccess}
          </div>
        )}

        <label className="mb-3 block text-xs font-bold uppercase text-[#b5bac1]">
          Current Password
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-2 h-auto rounded border-none bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] shadow-none normal-case"
          />
        </label>

        <label className="mb-3 block text-xs font-bold uppercase text-[#b5bac1]">
          New Password
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-2 h-auto rounded border-none bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] shadow-none normal-case"
          />
        </label>

        <label className="mb-4 block text-xs font-bold uppercase text-[#b5bac1]">
          Confirm New Password
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-2 h-auto rounded border-none bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] shadow-none normal-case"
          />
        </label>

        <Button
          onClick={handleChangePassword}
          disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          className="rounded bg-[#5865f2] px-4 py-2 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {changingPassword ? 'Changing...' : 'Change Password'}
        </Button>
      </div>

      {/* Log Out */}
      <div className="mb-8">
        <Button
          onClick={async () => {
            analytics.capture('auth:logout');
            closeModal();
            await logout();
          }}
          className="rounded bg-[#4e5058] px-4 py-2 font-medium text-white hover:bg-[#6d6f78]"
        >
          Log Out
        </Button>
      </div>

      {/* Account Deletion */}
      <div className="rounded-lg border border-[#f23f43]/30 p-4">
        <h2 className="mb-2 text-base font-bold text-[#f23f43]">Delete Account</h2>
        <p className="mb-4 text-sm text-[#949ba4]">
          This action is irreversible. All your data will be permanently deleted.
        </p>

        {!showDeleteConfirm ? (
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded bg-[#f23f43] px-4 py-2 font-medium text-white hover:bg-[#da373c]"
          >
            Delete Account
          </Button>
        ) : (
          <div>
            {deleteError && (
              <div className="mb-3 rounded bg-[#f23f43]/10 p-2 text-sm text-[#f23f43]">
                {deleteError}
              </div>
            )}

            <label className="mb-4 block text-xs font-bold uppercase text-[#b5bac1]">
              Enter your password to confirm
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="mt-2 h-auto rounded border-none bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] shadow-none normal-case"
              />
            </label>

            <div className="flex gap-3">
              <Button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="rounded bg-[#f23f43] px-4 py-2 font-medium text-white hover:bg-[#da373c] disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="rounded bg-[#4e5058] px-4 py-2 font-medium text-white hover:bg-[#6d6f78]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
