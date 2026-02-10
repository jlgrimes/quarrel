import { create } from 'zustand';
import type { VoiceParticipant } from '@quarrel/shared';
import { wsSend } from '../lib/wsBridge';
import { analytics } from '../lib/analytics';
import { useAuthStore } from './authStore';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const SPEAKING_THRESHOLD = 15; // volume level 0-255 to count as speaking
const SPEAKING_CHECK_INTERVAL = 80; // ms between checks

type PeerEntry = {
  connection: RTCPeerConnection;
  audioElement: HTMLAudioElement;
};

// Audio monitoring state — kept outside the store to avoid re-renders on every poll
let audioContext: AudioContext | null = null;
const audioMonitors = new Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>();
let monitorInterval: ReturnType<typeof setInterval> | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

function startMonitoringStream(userId: string, stream: MediaStream) {
  stopMonitoringStream(userId);
  const ctx = getAudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  audioMonitors.set(userId, { analyser, source });
  ensureMonitorLoop();
}

function stopMonitoringStream(userId: string) {
  const monitor = audioMonitors.get(userId);
  if (monitor) {
    monitor.source.disconnect();
    audioMonitors.delete(userId);
  }
}

function stopAllMonitoring() {
  for (const [id] of audioMonitors) stopMonitoringStream(id);
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  useVoiceStore.setState({ speakingUsers: new Set() });
}

function ensureMonitorLoop() {
  if (monitorInterval) return;
  const dataArray = new Uint8Array(128);
  monitorInterval = setInterval(() => {
    const newSpeaking = new Set<string>();
    for (const [userId, { analyser }] of audioMonitors) {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      if (avg > SPEAKING_THRESHOLD) newSpeaking.add(userId);
    }
    const prev = useVoiceStore.getState().speakingUsers;
    // Only update if changed
    if (newSpeaking.size !== prev.size || [...newSpeaking].some((id) => !prev.has(id))) {
      useVoiceStore.setState({ speakingUsers: newSpeaking });
    }
  }, SPEAKING_CHECK_INTERVAL);
}

type VoiceStore = {
  currentChannelId: string | null;
  participants: VoiceParticipant[];
  localStream: MediaStream | null;
  peerConnections: Map<string, PeerEntry>;
  speakingUsers: Set<string>;
  isMuted: boolean;
  isDeafened: boolean;
  isConnecting: boolean;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  cleanup: () => void;
  _handleVoiceState: (data: { channelId: string; participants: VoiceParticipant[] }) => void;
  _handleUserJoined: (data: { channelId: string; participant: VoiceParticipant }) => void;
  _handleUserLeft: (data: { channelId: string; userId: string }) => void;
  _handleOffer: (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => void;
  _handleAnswer: (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => void;
  _handleIceCandidate: (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => void;
  _handleMuteUpdate: (data: { userId: string; isMuted: boolean; isDeafened: boolean }) => void;
};

function createPeerConnection(remoteUserId: string, isOfferer: boolean): RTCPeerConnection {
  const state = useVoiceStore.getState();
  const pc = new RTCPeerConnection(ICE_SERVERS);

  if (state.localStream) {
    for (const track of state.localStream.getAudioTracks()) {
      pc.addTrack(track, state.localStream);
    }
  }

  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.muted = state.isDeafened;
  document.body.appendChild(audioEl);

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
    audioEl.srcObject = remoteStream;
    startMonitoringStream(remoteUserId, remoteStream);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      wsSend('voice:ice-candidate', {
        targetUserId: remoteUserId,
        candidate: event.candidate.toJSON(),
      });
    }
  };

  const peers = new Map(useVoiceStore.getState().peerConnections);
  peers.set(remoteUserId, { connection: pc, audioElement: audioEl });
  useVoiceStore.setState({ peerConnections: peers });

  if (isOfferer) {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        wsSend('voice:offer', {
          targetUserId: remoteUserId,
          sdp: pc.localDescription,
        });
      });
  }

  return pc;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  currentChannelId: null,
  participants: [],
  localStream: null,
  peerConnections: new Map(),
  speakingUsers: new Set(),
  isMuted: false,
  isDeafened: false,
  isConnecting: false,

  joinChannel: async (channelId) => {
    const state = get();
    if (state.currentChannelId) {
      state.leaveChannel();
    }

    set({ isConnecting: true, currentChannelId: channelId });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      set({ localStream: stream });
      const selfId = useAuthStore.getState().user?.id;
      if (selfId) startMonitoringStream(selfId, stream);
      wsSend('voice:join', { channelId });
      analytics.capture('voice:join', { channelId });
    } catch {
      set({ isConnecting: false, currentChannelId: null, localStream: null });
    }
  },

  leaveChannel: () => {
    const state = get();
    if (state.currentChannelId) {
      wsSend('voice:leave', { channelId: state.currentChannelId });
    }

    for (const [, peer] of state.peerConnections) {
      peer.connection.close();
      peer.audioElement.srcObject = null;
      peer.audioElement.remove();
    }

    if (state.localStream) {
      for (const track of state.localStream.getTracks()) {
        track.stop();
      }
    }

    stopAllMonitoring();

    if (state.currentChannelId) { analytics.capture('voice:leave', { channelId: state.currentChannelId }); }

    set({
      currentChannelId: null,
      participants: [],
      localStream: null,
      peerConnections: new Map(),
      speakingUsers: new Set(),
      isMuted: false,
      isDeafened: false,
      isConnecting: false,
    });
  },

  toggleMute: () => {
    const state = get();
    const newMuted = !state.isMuted;

    if (state.localStream) {
      for (const track of state.localStream.getAudioTracks()) {
        track.enabled = !newMuted;
      }
    }

    set({ isMuted: newMuted });
    wsSend('voice:mute', { isMuted: newMuted, isDeafened: state.isDeafened });
  },

  toggleDeafen: () => {
    const state = get();
    const newDeafened = !state.isDeafened;
    const newMuted = newDeafened ? true : state.isMuted;

    for (const [, peer] of state.peerConnections) {
      peer.audioElement.muted = newDeafened;
    }

    if (newDeafened && state.localStream) {
      for (const track of state.localStream.getAudioTracks()) {
        track.enabled = false;
      }
    } else if (!newDeafened && !newMuted && state.localStream) {
      for (const track of state.localStream.getAudioTracks()) {
        track.enabled = true;
      }
    }

    set({ isDeafened: newDeafened, isMuted: newMuted });
    wsSend('voice:mute', { isMuted: newMuted, isDeafened: newDeafened });
  },

  cleanup: () => {
    get().leaveChannel();
  },

  _handleVoiceState: (data) => {
    const state = get();
    if (data.channelId !== state.currentChannelId) return;

    set({ participants: data.participants, isConnecting: false });

    const selfId = useAuthStore.getState().user?.id ?? '';
    for (const participant of data.participants) {
      if (participant.userId !== selfId) {
        createPeerConnection(participant.userId, true);
      }
    }
  },

  _handleUserJoined: (data) => {
    const state = get();
    if (data.channelId !== state.currentChannelId) return;

    // Skip if it's ourselves — we're already in the list from voice:state
    const selfId = useAuthStore.getState().user?.id;
    if (data.participant.userId === selfId) return;

    set({ participants: [...state.participants, data.participant] });
  },

  _handleUserLeft: (data) => {
    const state = get();
    if (data.channelId !== state.currentChannelId) return;

    stopMonitoringStream(data.userId);

    const peer = state.peerConnections.get(data.userId);
    if (peer) {
      peer.connection.close();
      peer.audioElement.srcObject = null;
      peer.audioElement.remove();
      const peers = new Map(state.peerConnections);
      peers.delete(data.userId);
      set({ peerConnections: peers });
    }

    set({ participants: state.participants.filter((p) => p.userId !== data.userId) });
  },

  _handleOffer: async (data) => {
    const pc = createPeerConnection(data.fromUserId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsSend('voice:answer', {
      targetUserId: data.fromUserId,
      sdp: pc.localDescription,
    });
  },

  _handleAnswer: async (data) => {
    const state = get();
    const peer = state.peerConnections.get(data.fromUserId);
    if (peer) {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  },

  _handleIceCandidate: async (data) => {
    const state = get();
    const peer = state.peerConnections.get(data.fromUserId);
    if (peer) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  },

  _handleMuteUpdate: (data) => {
    const state = get();
    set({
      participants: state.participants.map((p) =>
        p.userId === data.userId
          ? { ...p, isMuted: data.isMuted, isDeafened: data.isDeafened }
          : p
      ),
    });
  },
}));
