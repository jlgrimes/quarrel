import { useEffect, lazy, Suspense, useMemo } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { usePageView } from './hooks/usePageView';
import { useTauriExternalLinks } from './hooks/useTauriExternalLinks';
import { useUIStore } from './stores/uiStore';
import { useChannels } from './hooks/useChannels';
import { useWebSocketEvents } from './hooks/useWebSocketEvents';
import NotificationToast from './components/NotificationToast';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FriendsPage from './pages/FriendsPage';
import DMPage from './pages/DMPage';
import { ChatArea } from './components/chat/ChatArea';
import { VoiceChannelView } from './components/voice/VoiceChannelView';
import ServerSidebar from './components/navigation/ServerSidebar';
import ChannelSidebar from './components/navigation/ChannelSidebar';
import DMSidebar from './components/navigation/DMSidebar';
import MemberList from './components/navigation/MemberList';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

const CreateServerModal = lazy(() => import('./components/modals/CreateServerModal'));
const JoinServerModal = lazy(() => import('./components/modals/JoinServerModal'));
const CreateChannelModal = lazy(() => import('./components/modals/CreateChannelModal'));
const UserSettingsOverlay = lazy(() => import('./components/settings/UserSettingsOverlay'));
const InviteModal = lazy(() => import('./components/modals/InviteModal'));

function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function ModalRenderer() {
  const modal = useUIStore((s) => s.modal);
  if (!modal) return null;
  return (
    <Suspense fallback={null}>
      {modal === 'createServer' && <CreateServerModal />}
      {modal === 'joinServer' && <JoinServerModal />}
      {modal === 'createChannel' && <CreateChannelModal />}
      {modal === 'settings' && <UserSettingsOverlay />}
      {modal === 'inviteServer' && <InviteModal />}
    </Suspense>
  );
}

function MobileSidebarSync() {
  const { openMobile, setOpenMobile } = useSidebar();
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);

  // Sync shadcn openMobile → uiStore mobileSidebarOpen
  useEffect(() => {
    setMobileSidebarOpen(openMobile);
  }, [openMobile, setMobileSidebarOpen]);

  // Sync uiStore mobileSidebarOpen → shadcn openMobile
  useEffect(() => {
    setOpenMobile(mobileSidebarOpen);
  }, [mobileSidebarOpen, setOpenMobile]);

  return null;
}

function AppLayout() {
  useWebSocketEvents();

  return (
    <div className="flex h-full overflow-hidden">
      <ServerSidebar />
      <Outlet />
      <ModalRenderer />
      <NotificationToast />
    </div>
  );
}

function DMAreaLayout() {
  return (
    <SidebarProvider
      className="min-h-0 h-full flex-1 min-w-0"
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      <DMSidebar />
      <div className="flex flex-1 flex-col bg-[#313338] min-w-0">
        <Outlet />
      </div>
      <MobileSidebarSync />
    </SidebarProvider>
  );
}

function ServerView() {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const showMemberList = useUIStore((s) => s.showMemberList);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);
  const { data: channels = [] } = useChannels(serverId);

  const activeChannel = useMemo(
    () => channelId ? channels.find((c) => c.id === channelId) : undefined,
    [channels, channelId],
  );

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

  return (
    <SidebarProvider
      className="min-h-0 h-full flex-1 min-w-0"
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      <ChannelSidebar />
      <div className="flex flex-1 flex-col bg-[#313338] min-w-0">
        {channelId ? (
          activeChannel?.type === 'voice' ? (
            <VoiceChannelView channelId={channelId} />
          ) : (
            <ChatArea channelId={channelId} serverId={serverId!} />
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-[#949ba4]">
            <SidebarTrigger className="mb-4 text-[#b5bac1] hover:text-white md:hidden size-8" />
            Select a channel
          </div>
        )}
      </div>
      {showMemberList && serverId && <MemberList serverId={serverId} className="max-md:hidden" />}
      <MobileSidebarSync />
    </SidebarProvider>
  );
}

export default function App() {
  usePageView();
  useTauriExternalLinks();
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
    <TooltipProvider>
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/channels/@me" />} />
      <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/channels/@me" />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<DMAreaLayout />}>
            <Route path="/channels/@me" element={<FriendsPage />} />
            <Route path="/channels/@me/:conversationId" element={<DMPage />} />
          </Route>
          <Route path="/channels/:serverId/:channelId?" element={<ServerView />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? '/channels/@me' : '/login'} replace />} />
    </Routes>
    </TooltipProvider>
  );
}
