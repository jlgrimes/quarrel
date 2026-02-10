const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

// Auth
export const api = {
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (username: string, email: string, password: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<import('@quarrel/shared').User>('/auth/me'),

  // Servers
  getServers: () => request<import('@quarrel/shared').Server[]>('/servers'),
  getServer: (id: string) => request<import('@quarrel/shared').Server>(`/servers/${id}`),
  createServer: (name: string) =>
    request<import('@quarrel/shared').Server>('/servers', { method: 'POST', body: JSON.stringify({ name }) }),
  joinServer: (inviteCode: string) =>
    request<import('@quarrel/shared').Server>(`/servers/join`, { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  leaveServer: (id: string) => request(`/servers/${id}/leave`, { method: 'POST' }),

  // Channels
  getChannels: (serverId: string) =>
    request<import('@quarrel/shared').Channel[]>(`/servers/${serverId}/channels`),
  createChannel: (serverId: string, data: { name: string; type?: string; categoryId?: string }) =>
    request<import('@quarrel/shared').Channel>(`/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify(data) }),

  // Messages
  getMessages: (channelId: string, before?: string) =>
    request<import('@quarrel/shared').Message[]>(`/channels/${channelId}/messages${before ? `?before=${before}` : ''}`),
  sendMessage: (channelId: string, content: string, replyToId?: string) =>
    request<import('@quarrel/shared').Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToId }),
    }),
  editMessage: (channelId: string, messageId: string, content: string) =>
    request<import('@quarrel/shared').Message>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),
  deleteMessage: (channelId: string, messageId: string) =>
    request(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' }),

  // Members
  getMembers: (serverId: string) =>
    request<import('@quarrel/shared').Member[]>(`/servers/${serverId}/members`),

  // Friends
  getFriends: () => request<import('@quarrel/shared').Friend[]>('/friends'),
  addFriend: (username: string) =>
    request('/friends', { method: 'POST', body: JSON.stringify({ username }) }),
  acceptFriend: (id: string) => request(`/friends/${id}/accept`, { method: 'POST' }),
  removeFriend: (id: string) => request(`/friends/${id}`, { method: 'DELETE' }),
  blockUser: (id: string) => request(`/friends/${id}/block`, { method: 'POST' }),

  // DMs
  getConversations: () => request<import('@quarrel/shared').Conversation[]>('/dms'),
  createConversation: (userId: string) =>
    request<import('@quarrel/shared').Conversation>('/dms', { method: 'POST', body: JSON.stringify({ userId }) }),
  getDMs: (conversationId: string, before?: string) =>
    request<import('@quarrel/shared').DirectMessage[]>(`/dms/${conversationId}/messages${before ? `?before=${before}` : ''}`),
  sendDM: (conversationId: string, content: string) =>
    request<import('@quarrel/shared').DirectMessage>(`/dms/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Profile
  updateProfile: (data: { displayName?: string; avatarUrl?: string; customStatus?: string }) =>
    request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
};
