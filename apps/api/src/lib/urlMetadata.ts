export interface UrlMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  type: string | null;
  favicon: string | null;
}

// Simple in-memory cache with TTL
const cache = new Map<string, { data: UrlMetadata; expiresAt: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_SIZE = 500;

export function getCachedMetadata(url: string): UrlMetadata | null {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(url);
    return null;
  }
  return entry.data;
}

export function setCachedMetadata(url: string, data: UrlMetadata): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL });
}

export function clearMetadataCache(): void {
  cache.clear();
}

function extractMetaContent(html: string, property: string): string | null {
  // Match both property="" and name="" attributes
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegex(property)}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const match = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
  if (!match) return null;
  const href = match[1];
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function resolveUrl(url: string, base: string): string | null {
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const cached = getCachedMetadata(url);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'QuarrelBot/1.0 (+https://quarrel.app)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error('Not HTML content');
    }

    // Only read first 50KB to avoid memory issues
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let html = '';
    const decoder = new TextDecoder();
    let bytesRead = 0;
    const maxBytes = 50 * 1024;

    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.byteLength;
    }
    reader.cancel();

    const metadata: UrlMetadata = {
      url,
      title: extractMetaContent(html, 'og:title') ?? extractTitle(html),
      description: extractMetaContent(html, 'og:description')
        ?? extractMetaContent(html, 'description'),
      image: (() => {
        const ogImage = extractMetaContent(html, 'og:image');
        return ogImage ? resolveUrl(ogImage, url) : null;
      })(),
      siteName: extractMetaContent(html, 'og:site_name'),
      type: extractMetaContent(html, 'og:type'),
      favicon: extractFavicon(html, url),
    };

    setCachedMetadata(url, metadata);
    return metadata;
  } finally {
    clearTimeout(timeout);
  }
}
