import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

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
        <div className="mb-3 rounded bg-brand/10 p-2 text-sm text-brand-light">
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
          <Switch
            checked={notificationsEnabled}
            onCheckedChange={setNotificationsEnabled}
            className="data-[state=checked]:bg-brand data-[state=unchecked]:bg-bg-neutral"
          />
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
          <Switch
            checked={notificationSounds}
            onCheckedChange={setNotificationSounds}
            className="data-[state=checked]:bg-brand data-[state=unchecked]:bg-bg-neutral"
          />
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
