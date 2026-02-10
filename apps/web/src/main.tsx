import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { PostHogProvider } from 'posthog-js/react';
import { queryClient } from './lib/queryClient';
import { initAnalytics, posthog } from './lib/analytics';
import { initErrorTracking } from './lib/errorTracking';
import { initWebVitals } from './lib/webVitals';
import App from './App';
import './index.css';

initAnalytics();
initErrorTracking();
initWebVitals();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </PostHogProvider>
  </StrictMode>
);
