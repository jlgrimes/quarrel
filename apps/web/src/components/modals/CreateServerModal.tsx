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
        <p className="mb-4 text-center text-sm text-[#b5bac1]">
          Give your new server a personality with a name.
        </p>

        {error && (
          <div className="mb-3 rounded bg-[#f23f43]/10 p-2 text-sm text-[#f23f43]">{error}</div>
        )}

        <label className="mb-4 block text-xs font-bold uppercase text-[#b5bac1]">
          Server Name
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 block w-full rounded border-none bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] normal-case"
            placeholder="My Awesome Server"
            autoFocus
          />
        </label>

        <Button
          type="submit"
          disabled={!name.trim() || createServer.isPending}
          className="w-full rounded bg-[#5865f2] p-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {createServer.isPending ? 'Creating...' : 'Create'}
        </Button>
      </form>
    </Modal>
  );
}
