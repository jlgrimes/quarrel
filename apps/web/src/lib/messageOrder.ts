type TimedMessage = {
  id: string;
  createdAt: string;
};

export function normalizeChronological<T extends TimedMessage>(messages: T[]): T[] {
  const deduped = new Map<string, T>();
  for (const message of messages) {
    deduped.set(message.id, message);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });
}
