import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EmbedPreview, extractUrls } from '../../components/chat/EmbedPreview';

const mockGetUrlMetadata = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    getUrlMetadata: (...args: any[]) => mockGetUrlMetadata(...args),
  },
}));

vi.mock('../../lib/analytics', () => ({
  analytics: {
    capture: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractUrls', () => {
  it('extracts http URLs from text', () => {
    const urls = extractUrls('Check out http://example.com please');
    expect(urls).toEqual(['http://example.com']);
  });

  it('extracts https URLs from text', () => {
    const urls = extractUrls('Visit https://example.com/page?q=1');
    expect(urls).toEqual(['https://example.com/page?q=1']);
  });

  it('extracts multiple URLs', () => {
    const urls = extractUrls('See https://a.com and https://b.com');
    expect(urls).toEqual(['https://a.com', 'https://b.com']);
  });

  it('deduplicates URLs', () => {
    const urls = extractUrls('https://example.com and again https://example.com');
    expect(urls).toEqual(['https://example.com']);
  });

  it('returns empty for text without URLs', () => {
    const urls = extractUrls('Hello world, no links here');
    expect(urls).toEqual([]);
  });
});

describe('EmbedPreview', () => {
  it('renders nothing for messages without URLs', () => {
    const { container } = render(<EmbedPreview content="Hello world" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders YouTube embed for YouTube URLs', () => {
    const { container } = render(
      <EmbedPreview content="Check this out https://www.youtube.com/watch?v=dQw4w9WgXcB" />
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcB');
  });

  it('renders YouTube embed for youtu.be short URLs', () => {
    const { container } = render(
      <EmbedPreview content="Watch https://youtu.be/dQw4w9WgXcB" />
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcB');
  });

  it('fetches and renders embed card for regular URLs', async () => {
    mockGetUrlMetadata.mockResolvedValueOnce({
      url: 'https://example.com/article',
      title: 'Example Article',
      description: 'An interesting article about things',
      image: 'https://example.com/image.jpg',
      siteName: 'Example',
      type: 'article',
      favicon: 'https://example.com/favicon.ico',
    });

    render(<EmbedPreview content="Read this https://example.com/article" />);

    await waitFor(() => {
      expect(screen.getByText('Example Article')).toBeInTheDocument();
    });

    expect(screen.getByText('An interesting article about things')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(mockGetUrlMetadata).toHaveBeenCalledWith('https://example.com/article');
  });

  it('renders nothing when metadata has no title/description/image', async () => {
    mockGetUrlMetadata.mockResolvedValueOnce({
      url: 'https://example.com/empty',
      title: null,
      description: null,
      image: null,
      siteName: null,
      type: null,
      favicon: null,
    });

    const { container } = render(<EmbedPreview content="Visit https://example.com/empty" />);

    // Wait for async fetch to complete
    await waitFor(() => {
      expect(mockGetUrlMetadata).toHaveBeenCalled();
    });

    // The EmbedCard should not render any card content
    expect(container.querySelector('.border-l-4')).toBeNull();
  });

  it('limits to 3 URLs per message', async () => {
    mockGetUrlMetadata.mockResolvedValue({
      url: 'https://example.com',
      title: 'Example',
      description: null,
      image: null,
      siteName: null,
      type: null,
      favicon: null,
    });

    render(
      <EmbedPreview content="https://a.com https://b.com https://c.com https://d.com https://e.com" />
    );

    await waitFor(() => {
      expect(mockGetUrlMetadata).toHaveBeenCalledTimes(3);
    });
  });

  it('handles API errors gracefully', async () => {
    mockGetUrlMetadata.mockRejectedValueOnce(new Error('Network error'));

    const { container } = render(
      <EmbedPreview content="Visit https://example.com/failing" />
    );

    // Wait for the fetch attempt
    await waitFor(() => {
      expect(mockGetUrlMetadata).toHaveBeenCalled();
    });

    // Should not crash, no embed card rendered
    expect(container.querySelector('.border-l-4')).toBeNull();
  });
});
