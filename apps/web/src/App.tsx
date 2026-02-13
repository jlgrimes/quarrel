import { useEffect, lazy, Suspense, useMemo } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
  Outlet,
} from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { usePageView } from './hooks/usePageView';
import { useTauriExternalLinks } from './hooks/useTauriExternalLinks';
import { useIsMobile } from './hooks/use-mobile';
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
import MobileSidebar from './components/navigation/MobileSidebar';
import { VoiceConnectionBar } from './components/voice/VoiceConnectionBar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useVoiceStore } from './stores/voiceStore';

const CreateServerModal = lazy(
  () => import('./components/modals/CreateServerModal'),
);
const JoinServerModal = lazy(
  () => import('./components/modals/JoinServerModal'),
);
const CreateChannelModal = lazy(
  () => import('./components/modals/CreateChannelModal'),
);
const UserSettingsOverlay = lazy(
  () => import('./components/settings/UserSettingsOverlay'),
);
const InviteModal = lazy(() => import('./components/modals/InviteModal'));
const ServerSettingsModal = lazy(
  () => import('./components/modals/ServerSettingsModal'),
);

function ProtectedRoute() {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to='/login' replace />;
  return <Outlet />;
}

function ModalRenderer() {
  const modal = useUIStore(s => s.modal);
  if (!modal) return null;
  return (
    <Suspense fallback={null}>
      {modal === 'createServer' && <CreateServerModal />}
      {modal === 'joinServer' && <JoinServerModal />}
      {modal === 'createChannel' && <CreateChannelModal />}
      {modal === 'settings' && <UserSettingsOverlay />}
      {modal === 'inviteServer' && <InviteModal />}
      {modal === 'serverSettings' && <ServerSettingsModal />}
    </Suspense>
  );
}

function AppLayout() {
  useWebSocketEvents();

  return (
    <>
      <div className='grid h-full grid-cols-[66px_minmax(0,1fr)] gap-1 overflow-hidden bg-transparent p-1'>
        <ServerSidebar />
        <div className='quarrel-shell flex min-w-0 overflow-hidden'>
          <Outlet />
        </div>
      </div>
      <ModalRenderer />
      <NotificationToast />
    </>
  );
}

function MobileAppLayout() {
  useWebSocketEvents();
  const currentChannelId = useVoiceStore(s => s.currentChannelId);

  return (
    <>
      <div className='flex h-full overflow-hidden bg-transparent p-1'>
        <MobileSidebar />
        <div
          className={`quarrel-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-[env(safe-area-inset-top)] ${
            currentChannelId ? 'pb-[112px]' : ''
          }`}
        >
          <Outlet />
        </div>
      </div>
      {currentChannelId && (
        <div className='pointer-events-none fixed inset-x-1 bottom-1 z-30 md:hidden'>
          <div className='pointer-events-auto overflow-hidden rounded-xl border border-bg-tertiary/70 bg-bg-tertiary/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-bg-tertiary/90'>
            <VoiceConnectionBar />
          </div>
        </div>
      )}
      <ModalRenderer />
      <NotificationToast />
    </>
  );
}

function DMAreaLayout() {
  return (
    <div className='flex min-h-0 h-full flex-1 min-w-0'>
      <DMSidebar />
      <div className='flex min-h-0 h-full min-w-0 flex-1 flex-col'>
        <Outlet />
      </div>
    </div>
  );
}

function ServerView() {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const showMemberList = useUIStore(s => s.showMemberList);
  const setActiveChannel = useUIStore(s => s.setActiveChannel);
  const { data: channels = [] } = useChannels(serverId);

  const activeChannel = useMemo(
    () => (channelId ? channels.find(c => c.id === channelId) : undefined),
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
      const first = channels.find(c => c.type === 'text');
      if (first)
        navigate(`/channels/${serverId}/${first.id}`, { replace: true });
    }
  }, [serverId, channelId, channels, navigate]);

  return (
    <div className='flex min-h-0 h-full flex-1 min-w-0'>
      <ChannelSidebar />
      <div className='flex min-h-0 h-full min-w-0 flex-1 flex-col'>
        {channelId ? (
          activeChannel?.type === 'voice' ? (
            <VoiceChannelView channelId={channelId} />
          ) : (
            <ChatArea channelId={channelId} serverId={serverId!} />
          )
        ) : (
          <div className='flex flex-1 flex-col items-center justify-center text-text-muted'>
            Select a channel
          </div>
        )}
      </div>
      {showMemberList && serverId && (
        <MemberList serverId={serverId} className='max-md:hidden' />
      )}
    </div>
  );
}

function MobileServerView() {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const setActiveChannel = useUIStore(s => s.setActiveChannel);
  const { data: channels = [] } = useChannels(serverId);

  const activeChannel = useMemo(
    () => (channelId ? channels.find(c => c.id === channelId) : undefined),
    [channels, channelId],
  );

  useEffect(() => {
    setActiveChannel(channelId ?? null);
    return () => setActiveChannel(null);
  }, [channelId, setActiveChannel]);

  useEffect(() => {
    if (serverId && !channelId && channels.length > 0) {
      const first = channels.find(c => c.type === 'text');
      if (first)
        navigate(`/channels/${serverId}/${first.id}`, { replace: true });
    }
  }, [serverId, channelId, channels, navigate]);

  if (!channelId) {
    if (channels.length > 0) {
      return (
        <div className='flex flex-1 items-center justify-center text-sm text-text-muted'>
          Opening channel...
        </div>
      );
    }

    return (
      <div className='flex flex-1 flex-col items-center justify-center text-text-muted'>
        Select a channel
      </div>
    );
  }

  if (activeChannel?.type === 'voice') {
    return <VoiceChannelView channelId={channelId} />;
  }

  return <ChatArea channelId={channelId} serverId={serverId!} />;
}

export default function App() {
  usePageView();
  useTauriExternalLinks();
  const isMobile = useIsMobile();
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const fetchUser = useAuthStore(s => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center bg-bg-primary'>
        <div className='h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-white' />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Routes>
        <Route
          path='/login'
          element={!user ? <LoginPage /> : <Navigate to='/channels/@me' />}
        />
        <Route
          path='/register'
          element={!user ? <RegisterPage /> : <Navigate to='/channels/@me' />}
        />
        <Route element={<ProtectedRoute />}>
          {isMobile ? (
            <Route element={<MobileAppLayout />}>
              <Route path='/channels/@me' element={<FriendsPage />} />
              <Route
                path='/channels/@me/:conversationId'
                element={<DMPage />}
              />
              <Route
                path='/channels/:serverId/:channelId?'
                element={<MobileServerView />}
              />
            </Route>
          ) : (
            <Route element={<AppLayout />}>
              <Route element={<DMAreaLayout />}>
                <Route path='/channels/@me' element={<FriendsPage />} />
                <Route
                  path='/channels/@me/:conversationId'
                  element={<DMPage />}
                />
              </Route>
              <Route
                path='/channels/:serverId/:channelId?'
                element={<ServerView />}
              />
            </Route>
          )}
        </Route>
        <Route
          path='*'
          element={<Navigate to={user ? '/channels/@me' : '/login'} replace />}
        />
      </Routes>
    </TooltipProvider>
  );
}
