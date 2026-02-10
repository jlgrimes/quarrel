import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

export function initAnalytics() {
  if (!POSTHOG_KEY) {
    console.warn('[analytics] VITE_POSTHOG_KEY not set, analytics disabled');
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false, // we handle manually
    capture_pageleave: true,
  });
}

export const analytics = {
  identify(userId: string, traits?: Record<string, unknown>) {
    if (!POSTHOG_KEY) return;
    posthog.identify(userId, traits);
  },
  reset() {
    if (!POSTHOG_KEY) return;
    posthog.reset();
  },
  capture(event: string, properties?: Record<string, unknown>) {
    if (!POSTHOG_KEY) return;
    posthog.capture(event, properties);
  },
  pageview(path: string) {
    if (!POSTHOG_KEY) return;
    posthog.capture('$pageview', { path });
  },
};

export { posthog };
