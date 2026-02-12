import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export function AppearanceSection() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>('normal');
  const [compactMode, setCompactMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getSettings().then((settings) => {
      setTheme(settings.theme || 'dark');
      setFontSize(settings.fontSize || 'normal');
      setCompactMode(settings.compactMode || false);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    try {
      await api.updateSettings({ theme, fontSize, compactMode });
      setSuccess('Appearance settings saved');
      analytics.capture('settings:appearance_updated', { theme, fontSize, compactMode });
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
      <h1 className="mb-5 text-xl font-bold text-white">Appearance</h1>

      {success && (
        <div className="mb-3 rounded bg-brand/10 p-2 text-sm text-brand-light">
          {success}
        </div>
      )}

      {/* Theme */}
      <div className="mb-6">
        <h2 className="mb-3 text-xs font-bold uppercase text-text-label">Theme</h2>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => setTheme('dark')}
            className={`flex flex-1 flex-col items-center rounded-lg border-2 p-4 transition-colors ${
              theme === 'dark'
                ? 'border-brand bg-bg-tertiary'
                : 'border-transparent bg-bg-tertiary hover:border-bg-neutral'
            }`}
          >
            <div className="mb-2 h-12 w-12 rounded-lg bg-bg-primary" />
            <span className="text-sm font-medium text-white">Dark</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setTheme('light')}
            className={`flex flex-1 flex-col items-center rounded-lg border-2 p-4 transition-colors ${
              theme === 'light'
                ? 'border-brand bg-bg-tertiary'
                : 'border-transparent bg-bg-tertiary hover:border-bg-neutral'
            }`}
          >
            <div className="mb-2 h-12 w-12 rounded-lg bg-white" />
            <span className="text-sm font-medium text-white">Light</span>
          </Button>
        </div>
      </div>

      {/* Font Size */}
      <div className="mb-6">
        <h2 className="mb-3 text-xs font-bold uppercase text-text-label">Font Size</h2>
        <div className="flex gap-3">
          {(['small', 'normal', 'large'] as const).map((size) => (
            <Button
              key={size}
              variant="ghost"
              onClick={() => setFontSize(size)}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-center font-medium capitalize transition-colors ${
                fontSize === size
                  ? 'border-brand bg-bg-tertiary text-white'
                  : 'border-transparent bg-bg-tertiary text-text-label hover:border-bg-neutral'
              }`}
            >
              {size}
            </Button>
          ))}
        </div>
      </div>

      {/* Compact Mode */}
      <div className="mb-6">
        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary p-4">
          <div>
            <h3 className="text-sm font-medium text-white">Compact Mode</h3>
            <p className="text-xs text-text-muted">
              Reduce spacing between messages for a denser layout
            </p>
          </div>
          <Switch
            checked={compactMode}
            onCheckedChange={setCompactMode}
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
