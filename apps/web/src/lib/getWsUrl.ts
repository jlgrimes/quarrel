let cachedUrl: string | null = null;

export function getWsUrl(): string {
  if (cachedUrl) return cachedUrl;
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) {
    cachedUrl = envUrl;
    return envUrl;
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  cachedUrl = `${protocol}//${location.host}/ws`;
  return cachedUrl;
}
