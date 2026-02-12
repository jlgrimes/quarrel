import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { Button } from '@/components/ui/button';

export function NotificationsSection() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationSounds, setNotificationSounds] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getSettings().then((settings) => {
      setNotificationsEnabled(settings.notificationsEnabled ?? true);
      setNotificationSounds(settings.notificationSounds ?? true);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    try {
      await api.updateSettings({ notificationsEnabled, notificationSounds });
      setSuccess('Notification settings saved');
      analytics.capture('settings:notifications_updated', {
        notificationsEnabled,
        notificationSounds,
      });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-white" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-white">Notifications</h1>

      {success && (
        <div className="mb-3 rounded bg-green-500/10 p-2 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Enable Notifications */}
      <div className="mb-4">
        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary p-4">
          <div>
            <h3 className="text-sm font-medium text-white">Enable Notifications</h3>
            <p className="text-xs text-text-muted">
              Receive notifications for new messages and events
            </p>
          </div>
          <button
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              notificationsEnabled ? 'bg-brand' : 'bg-bg-neutral'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notification Sounds */}
      <div className="mb-6">
        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary p-4">
          <div>
            <h3 className="text-sm font-medium text-white">Notification Sounds</h3>
            <p className="text-xs text-text-muted">
              Play a sound when a notification arrives
            </p>
          </div>
          <button
            role="switch"
            aria-checked={notificationSounds}
            onClick={() => setNotificationSounds(!notificationSounds)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              notificationSounds ? 'bg-brand' : 'bg-bg-neutral'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                notificationSounds ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
