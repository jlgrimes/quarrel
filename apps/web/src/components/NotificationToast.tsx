import { useNotificationStore, type Toast } from '../stores/notificationStore';
import { useNavigate } from 'react-router-dom';

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (toast.serverId && toast.channelId) {
      navigate(`/channels/${toast.serverId}/${toast.channelId}`);
    } else if (toast.channelId) {
      navigate(`/channels/@me/${toast.channelId}`);
    }
    onDismiss(toast.id);
  };

  return (
    <div
      role="alert"
      onClick={handleClick}
      className="flex items-start gap-3 rounded-lg bg-bg-secondary p-3 shadow-lg border border-bg-tertiary cursor-pointer hover:bg-bg-modifier-hover transition-colors animate-in slide-in-from-right-full duration-300"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{toast.title}</p>
        <p className="text-xs text-text-label truncate">{toast.body}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="shrink-0 text-text-muted hover:text-white transition-colors"
        aria-label="Dismiss notification"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.4 4L12 10.4 5.6 4 4 5.6 10.4 12 4 18.4 5.6 20 12 13.6 18.4 20 20 18.4 13.6 12 20 5.6z" />
        </svg>
      </button>
    </div>
  );
}

export default function NotificationToast() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80" data-testid="notification-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
