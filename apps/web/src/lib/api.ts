const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getAuthHeaders(): Record<string, string> {
  try {
    const state = JSON.parse(localStorage.getItem('auth-token') || '""');
    if (state) return { Authorization: `Bearer ${state}` };
  } catch {}
  return {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...options?.headers },
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
  me: () => request<{ user: any }>('/auth/me'),

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
  addReaction: (messageId: string, emoji: string) =>
    request<{ reaction: any; reactions: { emoji: string; count: number; me: boolean }[] }>(
      `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      { method: 'PUT' },
    ),
  removeReaction: (messageId: string, emoji: string) =>
    request<{ success: boolean; reactions: { emoji: string; count: number; me: boolean }[] }>(
      `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      { method: 'DELETE' },
    ),
  pinMessage: (messageId: string) =>
    request<{ message: any }>(`/messages/${messageId}/pin`, { method: 'POST' }).then(r => r.message),
  unpinMessage: (messageId: string) =>
    request<{ message: any }>(`/messages/${messageId}/pin`, { method: 'DELETE' }).then(r => r.message),
  getPinnedMessages: (channelId: string) =>
    request<{ messages: any[] }>(`/channels/${channelId}/pins`).then(r => r.messages),

  // Members
  getMembers: (serverId: string) =>
    request<{ members: any[] }>(`/servers/${serverId}/members`).then(r => r.members),

  // Roles
  getRoles: (serverId: string) =>
    request<{ roles: any[] }>(`/servers/${serverId}/roles`).then(r => r.roles),
  createRole: (serverId: string, data: { name: string; color?: string; permissions?: number }) =>
    request<{ role: any }>(`/servers/${serverId}/roles`, { method: 'POST', body: JSON.stringify(data) }).then(r => r.role),
  updateRole: (roleId: string, data: { name?: string; color?: string; permissions?: number }) =>
    request<{ role: any }>(`/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.role),
  deleteRole: (roleId: string) =>
    request(`/roles/${roleId}`, { method: 'DELETE' }),
  assignRole: (serverId: string, userId: string, roleId: string) =>
    request(`/servers/${serverId}/members/${userId}/roles/${roleId}`, { method: 'PUT' }),
  removeRole: (serverId: string, userId: string, roleId: string) =>
    request(`/servers/${serverId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' }),

  // Friends
  getFriends: () => request<{ friends: any[] }>('/friends').then(r => r.friends),
  addFriend: (username: string) =>
    request('/friends/' + username, { method: 'POST' }),
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

  // Read state
  ackChannel: (channelId: string) =>
    request<{ success: boolean; lastReadMessageId: string | null }>(`/channels/${channelId}/ack`, { method: 'POST' }),
  ackDM: (conversationId: string) =>
    request<{ success: boolean; lastReadMessageId: string | null }>(`/dms/${conversationId}/ack`, { method: 'POST' }),

  // Profile
  updateProfile: (data: { displayName?: string; avatarUrl?: string; customStatus?: string }) =>
    request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Avatar
  getAvatarPresignUrl: (contentType: string, contentLength: number) =>
    request<{ presignedUrl: string; publicUrl: string }>('/users/me/avatar/presign', {
      method: 'POST',
      body: JSON.stringify({ contentType, contentLength }),
    }),

  uploadAvatar: async (file: File) => {
    const { presignedUrl, publicUrl } = await api.getAvatarPresignUrl(file.type, file.size);
    const uploadRes = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!uploadRes.ok) {
      throw new Error('Failed to upload avatar');
    }
    return api.updateProfile({ avatarUrl: publicUrl });
  },

  removeAvatar: () =>
    request('/users/me/avatar', { method: 'DELETE' }),

  // Settings
  getSettings: () =>
    request<{ settings: any }>('/users/me/settings').then(r => r.settings),
  updateSettings: (data: {
    theme?: string;
    fontSize?: string;
    compactMode?: boolean;
    notificationsEnabled?: boolean;
    notificationSounds?: boolean;
    allowDms?: string;
  }) =>
    request<{ settings: any }>('/users/me/settings', { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.settings),

  // Password
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Account deletion
  deleteAccount: (password: string) =>
    request<{ success: boolean }>('/users/me/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  // Bots
  getBots: (serverId: string) =>
    request<{ bots: any[] }>(`/servers/${serverId}/bots`).then(r => r.bots),
  addBot: (serverId: string, data: { provider: string; model: string; apiKey: string; systemPrompt?: string }) =>
    request<{ bot: any }>(`/servers/${serverId}/bots`, { method: 'POST', body: JSON.stringify(data) }).then(r => r.bot),
  updateBot: (serverId: string, botId: string, data: { model?: string; apiKey?: string; enabled?: boolean; systemPrompt?: string | null }) =>
    request<{ bot: any }>(`/servers/${serverId}/bots/${botId}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.bot),
  removeBot: (serverId: string, botId: string) =>
    request(`/servers/${serverId}/bots/${botId}`, { method: 'DELETE' }),
  testBotConnection: (serverId: string, botId: string) =>
    request<{ success: boolean; provider: string; model: string; enabled: boolean; botName: string; latencyMs: number; responsePreview?: string; error?: string }>(
      `/servers/${serverId}/bots/${botId}/test`,
      { method: 'POST' },
    ),

  // Embeds
  getUrlMetadata: (url: string) =>
    request<{ metadata: { url: string; title: string | null; description: string | null; image: string | null; siteName: string | null; type: string | null; favicon: string | null } }>('/embeds/metadata', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }).then(r => r.metadata),
};
