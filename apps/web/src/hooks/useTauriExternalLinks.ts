import { useEffect } from 'react';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

export function useTauriExternalLinks() {
  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) return;

    const handler = async (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('/')) return;

      // Intercept external links (target="_blank" or absolute URLs)
      const isExternal =
        anchor.target === '_blank' ||
        (href.startsWith('http') && !href.includes('tauri.localhost'));
      if (!isExternal) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        await window.__TAURI_INTERNALS__!.invoke('plugin:shell|open', {
          path: href,
          with: undefined,
        });
      } catch (err) {
        console.error('Failed to open external link:', err);
      }
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);
}
