import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJoinServer } from '../../hooks/useServers';
import { useUIStore } from '../../stores/uiStore';
import { analytics } from '../../lib/analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Modal from './Modal';

export default function JoinServerModal() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const joinServer = useJoinServer();
  const closeModal = useUIStore((s) => s.closeModal);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setError('');
    try {
      const server = await joinServer.mutateAsync(inviteCode.trim());
      analytics.capture('server:join', { serverId: server.id });
      closeModal();
      navigate(`/channels/${server.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join server');
    }
  };

  return (
    <Modal title="Join a server" onClose={closeModal}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-center text-sm text-text-label">
          Enter an invite code to join an existing server.
        </p>

        {error && (
          <div className="mb-3 rounded bg-red/10 p-2 text-sm text-red">{error}</div>
        )}

        <label className="mb-4 block text-xs font-bold uppercase text-text-label">
          Invite Code
          <Input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="mt-2 block w-full rounded border-none bg-bg-tertiary p-2 text-base font-normal text-text-normal normal-case"
            placeholder="Enter invite code"
            autoFocus
          />
        </label>

        <Button
          type="submit"
          disabled={!inviteCode.trim() || joinServer.isPending}
          className="w-full rounded bg-brand p-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {joinServer.isPending ? 'Joining...' : 'Join Server'}
        </Button>
      </form>
    </Modal>
  );
}
