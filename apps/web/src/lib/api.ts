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
    request<{ user: any; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (username: string, email: string, password: string) =>
    request<{ user: any; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: any; token: string }>('/auth/me'),

  // Servers
  getServers: () => request<{ servers: any[] }>('/servers').then(r => r.servers),
  getServer: (id: string) => request<{ server: any }>(`/servers/${id}`).then(r => r.server),
  createServer: (name: string) =>
    request<{ server: any }>('/servers', { method: 'POST', body: JSON.stringify({ name }) }).then(r => r.server),
  joinServer: (inviteCode: string) =>
    request<{ server: any }>(`/servers/join/${inviteCode}`, { method: 'POST' }).then(r => r.server),
  leaveServer: (id: string) => request(`/servers/${id}/leave`, { method: 'POST' }),

  // Channels
  getChannels: (serverId: string) =>
    request<{ channels: any[] }>(`/servers/${serverId}/channels`).then(r => r.channels),
  createChannel: (serverId: string, data: { name: string; type?: string; categoryId?: string }) =>
    request<{ channel: any }>(`/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify(data) }).then(r => r.channel),

  // Messages
  getMessages: (channelId: string, cursor?: string) =>
    request<{ messages: any[]; nextCursor: string | null }>(`/channels/${channelId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
  sendMessage: (channelId: string, content: string, replyToId?: string) =>
    request<{ message: any }>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToId }),
    }).then(r => r.message),
  editMessage: (messageId: string, content: string) =>
    request<{ message: any }>(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }).then(r => r.message),
  deleteMessage: (messageId: string) =>
    request(`/messages/${messageId}`, { method: 'DELETE' }),

  // Members
  getMembers: (serverId: string) =>
    request<{ members: any[] }>(`/servers/${serverId}/members`).then(r => r.members),

  // Friends
  getFriends: () => request<{ friends: any[] }>('/friends').then(r => r.friends),
  addFriend: (userId: string) =>
    request('/friends/' + userId, { method: 'POST' }),
  acceptFriend: (id: string) => request(`/friends/${id}/accept`, { method: 'PATCH' }),
  removeFriend: (id: string) => request(`/friends/${id}`, { method: 'DELETE' }),

  // DMs
  getConversations: () => request<{ conversations: any[] }>('/dms/conversations').then(r => r.conversations),
  createConversation: (userId: string) =>
    request<{ conversation: any }>('/dms/conversations', { method: 'POST', body: JSON.stringify({ userId }) }).then(r => r.conversation),
  getDMs: (conversationId: string, cursor?: string) =>
    request<{ messages: any[]; nextCursor: string | null }>(`/dms/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
  sendDM: (conversationId: string, content: string) =>
    request<{ message: any }>(`/dms/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }).then(r => r.message),

  // Profile
  updateProfile: (data: { displayName?: string; avatarUrl?: string; customStatus?: string }) =>
    request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
};
