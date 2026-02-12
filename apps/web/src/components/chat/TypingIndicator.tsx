import { useEffect, useState } from 'react';
import useWebSocket from 'react-use-websocket';
import { useAuthStore } from '../../stores/authStore';
import { getWsUrl } from '../../lib/getWsUrl';

type TypingUser = {
  userId: string;
  username: string;
  timeout: ReturnType<typeof setTimeout>;
};

export function TypingIndicator({ channelId }: { channelId: string }) {
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const currentUserId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token);
  const { lastJsonMessage } = useWebSocket(token ? getWsUrl(token) : null, { share: true });

  useEffect(() => {
    if (!lastJsonMessage) return;
    const { event, data } = lastJsonMessage as { event: string; data: any };
    if (event !== 'typing:update') return;
    if (data.channelId !== channelId) return;
    if (data.userId === currentUserId) return;

    setTypingUsers((prev) => {
      const next = new Map(prev);
      const existing = next.get(data.userId);
      if (existing) clearTimeout(existing.timeout);

      const timeout = setTimeout(() => {
        setTypingUsers((p) => {
          const n = new Map(p);
          n.delete(data.userId);
          return n;
        });
      }, 5000);

      next.set(data.userId, { userId: data.userId, username: data.username, timeout });
      return next;
    });
  }, [lastJsonMessage, channelId, currentUserId]);

  // Clear typing users on channel change
  useEffect(() => {
    return () => {
      typingUsers.forEach((u) => clearTimeout(u.timeout));
    };
  }, [channelId]);

  const users = Array.from(typingUsers.values());
  if (users.length === 0) return <div className="h-6" />;

  let text: string;
  if (users.length === 1) {
    text = `${users[0].username} is typing`;
  } else if (users.length === 2) {
    text = `${users[0].username} and ${users[1].username} are typing`;
  } else {
    text = 'Several people are typing';
  }

  return (
    <div className="h-6 px-4 text-xs text-text-muted flex items-center gap-1">
      <span className="inline-flex gap-0.5">
        <span className="animate-bounce [animation-delay:0ms] w-1 h-1 bg-text-muted rounded-full" />
        <span className="animate-bounce [animation-delay:150ms] w-1 h-1 bg-text-muted rounded-full" />
        <span className="animate-bounce [animation-delay:300ms] w-1 h-1 bg-text-muted rounded-full" />
      </span>
      <span className="font-medium text-white">{text}</span>...
    </div>
  );
}
