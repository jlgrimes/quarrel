import { create } from 'zustand';

type ModalType = 'createServer' | 'joinServer' | 'settings' | 'createChannel' | null;

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
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  setReplyingTo: (id) => set({ replyingTo: id }),
  toggleMemberList: () => set({ showMemberList: !get().showMemberList }),
}));
