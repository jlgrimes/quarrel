import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { Button } from '@/components/ui/button';

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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#949ba4] border-t-white" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-white">Appearance</h1>

      {success && (
        <div className="mb-3 rounded bg-green-500/10 p-2 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Theme */}
      <div className="mb-6">
        <h2 className="mb-3 text-xs font-bold uppercase text-[#b5bac1]">Theme</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme('dark')}
            className={`flex flex-1 flex-col items-center rounded-lg border-2 p-4 transition-colors ${
              theme === 'dark'
                ? 'border-[#5865f2] bg-[#1e1f22]'
                : 'border-transparent bg-[#1e1f22] hover:border-[#4e5058]'
            }`}
          >
            <div className="mb-2 h-12 w-12 rounded-lg bg-[#313338]" />
            <span className="text-sm font-medium text-white">Dark</span>
          </button>
          <button
            onClick={() => setTheme('light')}
            className={`flex flex-1 flex-col items-center rounded-lg border-2 p-4 transition-colors ${
              theme === 'light'
                ? 'border-[#5865f2] bg-[#1e1f22]'
                : 'border-transparent bg-[#1e1f22] hover:border-[#4e5058]'
            }`}
          >
            <div className="mb-2 h-12 w-12 rounded-lg bg-white" />
            <span className="text-sm font-medium text-white">Light</span>
          </button>
        </div>
      </div>

      {/* Font Size */}
      <div className="mb-6">
        <h2 className="mb-3 text-xs font-bold uppercase text-[#b5bac1]">Font Size</h2>
        <div className="flex gap-3">
          {(['small', 'normal', 'large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-center font-medium capitalize transition-colors ${
                fontSize === size
                  ? 'border-[#5865f2] bg-[#1e1f22] text-white'
                  : 'border-transparent bg-[#1e1f22] text-[#b5bac1] hover:border-[#4e5058]'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Mode */}
      <div className="mb-6">
        <div className="flex items-center justify-between rounded-lg bg-[#1e1f22] p-4">
          <div>
            <h3 className="text-sm font-medium text-white">Compact Mode</h3>
            <p className="text-xs text-[#949ba4]">
              Reduce spacing between messages for a denser layout
            </p>
          </div>
          <button
            role="switch"
            aria-checked={compactMode}
            onClick={() => setCompactMode(!compactMode)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              compactMode ? 'bg-[#5865f2]' : 'bg-[#4e5058]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                compactMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-[#5865f2] px-4 py-2 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
