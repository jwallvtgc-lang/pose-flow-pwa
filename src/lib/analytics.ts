import posthog from 'posthog-js';
import { env } from '@/config/env';

export const initPosthog = () => {
  // Use the PostHog key from environment
  const posthogKey = env.VITE_POSTHOG_KEY;
  const posthogHost = 'https://us.i.posthog.com';
  
  if (posthogKey && posthogKey !== 'phc_BixHVyV1mfTIN1iXZyZOPALco4AYFIEtd64dRRcGU5d') {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      autocapture: false,
      capture_pageview: false,
    });
  }
};

// Baseball swing analysis events
export const trackCapture = {
  started: () => posthog.capture('capture_started'),
  poseOk: () => posthog.capture('pose_ok'),
  scoreReady: () => posthog.capture('score_ready'),
  drillShown: () => posthog.capture('drill_shown'),
  videoUploaded: (bytes?: number) => posthog.capture('video_uploaded', { bytes }),
  swingSaved: (score?: number) => posthog.capture('swing_saved', { score }),
  progressViewed: (count: number) => posthog.capture('progress_viewed', { count }),
  swingDetailViewed: (swing_id: string) => posthog.capture('swing_detail_viewed', { swing_id }),
};

export { posthog };