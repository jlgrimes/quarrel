import { create } from 'zustand';
import type { Server, Channel, Member } from '@quarrel/shared';
import { api } from '../lib/api';

type ServerStore = {
  servers: Server[];
  channels: Channel[];
  members: Member[];
  activeServerId: string | null;
  fetchServers: () => Promise<void>;
  fetchChannels: (serverId: string) => Promise<void>;
  fetchMembers: (serverId: string) => Promise<void>;
  setActiveServer: (id: string | null) => void;
  createServer: (name: string) => Promise<Server>;
  joinServer: (inviteCode: string) => Promise<Server>;
  addChannel: (channel: Channel) => void;
  updateMember: (member: Member) => void;
  removeMember: (userId: string) => void;
};

export const useServerStore = create<ServerStore>((set, get) => ({
  servers: [],
  channels: [],
  members: [],
  activeServerId: null,
  fetchServers: async () => {
    try {
      const servers = await api.getServers();
      set({ servers: Array.isArray(servers) ? servers : [] });
    } catch {
      set({ servers: [] });
    }
  },
  fetchChannels: async (serverId) => {
    try {
      const channels = await api.getChannels(serverId);
      set({ channels: Array.isArray(channels) ? channels : [] });
    } catch {
      set({ channels: [] });
    }
  },
  fetchMembers: async (serverId) => {
    try {
      const members = await api.getMembers(serverId);
      set({ members: Array.isArray(members) ? members : [] });
    } catch {
      set({ members: [] });
    }
  },
  setActiveServer: (id) => set({ activeServerId: id }),
  createServer: async (name) => {
    const server = await api.createServer(name);
    set({ servers: [...get().servers, server] });
    return server;
  },
  joinServer: async (inviteCode) => {
    const server = await api.joinServer(inviteCode);
    set({ servers: [...get().servers, server] });
    return server;
  },
  addChannel: (channel) => set({ channels: [...get().channels, channel] }),
  updateMember: (member) => {
    const members = get().members;
    const idx = members.findIndex((m) => m.userId === member.userId);
    if (idx >= 0) {
      const updated = [...members];
      updated[idx] = member;
      set({ members: updated });
    } else {
      set({ members: [...members, member] });
    }
  },
  removeMember: (userId) =>
    set({ members: get().members.filter((m) => m.userId !== userId) }),
}));
