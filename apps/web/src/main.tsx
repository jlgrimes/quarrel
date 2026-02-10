import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
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

const Router = import.meta.env.VITE_DESKTOP === 'true' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <App />
        </Router>
      </QueryClientProvider>
    </PostHogProvider>
  </StrictMode>
);
