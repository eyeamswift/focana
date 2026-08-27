import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTestimonialNotificationPayload } from '../src/lib/testimonialNotification.ts';

test('testimonial notification contains review metadata without submitter content or email', () => {
  const payload = buildTestimonialNotificationPayload({
    testimonialId: 'testimonial-123',
    accessVerified: true,
    attribution: 'first_last_initial',
    selectedFeatures: ['always_visible', 'parking_lot'],
    submittedAt: '2026-08-27T19:30:00.000Z',
  });

  assert.deepEqual(payload, {
    email: 'hello@focana.app',
    eventName: 'testimonial_submitted',
    eventProperties: {
      testimonialId: 'testimonial-123',
      accessStatus: 'Verified user',
      attribution: 'First name + last initial',
      selectedFeatures: 'Always visible, Parking Lot',
      submittedAt: '2026-08-27T19:30:00.000Z',
    },
  });

  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /featureStory|recommendationQuote|submittedEmail/i);
});

test('testimonial notification marks unmatched submissions unverified', () => {
  const payload = buildTestimonialNotificationPayload({
    testimonialId: 'testimonial-456',
    accessVerified: false,
    attribution: 'anonymous',
    selectedFeatures: ['other'],
    submittedAt: '2026-08-27T19:31:00.000Z',
  });

  assert.deepEqual(payload.eventProperties, {
    testimonialId: 'testimonial-456',
    accessStatus: 'Unverified user',
    attribution: 'Anonymous',
    selectedFeatures: 'Something else',
    submittedAt: '2026-08-27T19:31:00.000Z',
  });
});
