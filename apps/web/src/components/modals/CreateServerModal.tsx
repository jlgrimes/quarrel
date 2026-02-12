import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateServer } from '../../hooks/useServers';
import { useUIStore } from '../../stores/uiStore';
import { analytics } from '../../lib/analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Modal from './Modal';

export default function CreateServerModal() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const createServer = useCreateServer();
  const closeModal = useUIStore((s) => s.closeModal);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    try {
      const server = await createServer.mutateAsync(name.trim());
      analytics.capture('server:create', { serverId: server.id });
      closeModal();
      navigate(`/channels/${server.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
    }
  };

  return (
    <Modal title="Create a server" onClose={closeModal}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-center text-sm text-text-label">
          Give your new server a personality with a name.
        </p>

        {error && (
          <div className="mb-3 rounded bg-red/10 p-2 text-sm text-red">{error}</div>
        )}

        <label className="mb-4 block text-xs font-bold uppercase text-text-label">
          Server Name
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 block w-full rounded border-none bg-bg-tertiary p-2 text-base font-normal text-text-normal normal-case"
            placeholder="My Awesome Server"
            autoFocus
          />
        </label>

        <Button
          type="submit"
          disabled={!name.trim() || createServer.isPending}
          className="w-full rounded bg-brand p-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {createServer.isPending ? 'Creating...' : 'Create'}
        </Button>
      </form>
    </Modal>
  );
}
