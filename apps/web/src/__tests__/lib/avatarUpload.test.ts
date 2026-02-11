import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage for auth headers
const mockLocalStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockLocalStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
  removeItem: (key: string) => { delete mockLocalStorage[key]; },
});

import { api } from '../../lib/api';

beforeEach(() => {
  vi.clearAllMocks();
  mockLocalStorage['auth-token'] = JSON.stringify('test-token');
});

describe('api.uploadAvatar', () => {
  it('throws when R2 upload returns non-ok response', async () => {
    mockFetch
      // First call: presign endpoint succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          presignedUrl: 'https://r2.example.com/upload',
          publicUrl: 'https://cdn.example.com/avatar.png',
        }),
      })
      // Second call: R2 PUT fails
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

    const file = new File(['test'], 'avatar.png', { type: 'image/png' });
    await expect(api.uploadAvatar(file)).rejects.toThrow('Failed to upload avatar');
  });

  it('calls updateProfile after successful R2 upload', async () => {
    mockFetch
      // First call: presign endpoint succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          presignedUrl: 'https://r2.example.com/upload',
          publicUrl: 'https://cdn.example.com/avatar.png',
        }),
      })
      // Second call: R2 PUT succeeds
      .mockResolvedValueOnce({
        ok: true,
      })
      // Third call: updateProfile succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: { avatarUrl: 'https://cdn.example.com/avatar.png' },
        }),
      });

    const file = new File(['test'], 'avatar.png', { type: 'image/png' });
    await api.uploadAvatar(file);

    // Verify the R2 PUT was called with correct params
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const r2Call = mockFetch.mock.calls[1];
    expect(r2Call[0]).toBe('https://r2.example.com/upload');
    expect(r2Call[1].method).toBe('PUT');
    expect(r2Call[1].headers['Content-Type']).toBe('image/png');

    // Verify updateProfile was called with the public URL
    const updateCall = mockFetch.mock.calls[2];
    expect(updateCall[0]).toContain('/users/me');
    expect(JSON.parse(updateCall[1].body)).toEqual({
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });
  });

  it('does not call updateProfile when R2 upload fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          presignedUrl: 'https://r2.example.com/upload',
          publicUrl: 'https://cdn.example.com/avatar.png',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

    const file = new File(['test'], 'avatar.png', { type: 'image/png' });
    await expect(api.uploadAvatar(file)).rejects.toThrow();

    // Only 2 fetch calls: presign + failed R2 PUT; no updateProfile call
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
