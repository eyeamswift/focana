import { SITE_CONTACT_EMAIL } from '../data/site.ts';
import { sendLoopsEvent, type LoopsEventPayload } from './loops.ts';
import type {
  TestimonialAttribution,
  TestimonialFeature,
} from './testimonialService.ts';

const FEATURE_LABELS: Record<TestimonialFeature, string> = {
  always_visible: 'Always visible',
  gentle_checkins: 'Gentle check-ins',
  parking_lot: 'Parking Lot',
  session_history: 'Picking up where I left off',
  quick_start: 'Quick start',
  other: 'Something else',
};

const ATTRIBUTION_LABELS: Record<TestimonialAttribution, string> = {
  first_name: 'First name',
  first_last_initial: 'First name + last initial',
  anonymous: 'Anonymous',
};

type TestimonialNotificationInput = {
  testimonialId: string;
  accessVerified: boolean;
  attribution: TestimonialAttribution;
  selectedFeatures: TestimonialFeature[];
  submittedAt?: string;
};

export function buildTestimonialNotificationPayload(
  input: TestimonialNotificationInput
): LoopsEventPayload {
  return {
    email: SITE_CONTACT_EMAIL,
    eventName: 'testimonial_submitted',
    eventProperties: {
      testimonialId: input.testimonialId,
      accessStatus: input.accessVerified ? 'Verified user' : 'Unverified user',
      attribution: ATTRIBUTION_LABELS[input.attribution],
      selectedFeatures: input.selectedFeatures.map((feature) => FEATURE_LABELS[feature]).join(', '),
      submittedAt: input.submittedAt || new Date().toISOString(),
    },
  };
}

export async function notifyTestimonialSubmitted(
  loopsApiKey: string | undefined,
  input: TestimonialNotificationInput
) {
  await sendLoopsEvent(
    loopsApiKey,
    buildTestimonialNotificationPayload(input),
    { idempotencyKey: `testimonial-submitted-${input.testimonialId}` }
  );
}
