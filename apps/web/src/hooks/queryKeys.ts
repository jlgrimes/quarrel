export const queryKeys = {
  servers: ['servers'] as const,
  channels: (serverId: string) => ['channels', serverId] as const,
  members: (serverId: string) => ['members', serverId] as const,
  messages: (channelId: string) => ['messages', channelId] as const,
  friends: ['friends'] as const,
  conversations: ['conversations'] as const,
  dms: (conversationId: string) => ['dms', conversationId] as const,
};
