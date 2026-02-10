import { onCLS, onFID, onLCP, onTTFB, onINP } from 'web-vitals';
import { analytics } from './analytics';

function sendMetric(metric: { name: string; value: number; rating: string }) {
  analytics.capture('web_vital', {
    metric_name: metric.name,
    value: metric.value,
    rating: metric.rating,
  });
}

export function initWebVitals() {
  onCLS(sendMetric);
  onFID(sendMetric);
  onLCP(sendMetric);
  onTTFB(sendMetric);
  onINP(sendMetric);
}
