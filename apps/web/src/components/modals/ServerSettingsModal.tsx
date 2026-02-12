import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useUIStore } from '../../stores/uiStore';
import { analytics } from '../../lib/analytics';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PROVIDER_MODELS: Record<string, { label: string; value: string }[]> = {
  anthropic: [
    { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250929' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
  ],
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
    { label: 'o3', value: 'o3' },
    { label: 'o4-mini', value: 'o4-mini' },
  ],
  google: [
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro-preview-06-05' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash-preview-05-20' },
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'ChatGPT (OpenAI)',
  google: 'Gemini (Google)',
};

export default function ServerSettingsModal() {
  const { serverId } = useParams();
  const closeModal = useUIStore((s) => s.closeModal);
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add bot form
  const [showAddForm, setShowAddForm] = useState(false);
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState(PROVIDER_MODELS.anthropic[0].value);
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    if (!serverId) return;
    try {
      const result = await api.getBots(serverId);
      setBots(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const handleProviderChange = (p: string) => {
    setProvider(p);
    setModel(PROVIDER_MODELS[p]?.[0]?.value ?? '');
  };

  const handleAddBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.addBot(serverId, {
        provider,
        model,
        apiKey,
        systemPrompt: systemPrompt || undefined,
      });
      analytics.capture('bot:added', { serverId, provider });
      setShowAddForm(false);
      setApiKey('');
      setSystemPrompt('');
      fetchBots();
    } catch (err: any) {
      setError(err.message || 'Failed to add AI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (bot: any) => {
    if (!serverId) return;
    try {
      await api.updateBot(serverId, bot.id, { enabled: !bot.enabled });
      fetchBots();
    } catch {
      // ignore
    }
  };

  const handleRemove = async (bot: any) => {
    if (!serverId) return;
    try {
      await api.removeBot(serverId, bot.id);
      analytics.capture('bot:removed', { serverId, provider: bot.provider });
      fetchBots();
    } catch {
      // ignore
    }
  };

  if (!serverId) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) closeModal(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col" showCloseButton>
        <DialogHeader>
          <DialogTitle>Server Settings</DialogTitle>
          <DialogDescription>Manage your server configuration and AI assistants.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="bots" className="flex-1 min-h-0">
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bots">AI</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="py-4">
            <p className="text-sm text-muted-foreground">Server overview settings coming soon.</p>
          </TabsContent>

          <TabsContent value="bots" className="py-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">AI Assistants</h3>
              <Button
                size="sm"
                variant={showAddForm ? 'outline' : 'default'}
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? 'Cancel' : 'Add AI'}
              </Button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddBot} className="rounded-lg border p-4 space-y-4">
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={handleProviderChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">{PROVIDER_LABELS.anthropic}</SelectItem>
                      <SelectItem value="openai">{PROVIDER_LABELS.openai}</SelectItem>
                      <SelectItem value="google">{PROVIDER_LABELS.google}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_MODELS[provider]?.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your API key"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>System Prompt (Optional)</Label>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Custom personality for the AI..."
                    maxLength={2000}
                    rows={3}
                  />
                </div>

                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add AI'}
                </Button>
              </form>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : bots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No AI configured. Add an AI to get started!
              </p>
            ) : (
              <div className="space-y-2">
                {bots.map((bot) => (
                  <div
                    key={bot.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                        {bot.botUser?.displayName?.[0] ?? '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {bot.botUser?.displayName ?? bot.provider}
                          </span>
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold bg-primary text-primary-foreground leading-none">
                            AI
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {PROVIDER_LABELS[bot.provider] ?? bot.provider} &middot; {bot.model}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={bot.enabled}
                        onCheckedChange={() => handleToggle(bot)}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemove(bot)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
