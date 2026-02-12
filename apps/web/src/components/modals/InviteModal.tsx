import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useServers } from '../../hooks/useServers';
import { useUIStore } from '../../stores/uiStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
    <Modal
      title={`Invite people to ${server?.name ?? 'server'}`}
      description='Share this invite code with others to grant access to this server.'
      onClose={closeModal}
    >
      <label className='mb-4 block text-xs font-bold uppercase text-text-label'>
        Invite Code
        <div className='mt-2 flex gap-2'>
          <Input
            type='text'
            value={inviteCode}
            readOnly
            className='block w-full rounded-xl border border-white/10 bg-bg-tertiary/85 p-2 text-base font-normal text-text-normal shadow-none outline-none normal-case'
          />
          <Button
            onClick={handleCopy}
            className='shrink-0 rounded-xl bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover'
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </label>
    </Modal>
  );
}
