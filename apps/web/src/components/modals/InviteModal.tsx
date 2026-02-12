import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useServers } from '../../hooks/useServers';
import { useUIStore } from '../../stores/uiStore';
import Modal from './Modal';

export default function InviteModal() {
  const [copied, setCopied] = useState(false);
  const closeModal = useUIStore((s) => s.closeModal);
  const { data: servers = [] } = useServers();
  const { serverId } = useParams();

  const server = servers.find((s) => s.id === serverId);
  const inviteCode = server?.inviteCode ?? '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title={`Invite people to ${server?.name ?? 'server'}`} onClose={closeModal}>
      <p className="mb-4 text-center text-sm text-text-label">
        Share this invite code with others to grant access to this server.
      </p>

      <label className="mb-4 block text-xs font-bold uppercase text-text-label">
        Invite Code
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={inviteCode}
            readOnly
            className="block w-full rounded bg-bg-tertiary p-2 text-base font-normal text-text-normal outline-none normal-case"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </label>
    </Modal>
  );
}
