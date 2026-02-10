import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import Modal from './Modal';

export default function SettingsModal() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const closeModal = useUIStore((s) => s.closeModal);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateProfile({ displayName: displayName.trim(), customStatus: customStatus.trim() });
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
    <Modal title="User Settings" onClose={closeModal}>
      {error && (
        <div className="mb-3 rounded bg-[#f23f43]/10 p-2 text-sm text-[#f23f43]">{error}</div>
      )}

      <label className="mb-4 block text-xs font-bold uppercase text-[#b5bac1]">
        Display Name
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-2 block w-full rounded bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] outline-none normal-case"
        />
      </label>

      <label className="mb-6 block text-xs font-bold uppercase text-[#b5bac1]">
        Custom Status
        <input
          type="text"
          value={customStatus}
          onChange={(e) => setCustomStatus(e.target.value)}
          className="mt-2 block w-full rounded bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] outline-none normal-case"
          placeholder="What's on your mind?"
        />
      </label>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded bg-[#5865f2] p-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleLogout}
          className="rounded bg-[#f23f43] px-4 p-2.5 font-medium text-white hover:bg-[#da373c]"
        >
          Log Out
        </button>
      </div>
    </Modal>
  );
}
