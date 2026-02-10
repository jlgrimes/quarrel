import { create } from 'zustand';
import { analytics } from '../lib/analytics';

type ModalType = 'createServer' | 'joinServer' | 'settings' | 'createChannel' | 'inviteServer' | null;

type UIStore = {
  activeChannelId: string | null;
  modal: ModalType;
  replyingTo: string | null;
  showMemberList: boolean;
  setActiveChannel: (id: string | null) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  setReplyingTo: (id: string | null) => void;
  toggleMemberList: () => void;
};

export const useUIStore = create<UIStore>((set, get) => ({
  activeChannelId: null,
  modal: null,
  replyingTo: null,
  showMemberList: true,
  setActiveChannel: (id) => set({ activeChannelId: id }),
  openModal: (modal) => { set({ modal }); analytics.capture('ui:modal_open', { modal }); },
  closeModal: () => { const prev = get().modal; set({ modal: null }); analytics.capture('ui:modal_close', { modal: prev }); },
  setReplyingTo: (id) => set({ replyingTo: id }),
  toggleMemberList: () => set({ showMemberList: !get().showMemberList }),
}));
