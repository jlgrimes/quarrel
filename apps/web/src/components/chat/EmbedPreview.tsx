import { useState, useEffect, memo } from 'react';
import { api } from '../../lib/api';
import { analytics } from '../../lib/analytics';

export interface EmbedMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  type: string | null;
  favicon: string | null;
}

// Client-side cache to avoid re-fetching the same URLs
const metadataCache = new Map<string, EmbedMetadata>();

// Regex to extract URLs from message content
const URL_REGEX = /https?:\/\/[^\s<]+[^\s<.,;:!?'")\]]/g;

export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  if (!matches) return [];
  // Deduplicate
  return [...new Set(matches)];
}

function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') {
      return parsed.searchParams.get('v');
    }
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1);
    }
  } catch {
    // ignore
  }
  return null;
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="mt-2 ml-14 max-w-[400px] rounded-lg overflow-hidden border border-bg-tertiary">
      <iframe
        width="400"
        height="225"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full aspect-video"
      />
    </div>
  );
}

function EmbedCard({ metadata }: { metadata: EmbedMetadata }) {
  const { url, title, description, image, siteName, favicon } = metadata;

  if (!title && !description && !image) return null;

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return (
    <div className="mt-2 ml-14 max-w-[400px] border-l-4 border-brand bg-bg-secondary rounded-r-lg overflow-hidden">
      <div className="p-3">
        {(siteName || hostname) && (
          <div className="flex items-center gap-1.5 mb-1">
            {favicon && (
              <img
                src={favicon}
                alt=""
                className="w-4 h-4 rounded-sm"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <span className="text-xs text-text-muted">{siteName || hostname}</span>
          </div>
        )}

        {title && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-link text-sm font-medium hover:underline block mb-1 line-clamp-2"
            onClick={() => analytics.capture('embed:link_click', { url })}
          >
            {title}
          </a>
        )}

        {description && (
          <p className="text-xs text-text-label line-clamp-3 mb-2">{description}</p>
        )}
      </div>

      {image && (
        <img
          src={image}
          alt={title || ''}
          className="w-full max-h-[200px] object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}

export const EmbedPreview = memo(function EmbedPreview({ content }: { content: string }) {
  const urls = extractUrls(content);
  const [embeds, setEmbeds] = useState<Map<string, EmbedMetadata>>(new Map());

  useEffect(() => {
    if (urls.length === 0) return;

    let cancelled = false;

    // Only fetch first 3 URLs per message
    const urlsToFetch = urls.slice(0, 3);

    for (const url of urlsToFetch) {
      // Skip YouTube URLs — handled as iframe embeds
      if (getYouTubeId(url)) continue;

      // Check client cache first
      const cached = metadataCache.get(url);
      if (cached) {
        setEmbeds(prev => new Map(prev).set(url, cached));
        continue;
      }

      api.getUrlMetadata(url)
        .then((metadata) => {
          if (cancelled) return;
          metadataCache.set(url, metadata);
          setEmbeds(prev => new Map(prev).set(url, metadata));
        })
        .catch(() => {
          // Silently ignore fetch failures
        });
    }

    return () => { cancelled = true; };
  }, [content]);

  if (urls.length === 0) return null;

  return (
    <>
      {urls.slice(0, 3).map((url) => {
        // Special YouTube embed
        const ytId = getYouTubeId(url);
        if (ytId) {
          return <YouTubeEmbed key={url} videoId={ytId} />;
        }

        const metadata = embeds.get(url);
        if (!metadata) return null;

        return <EmbedCard key={url} metadata={metadata} />;
      })}
    </>
  );
});
