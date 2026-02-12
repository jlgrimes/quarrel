import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { ChannelType } from '@quarrel/shared';
import { useCreateChannel, useChannels } from '../../hooks/useChannels';
import { useUIStore } from '../../stores/uiStore';
import { analytics } from '../../lib/analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Modal
      title='Create Channel'
      description='Choose a channel type, optional category, and name.'
      onClose={closeModal}
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className='mb-3 rounded-lg border border-red/30 bg-red/10 p-2 text-sm text-red'>
            {error}
          </div>
        )}

        <label className='mb-1 block text-xs font-bold uppercase text-text-label'>
          Channel Type
        </label>
        <div className='mb-4 space-y-2'>
          {types.map(t => (
            <Button
              key={t.value}
              type='button'
              variant='ghost'
              onClick={() => setType(t.value)}
              className={`h-auto w-full justify-start gap-3 rounded-xl border p-2.5 ${
                type === t.value
                  ? 'border-brand/60 bg-brand/20 text-white hover:bg-brand/20'
                  : 'border-white/10 bg-bg-tertiary/75 text-text-muted hover:bg-bg-modifier-hover hover:text-text-normal'
              }`}
            >
              <span className='text-lg'>{t.icon}</span>
              <span className='font-medium'>{t.label}</span>
            </Button>
          ))}
        </div>

        {type !== 'category' && categories.length > 0 && (
          <label className='mb-4 block text-xs font-bold uppercase text-text-label'>
            Category
            <Select
              value={categoryId || 'none'}
              onValueChange={value => setCategoryId(value === 'none' ? '' : value)}
            >
              <SelectTrigger className='mt-2 h-auto w-full rounded-xl border border-white/10 bg-bg-tertiary/85 py-2 text-sm font-normal text-text-normal normal-case'>
                <SelectValue placeholder='No Category' />
              </SelectTrigger>
              <SelectContent className='border-bg-tertiary bg-bg-secondary text-text-normal'>
                <SelectItem value='none'>No Category</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}

        <label className='mb-4 block text-xs font-bold uppercase text-text-label'>
          {type === 'category' ? 'Category Name' : 'Channel Name'}
          <div className='mt-2 flex items-center rounded-xl border border-white/10 bg-bg-tertiary/85 p-2'>
            <span className='mr-1 text-text-muted'>{nameIcon}</span>
            <Input
              type='text'
              value={name}
              onChange={e =>
                setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))
              }
              className='h-auto flex-1 border-none bg-transparent p-0 text-base font-normal text-text-normal normal-case shadow-none'
              placeholder={type === 'category' ? 'new-category' : 'new-channel'}
              autoFocus
            />
          </div>
        </label>

        <Button
          type='submit'
          disabled={!name.trim() || createChannel.isPending}
          className='w-full rounded-xl bg-brand p-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50'
        >
          {createChannel.isPending ? 'Creating...' : type === 'category' ? 'Create Category' : 'Create Channel'}
        </Button>
      </form>
    </Modal>
  );
}
