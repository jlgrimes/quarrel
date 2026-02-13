type TimedMessage = {
  id: string;
  createdAt: string;
  isBot?: boolean;
  author?: {
    isBot?: boolean;
  } | null;
  role?: string;
  senderType?: string;
};

function isAgentMessage(message: TimedMessage): boolean {
  if (message.isBot === true || message.author?.isBot === true) {
    return true;
  }

  const role = message.role?.toLowerCase();
  const senderType = message.senderType?.toLowerCase();
  return (
    role === 'assistant' ||
    role === 'agent' ||
    role === 'bot' ||
    role === 'ai' ||
    senderType === 'assistant' ||
    senderType === 'agent' ||
    senderType === 'bot' ||
    senderType === 'ai'
  );
}

export function normalizeChronological<T extends TimedMessage>(messages: T[]): T[] {
  const deduped = new Map<string, T>();
  for (const message of messages) {
    deduped.set(message.id, message);
  }

  return Array.from(deduped.values())
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const timeDiff =
        new Date(a.message.createdAt).getTime() -
        new Date(b.message.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;

      // Tie-breaker for simultaneous events: user messages should render before agent/bot messages.
      const senderDiff =
        Number(isAgentMessage(a.message)) - Number(isAgentMessage(b.message));
      if (senderDiff !== 0) return senderDiff;

      // Preserve deterministic order for all other ties.
      return a.index - b.index;
    })
    .map(({ message }) => message);
}
