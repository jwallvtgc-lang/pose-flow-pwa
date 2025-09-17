import posthog from 'posthog-js';
import { env } from '@/config/env';

export const initPosthog = () => {
  const posthogKey = env.VITE_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      autocapture: false,
      capture_pageview: false,
    });
  }
};

export { posthog };