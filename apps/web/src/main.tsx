import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
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

type BoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Unhandled render error', error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          background: '#111827',
          color: '#e5e7eb',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          padding: '24px',
          boxSizing: 'border-box',
          overflow: 'auto',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>
          Quarrel runtime error
        </h1>
        <p style={{ marginTop: 0, marginBottom: '8px', color: '#94a3b8' }}>
          The app hit an error instead of rendering this screen.
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {`${this.state.error.name}: ${this.state.error.message}\n\n${this.state.error.stack || ''}`}
        </pre>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <PostHogProvider client={posthog}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </PostHogProvider>
    </AppErrorBoundary>
  </StrictMode>
);
