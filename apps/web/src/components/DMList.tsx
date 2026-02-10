import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Conversation } from '@quarrel/shared';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import UserBar from './UserBar';

export default function DMList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    api.getConversations().then(setConversations).catch(() => {});
  }, []);

  return (
    <div className="flex h-full w-60 flex-col bg-[#2b2d31]">
      <div className="flex h-12 items-center border-b border-[#1f2023] px-4 shadow-sm">
        <input
          type="text"
          placeholder="Find or start a conversation"
          className="w-full rounded bg-[#1e1f22] px-2 py-1 text-sm text-[#dbdee1] placeholder-[#949ba4] outline-none"
          readOnly
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-4">
        <button
          onClick={() => navigate('/channels/@me')}
          className="mb-1 flex w-full items-center gap-3 rounded px-2 py-2 text-[#949ba4] hover:bg-[#383a40] hover:text-[#dbdee1]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
          </svg>
          <span className="text-sm font-medium">Friends</span>
        </button>

        <h3 className="mb-1 mt-4 px-2 text-xs font-semibold uppercase text-[#949ba4]">
          Direct Messages
        </h3>

        {conversations.map((conv) => {
          const other = conv.members?.find((m) => m.id !== user?.id);
          return (
            <button
              key={conv.id}
              onClick={() => navigate(`/channels/@me/${conv.id}`)}
              className="mb-0.5 flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-[#383a40]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5865f2]">
                <span className="text-xs font-medium text-white">
                  {(other?.displayName || other?.username || '?')[0].toUpperCase()}
                </span>
              </div>
              <span className="truncate text-sm text-[#949ba4]">
                {other?.displayName || other?.username || 'User'}
              </span>
            </button>
          );
        })}
      </div>

      <UserBar />
    </div>
  );
}
