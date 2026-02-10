import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../lib/analytics';

export function usePageView() {
  const location = useLocation();

  useEffect(() => {
    analytics.pageview(location.pathname);
  }, [location.pathname]);
}
