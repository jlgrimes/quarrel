import { analytics } from './analytics';

export function initErrorTracking() {
  window.addEventListener('error', (event) => {
    analytics.capture('$exception', {
      message: event.message,
      type: 'error',
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    analytics.capture('$exception', {
      message: event.reason?.message || String(event.reason),
      type: 'unhandledrejection',
      stack: event.reason?.stack,
    });
  });
}
