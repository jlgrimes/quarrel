import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../stores/serverStore';
import { useUIStore } from '../../stores/uiStore';
import Modal from './Modal';

export default function JoinServerModal() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const joinServer = useServerStore((s) => s.joinServer);
  const closeModal = useUIStore((s) => s.closeModal);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const server = await joinServer(inviteCode.trim());
      closeModal();
      navigate(`/channels/${server.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Join a server" onClose={closeModal}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-center text-sm text-[#b5bac1]">
          Enter an invite code to join an existing server.
        </p>

        {error && (
          <div className="mb-3 rounded bg-[#f23f43]/10 p-2 text-sm text-[#f23f43]">{error}</div>
        )}

        <label className="mb-4 block text-xs font-bold uppercase text-[#b5bac1]">
          Invite Code
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="mt-2 block w-full rounded bg-[#1e1f22] p-2 text-base font-normal text-[#dbdee1] outline-none normal-case"
            placeholder="Enter invite code"
            autoFocus
          />
        </label>

        <button
          type="submit"
          disabled={!inviteCode.trim() || loading}
          className="w-full rounded bg-[#5865f2] p-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join Server'}
        </button>
      </form>
    </Modal>
  );
}
