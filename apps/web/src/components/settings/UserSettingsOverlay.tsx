import { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { analytics } from '../../lib/analytics';
import { MyAccountSection } from './sections/MyAccountSection';
import { ProfileSection } from './sections/ProfileSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { VoiceAudioSection } from './sections/VoiceAudioSection';
import { PrivacySection } from './sections/PrivacySection';

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const handleSectionChange = (id: SectionId) => {
    setActiveSection(id);
    analytics.capture('settings:section_changed', { section: id });
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-bg-primary" data-testid="settings-overlay">
      {/* Left sidebar */}
      <div className="flex w-[218px] shrink-0 flex-col bg-bg-secondary overflow-y-auto">
        <div className="flex flex-1 flex-col justify-start p-2 pt-16">
          <h2 className="mb-1 px-2.5 text-xs font-bold uppercase text-text-muted">
            User Settings
          </h2>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => handleSectionChange(section.id)}
              className={`mb-0.5 w-full rounded px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-bg-modifier-active text-white'
                  : 'text-text-label hover:bg-bg-modifier-hover hover:text-text-normal'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[740px] px-10 py-16">
          {activeSection === 'account' && <MyAccountSection />}
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'appearance' && <AppearanceSection />}
          {activeSection === 'notifications' && <NotificationsSection />}
          {activeSection === 'voice' && <VoiceAudioSection />}
          {activeSection === 'privacy' && <PrivacySection />}
        </div>
      </div>

      {/* Close button */}
      <div className="flex shrink-0 flex-col items-center pt-16 pr-5">
        <button
          onClick={handleClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-text-label text-text-label transition-colors hover:border-white hover:text-white"
          aria-label="Close settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="mt-1 text-xs text-text-muted">ESC</span>
      </div>
    </div>
  );
}
