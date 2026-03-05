import posthog from 'posthog-js';

let analyticsDisabled = false;

export const track = (event, properties) => {
  if (analyticsDisabled) return;
  try {
    if (typeof posthog?.capture !== 'function') return;
    posthog.capture(event, properties);
  } catch (error) {
    analyticsDisabled = true;
    console.warn('Analytics capture disabled after PostHog error:', error);
  }
};
