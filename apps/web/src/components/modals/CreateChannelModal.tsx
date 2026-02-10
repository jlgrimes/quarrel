import { useState } from 'react';
import type { ChannelType } from '@quarrel/shared';
import { api } from '../../lib/api';
import { useServerStore } from '../../stores/serverStore';
import { useUIStore } from '../../stores/uiStore';
import Modal from './Modal';

export default function CreateChannelModal() {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('text');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const addChannel = useServerStore((s) => s.addChannel);
  const closeModal = useUIStore((s) => s.closeModal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeServerId) return;
    setLoading(true);
    setError('');
    try {
      const channel = await api.createChannel(activeServerId, { name: name.trim(), type });
      addChannel(channel);
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  const types: { value: ChannelType; label: string; icon: string }[] = [
    { value: 'text', label: 'Text', icon: '#' },
    { value: 'voice', label: 'Voice', icon: '🔊' },
  ];

  return (
    <Modal title="Create Channel" onClose={closeModal}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-3 rounded bg-[#f23f43]/10 p-2 text-sm text-[#f23f43]">{error}</div>
        )}

        <label className="mb-1 block text-xs font-bold uppercase text-[#b5bac1]">
          Channel Type
        </label>
        <div className="mb-4 space-y-2">
          {types.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`flex w-full items-center gap-3 rounded p-2.5 ${
                type === t.value
                  ? 'bg-[#404249] text-white'
                  : 'bg-[#1e1f22] text-[#949ba4] hover:bg-[#383a40] hover:text-[#dbdee1]'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              <span className="font-medium">{t.label}</span>
            </button>
          ))}
        </div>

        <label className="mb-4 block text-xs font-bold uppercase text-[#b5bac1]">
          Channel Name
          <div className="mt-2 flex items-center rounded bg-[#1e1f22] p-2">
            <span className="mr-1 text-[#949ba4]">{type === 'text' ? '#' : '🔊'}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              className="flex-1 bg-transparent text-base font-normal text-[#dbdee1] outline-none normal-case"
              placeholder="new-channel"
              autoFocus
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="w-full rounded bg-[#5865f2] p-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Channel'}
        </button>
      </form>
    </Modal>
  );
}
