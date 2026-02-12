function getBaseWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) return envUrl;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

export function getWsUrl(token?: string): string {
  const base = getBaseWsUrl();
  if (!token) return base;

  try {
    const url = new URL(base, window.location.href);
    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(token)}`;
  }
}
