import { describe, it, expect } from 'vitest';
import { normalizeChronological } from '../../lib/messageOrder';

describe('normalizeChronological', () => {
  it('sorts messages oldest-to-newest across mixed pages', () => {
    const result = normalizeChronological([
      { id: 'm4', createdAt: '2024-01-01T00:04:00.000Z' },
      { id: 'm3', createdAt: '2024-01-01T00:03:00.000Z' },
      { id: 'm2', createdAt: '2024-01-01T00:02:00.000Z' },
      { id: 'm1', createdAt: '2024-01-01T00:01:00.000Z' },
    ]);

    expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('dedupes duplicate IDs and keeps the latest payload for that ID', () => {
    const result = normalizeChronological([
      { id: 'm1', createdAt: '2024-01-01T00:01:00.000Z', content: 'old' },
      { id: 'm1', createdAt: '2024-01-01T00:01:00.000Z', content: 'new' },
      { id: 'm2', createdAt: '2024-01-01T00:02:00.000Z', content: 'hello' },
    ]);

    expect(result).toHaveLength(2);
    expect(result.find((m) => m.id === 'm1')?.content).toBe('new');
  });
});
