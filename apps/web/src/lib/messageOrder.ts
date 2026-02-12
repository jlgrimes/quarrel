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
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
