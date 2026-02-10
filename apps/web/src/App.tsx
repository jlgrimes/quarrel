import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useServerStore } from './stores/serverStore';
import { useUIStore } from './stores/uiStore';
import { useMessageStore } from './stores/messageStore';
import { wsClient } from './lib/ws';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FriendsPage from './pages/FriendsPage';
import DMPage from './pages/DMPage';
import { ChatArea } from './components/chat/ChatArea';
import ServerSidebar from './components/navigation/ServerSidebar';
import ChannelSidebar from './components/navigation/ChannelSidebar';
import MemberList from './components/navigation/MemberList';
import CreateServerModal from './components/modals/CreateServerModal';
import JoinServerModal from './components/modals/JoinServerModal';
import CreateChannelModal from './components/modals/CreateChannelModal';
import SettingsModal from './components/modals/SettingsModal';

function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function ModalRenderer() {
  const modal = useUIStore((s) => s.modal);
  return (
    <>
      {modal === 'createServer' && <CreateServerModal />}
      {modal === 'joinServer' && <JoinServerModal />}
      {modal === 'createChannel' && <CreateChannelModal />}
      {modal === 'settings' && <SettingsModal />}
    </>
  );
}

function AppLayout() {
  const fetchServers = useServerStore((s) => s.fetchServers);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return (
    <div className="flex h-full">
      <ServerSidebar />
      <Outlet />
      <ModalRenderer />
    </div>
  );
}

function DMLayout() {
  return (
    <div className="flex flex-1">
      <DMPage />
    </div>
  );
}

function FriendsLayout() {
  return (
    <div className="flex flex-1 flex-col bg-[#313338]">
      <FriendsPage />
    </div>
  );
}

function ServerView() {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const showMemberList = useUIStore((s) => s.showMemberList);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);
  const fetchChannels = useServerStore((s) => s.fetchChannels);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const channels = useServerStore((s) => s.channels);
  const addMessage = useMessageStore((s) => s.addMessage);
  const updateMessage = useMessageStore((s) => s.updateMessage);
  const removeMessage = useMessageStore((s) => s.removeMessage);

  useEffect(() => {
    if (serverId) {
      setActiveServer(serverId);
      fetchChannels(serverId);
      fetchMembers(serverId);
    }
    return () => setActiveServer(null);
  }, [serverId, fetchChannels, fetchMembers, setActiveServer]);

  // Sync activeChannelId to uiStore
  useEffect(() => {
    setActiveChannel(channelId ?? null);
    return () => setActiveChannel(null);
  }, [channelId, setActiveChannel]);

  // Auto-navigate to first text channel if none selected
  useEffect(() => {
    if (serverId && !channelId && channels.length > 0) {
      const first = channels.find((c) => c.type === 'text');
      if (first) navigate(`/channels/${serverId}/${first.id}`, { replace: true });
    }
  }, [serverId, channelId, channels, navigate]);

  // WebSocket event handlers
  useEffect(() => {
    const unsubs = [
      wsClient.on('message:new', (msg) => {
        addMessage(msg.channelId, msg);
      }),
      wsClient.on('message:updated', (msg) => {
        updateMessage(msg.channelId, msg);
      }),
      wsClient.on('message:deleted', (data) => {
        removeMessage(data.channelId, data.messageId);
      }),
      wsClient.on('member:joined', (member) => {
        useServerStore.getState().updateMember(member);
      }),
      wsClient.on('member:left', (data) => {
        useServerStore.getState().removeMember(data.userId);
      }),
      wsClient.on('channel:created', (channel) => {
        useServerStore.getState().addChannel(channel);
      }),
      wsClient.on('presence:update', (data: { userId: string; status: string }) => {
        useServerStore.getState().updateMemberStatus(data.userId, data.status);
        const currentUser = useAuthStore.getState().user;
        if (currentUser && data.userId === currentUser.id) {
          useAuthStore.setState({ user: { ...currentUser, status: data.status } });
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [addMessage, updateMessage, removeMessage]);

  return (
    <>
      <ChannelSidebar />
      <div className="flex flex-1 flex-col bg-[#313338]">
        {channelId ? (
          <ChatArea channelId={channelId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[#949ba4]">
            Select a channel
          </div>
        )}
      </div>
      {showMemberList && <MemberList />}
    </>
  );
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#313338]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#949ba4] border-t-white" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/channels/@me" />} />
      <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/channels/@me" />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/channels/@me" element={<FriendsLayout />} />
          <Route path="/channels/@me/:conversationId" element={<DMLayout />} />
          <Route path="/channels/:serverId/:channelId?" element={<ServerView />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? '/channels/@me' : '/login'} replace />} />
    </Routes>
  );
}
