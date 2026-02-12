import { create } from 'zustand';
import { analytics } from '../lib/analytics';

type ModalType = 'createServer' | 'joinServer' | 'settings' | 'createChannel' | 'inviteServer' | 'serverSettings' | null;

type UIStore = {
  activeChannelId: string | null;
  modal: ModalType;
  replyingTo: string | null;
  showMemberList: boolean;
  showPins: boolean;
  mobileSidebarOpen: boolean;
  setActiveChannel: (id: string | null) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  setReplyingTo: (id: string | null) => void;
  toggleMemberList: () => void;
  togglePins: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
};

export const useUIStore = create<UIStore>((set, get) => ({
  activeChannelId: null,
  modal: null,
  replyingTo: null,
  showMemberList: true,
  showPins: false,
  mobileSidebarOpen: false,
  setActiveChannel: (id) => set({ activeChannelId: id }),
  openModal: (modal) => { set({ modal }); analytics.capture('ui:modal_open', { modal }); },
  closeModal: () => { const prev = get().modal; set({ modal: null }); analytics.capture('ui:modal_close', { modal: prev }); },
  setReplyingTo: (id) => set({ replyingTo: id }),
  toggleMemberList: () => set({ showMemberList: !get().showMemberList }),
  togglePins: () => set({ showPins: !get().showPins }),
  setMobileSidebarOpen: (open) =>
    set((state) =>
      state.mobileSidebarOpen === open ? state : { mobileSidebarOpen: open },
    ),
}));
