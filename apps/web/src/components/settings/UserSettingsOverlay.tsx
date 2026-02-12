import { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { analytics } from '../../lib/analytics';
import { MyAccountSection } from './sections/MyAccountSection';
import { ProfileSection } from './sections/ProfileSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { VoiceAudioSection } from './sections/VoiceAudioSection';
import { PrivacySection } from './sections/PrivacySection';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SECTIONS = [
  { id: 'account', label: 'My Account' },
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'voice', label: 'Voice & Audio' },
  { id: 'privacy', label: 'Privacy' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export default function UserSettingsOverlay() {
  const closeModal = useUIStore((s) => s.closeModal);
  const [activeSection, setActiveSection] = useState<SectionId>('account');

  const handleClose = useCallback(() => {
    closeModal();
    analytics.capture('settings:closed');
  }, [closeModal]);

  useEffect(() => {
    analytics.capture('settings:opened');
  }, []);

  const handleSectionChange = (id: SectionId) => {
    setActiveSection(id);
    analytics.capture('settings:section_changed', { section: id });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        data-testid='settings-overlay'
        className='h-[82vh] max-h-[780px] w-[calc(100vw-2rem)] sm:max-w-5xl overflow-hidden border-white/10 bg-bg-secondary p-0'
      >
        <DialogHeader className='sr-only'>
          <DialogTitle>Settings Dialog</DialogTitle>
          <DialogDescription>
            Manage account, profile, appearance, notifications, voice, and
            privacy settings.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          orientation='vertical'
          value={activeSection}
          onValueChange={(value) => handleSectionChange(value as SectionId)}
          className='h-full min-h-0 w-full flex-row gap-0'
        >
          <aside className='flex w-[240px] shrink-0 flex-col border-r border-white/10 bg-bg-tertiary/60 p-2'>
            <h2 className='mb-2 px-2.5 text-xs font-bold uppercase text-text-muted'>
              User Settings
            </h2>
            <TabsList
              className='h-auto w-full flex-col items-stretch bg-transparent p-0'
              variant='line'
            >
              {SECTIONS.map((section) => (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className='justify-start rounded-md px-2.5 py-2 text-left text-sm text-text-label data-[state=active]:bg-bg-modifier-active data-[state=active]:text-white hover:bg-bg-modifier-hover hover:text-text-normal'
                >
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </aside>

          <section className='relative min-h-0 min-w-0 flex-1 overflow-hidden'>
            <div className='h-full w-full overflow-y-auto px-6 py-6'>
              <TabsContent value='account'>
                <MyAccountSection />
              </TabsContent>
              <TabsContent value='profile'>
                <ProfileSection />
              </TabsContent>
              <TabsContent value='appearance'>
                <AppearanceSection />
              </TabsContent>
              <TabsContent value='notifications'>
                <NotificationsSection />
              </TabsContent>
              <TabsContent value='voice'>
                <VoiceAudioSection />
              </TabsContent>
              <TabsContent value='privacy'>
                <PrivacySection />
              </TabsContent>
            </div>
          </section>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
