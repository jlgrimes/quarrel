import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { ChannelType } from '@quarrel/shared';
import { useCreateChannel, useChannels } from '../../hooks/useChannels';
import { useUIStore } from '../../stores/uiStore';
import { analytics } from '../../lib/analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Modal from './Modal';

export default function CreateChannelModal() {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('text');
  const [categoryId, setCategoryId] = useState<string>('');
  const [error, setError] = useState('');
  const { serverId } = useParams();
  const createChannel = useCreateChannel();
  const { data: channels = [] } = useChannels(serverId);
  const closeModal = useUIStore((s) => s.closeModal);

  const categories = useMemo(
    () => channels.filter((c) => c.type === 'category').sort((a, b) => a.position - b.position),
    [channels],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !serverId) return;
    setError('');
    try {
      const data: { name: string; type: ChannelType; categoryId?: string } = { name: name.trim(), type };
      if (type !== 'category' && categoryId) {
        data.categoryId = categoryId;
      }
      await createChannel.mutateAsync({ serverId, data });
      analytics.capture('channel:create', { serverId, channelType: type });
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    }
  };

  const types: { value: ChannelType; label: string; icon: string }[] = [
    { value: 'text', label: 'Text', icon: '#' },
    { value: 'voice', label: 'Voice', icon: '\u{1F50A}' },
    { value: 'category', label: 'Category', icon: '\u{1F4C1}' },
  ];

  const nameIcon = type === 'category' ? '\u{1F4C1}' : type === 'voice' ? '\u{1F50A}' : '#';

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
            <Button
              key={t.value}
              type="button"
              variant="ghost"
              onClick={() => setType(t.value)}
              className={`flex w-full items-center justify-start gap-3 rounded p-2.5 h-auto ${
                type === t.value
                  ? 'bg-[#404249] text-white hover:bg-[#404249]'
                  : 'bg-[#1e1f22] text-[#949ba4] hover:bg-[#383a40] hover:text-[#dbdee1]'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              <span className="font-medium">{t.label}</span>
            </Button>
          ))}
        </div>

        {type !== 'category' && categories.length > 0 && (
          <label className="mb-4 block text-xs font-bold uppercase text-[#b5bac1]">
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-2 block w-full rounded bg-[#1e1f22] p-2 text-sm font-normal text-[#dbdee1] normal-case border-none outline-none"
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="mb-4 block text-xs font-bold uppercase text-[#b5bac1]">
          {type === 'category' ? 'Category Name' : 'Channel Name'}
          <div className="mt-2 flex items-center rounded bg-[#1e1f22] p-2">
            <span className="mr-1 text-[#949ba4]">{nameIcon}</span>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              className="flex-1 border-none bg-transparent p-0 h-auto text-base font-normal text-[#dbdee1] normal-case shadow-none"
              placeholder={type === 'category' ? 'new-category' : 'new-channel'}
              autoFocus
            />
          </div>
        </label>

        <Button
          type="submit"
          disabled={!name.trim() || createChannel.isPending}
          className="w-full rounded bg-[#5865f2] p-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {createChannel.isPending ? 'Creating...' : type === 'category' ? 'Create Category' : 'Create Channel'}
        </Button>
      </form>
    </Modal>
  );
}
