import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../stores/uiStore';

beforeEach(() => {
  useUIStore.setState({
    activeChannelId: null,
    modal: null,
    replyingTo: null,
    showMemberList: true,
  });
});

describe('uiStore', () => {
  it('openModal and closeModal', () => {
    useUIStore.getState().openModal('createServer');
    expect(useUIStore.getState().modal).toBe('createServer');

    useUIStore.getState().closeModal();
    expect(useUIStore.getState().modal).toBeNull();
  });

  it('setActiveChannel', () => {
    useUIStore.getState().setActiveChannel('ch-1');
    expect(useUIStore.getState().activeChannelId).toBe('ch-1');

    useUIStore.getState().setActiveChannel(null);
    expect(useUIStore.getState().activeChannelId).toBeNull();
  });

  it('toggleMemberList', () => {
    expect(useUIStore.getState().showMemberList).toBe(true);

    useUIStore.getState().toggleMemberList();
    expect(useUIStore.getState().showMemberList).toBe(false);

    useUIStore.getState().toggleMemberList();
    expect(useUIStore.getState().showMemberList).toBe(true);
  });

  it('setReplyingTo', () => {
    useUIStore.getState().setReplyingTo('msg-1');
    expect(useUIStore.getState().replyingTo).toBe('msg-1');

    useUIStore.getState().setReplyingTo(null);
    expect(useUIStore.getState().replyingTo).toBeNull();
  });
});
