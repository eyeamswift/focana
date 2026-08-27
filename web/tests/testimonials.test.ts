import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  normalizeTestimonialSubmission,
  resolveTestimonialEligibility,
  saveTestimonial,
  TestimonialValidationError,
  type TestimonialConsentEventInsert,
  type TestimonialEligibility,
  type TestimonialInsert,
  type TestimonialStore,
  type TestimonialSubmissionInput,
} from '../src/lib/testimonialService.ts';

class MemoryTestimonialStore implements TestimonialStore {
  customers = new Map<string, { id: string; email: string }>();
  friendsAndFamily = new Map<string, { id: string; claimed_email: string }>();
  betaDownloads = new Map<string, { id: string; email: string }>();
  testimonials: Array<TestimonialInsert & { id: string }> = [];
  consentEvents: TestimonialConsentEventInsert[] = [];
  failConsentInsert = false;
  deletedIds: string[] = [];

  async findCustomerByEmail(email: string) {
    return this.customers.get(email) || null;
  }

  async findClaimedFriendsAndFamilyByEmail(email: string) {
    return this.friendsAndFamily.get(email) || null;
  }

  async findBetaDownloadByEmail(email: string) {
    return this.betaDownloads.get(email) || null;
  }

  async insertTestimonial(input: TestimonialInsert) {
    const row = { ...structuredClone(input), id: `testimonial-${this.testimonials.length + 1}` };
    this.testimonials.push(row);
    return { id: row.id };
  }

  async insertConsentEvent(input: TestimonialConsentEventInsert) {
    if (this.failConsentInsert) throw new Error('consent insert failed');
    this.consentEvents.push(structuredClone(input));
  }

  async deleteTestimonial(id: string) {
    this.deletedIds.push(id);
    this.testimonials = this.testimonials.filter((row) => row.id !== id);
  }
}

const customerEligibility: TestimonialEligibility = {
  eligible: true,
  email: 'nylobie@example.com',
  source: 'customer',
  sourceId: 'customer-1',
  customerId: 'customer-1',
};

function submission(
  overrides: Partial<TestimonialSubmissionInput> = {}
): TestimonialSubmissionInput {
  return {
    email: 'nylobie@example.com',
    firstName: 'Nylobie',
    lastName: '',
    attribution: 'first_name',
    selectedFeatures: ['always_visible'],
    otherFeature: '',
    featureStory:
      'I normally lose the task when I switch apps. Keeping it visible helped me return right away.',
    recommendationQuote: 'It makes returning to the task much easier.',
    consentShare: true,
    ...overrides,
  };
}

function assertValidationError(
  callback: () => unknown,
  expectedField: string
) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof TestimonialValidationError);
    assert.equal(error.field, expectedField);
    return true;
  });
}

test('eligibility normalizes email and prefers a customer match', async () => {
  const store = new MemoryTestimonialStore();
  store.customers.set('nylobie@example.com', {
    id: 'customer-1',
    email: 'nylobie@example.com',
  });
  store.betaDownloads.set('nylobie@example.com', {
    id: 'beta-1',
    email: 'nylobie@example.com',
  });

  const result = await resolveTestimonialEligibility(' Nylobie@Example.com ', store);

  assert.deepEqual(result, customerEligibility);
});

test('eligibility accepts claimed friends-and-family and beta access', async () => {
  const friendsStore = new MemoryTestimonialStore();
  friendsStore.friendsAndFamily.set('friend@example.com', {
    id: 'invite-1',
    claimed_email: 'friend@example.com',
  });

  assert.deepEqual(
    await resolveTestimonialEligibility('friend@example.com', friendsStore),
    {
      eligible: true,
      email: 'friend@example.com',
      source: 'friends_family',
      sourceId: 'invite-1',
      customerId: null,
    }
  );

  const betaStore = new MemoryTestimonialStore();
  betaStore.betaDownloads.set('beta@example.com', {
    id: 'beta-1',
    email: 'beta@example.com',
  });

  assert.deepEqual(await resolveTestimonialEligibility('beta@example.com', betaStore), {
    eligible: true,
    email: 'beta@example.com',
    source: 'beta',
    sourceId: 'beta-1',
    customerId: null,
  });
});

test('eligibility rejects invalid and unmatched emails', async () => {
  const store = new MemoryTestimonialStore();
  assert.equal(await resolveTestimonialEligibility('not-an-email', store), null);
  assert.equal(await resolveTestimonialEligibility('missing@example.com', store), null);
});

test('normalization preserves one or two feature choices and broad sharing consent', () => {
  const submittedAt = '2026-08-27T17:00:00.000Z';
  const result = normalizeTestimonialSubmission(
    submission({
      firstName: '  Nylobie  ',
      selectedFeatures: ['always_visible', 'gentle_checkins'],
    }),
    customerEligibility,
    submittedAt
  );

  assert.equal(result.first_name, 'Nylobie');
  assert.deepEqual(result.selected_features, ['always_visible', 'gentle_checkins']);
  assert.equal(result.consent_website, true);
  assert.equal(result.consent_social, true);
  assert.equal(result.consent_launch_materials, true);
  assert.equal(result.editing_consent, false);
  assert.equal(result.submitted_email, 'nylobie@example.com');
  assert.equal(result.verified_email, 'nylobie@example.com');
  assert.equal(result.access_verified, true);
  assert.equal(result.status, 'pending');
  assert.equal(result.consented_at, submittedAt);
});

test('normalization rejects more than two features and missing Other detail', () => {
  assertValidationError(
    () => normalizeTestimonialSubmission(
      submission({ selectedFeatures: ['always_visible', 'gentle_checkins', 'parking_lot'] }),
      customerEligibility
    ),
    'selectedFeatures'
  );

  assertValidationError(
    () => normalizeTestimonialSubmission(
      submission({ selectedFeatures: ['other'], otherFeature: '' }),
      customerEligibility
    ),
    'otherFeature'
  );
});

test('normalization rejects incomplete attribution or publishing permission', () => {
  assertValidationError(
    () => normalizeTestimonialSubmission(
      submission({ attribution: 'first_last_initial', lastName: '' }),
      customerEligibility
    ),
    'lastName'
  );

  assertValidationError(
    () => normalizeTestimonialSubmission(
      submission({ consentShare: false }),
      customerEligibility
    ),
    'publishingConsent'
  );
});

test('normalization accepts an unmatched email as unverified', () => {
  const unmatchedEmail = normalizeTestimonialSubmission(
    submission({ email: ' NewUser@Example.com ' }),
    null
  );
  assert.equal(unmatchedEmail.submitted_email, 'newuser@example.com');
  assert.equal(unmatchedEmail.verified_email, null);
  assert.equal(unmatchedEmail.access_verified, false);
});

test('normalization requires a valid email', () => {
  assertValidationError(
    () => normalizeTestimonialSubmission(submission({ email: '' }), null),
    'email'
  );

  assertValidationError(
    () => normalizeTestimonialSubmission(submission({ email: 'not-an-email' }), null),
    'email'
  );
});

test('anonymous attribution does not require a name', () => {
  const result = normalizeTestimonialSubmission(
    submission({ attribution: 'anonymous', firstName: '', lastName: '' }),
    customerEligibility
  );

  assert.equal(result.first_name, 'Anonymous');
  assert.equal(result.last_name, null);
});

test('normalization does not apply verification from a different email', () => {
  const result = normalizeTestimonialSubmission(
    submission({ email: 'someone-else@example.com' }),
    customerEligibility
  );

  assert.equal(result.submitted_email, 'someone-else@example.com');
  assert.equal(result.verified_email, null);
  assert.equal(result.customer_id, null);
  assert.equal(result.access_verified, false);
});

test('saving a verified testimonial writes the pending story and consent history', async () => {
  const store = new MemoryTestimonialStore();
  const submittedAt = '2026-08-27T17:00:00.000Z';

  const result = await saveTestimonial(
    submission(),
    customerEligibility,
    store,
    submittedAt
  );

  assert.equal(result.id, 'testimonial-1');
  assert.equal(store.testimonials[0].status, 'pending');
  assert.equal(store.testimonials[0].verified_email, 'nylobie@example.com');
  assert.deepEqual(store.consentEvents[0], {
    testimonial_id: 'testimonial-1',
    event_type: 'granted',
    consent_version: '2026-08-27',
    consent_website: true,
    consent_social: true,
    consent_launch_materials: true,
    editing_consent: false,
    created_at: submittedAt,
  });
});

test('saving an unmatched testimonial still writes the story and consent history', async () => {
  const store = new MemoryTestimonialStore();

  const result = await saveTestimonial(
    submission({ email: 'unmatched@example.com' }),
    null,
    store
  );

  assert.equal(result.id, 'testimonial-1');
  assert.equal(store.testimonials[0].access_verified, false);
  assert.equal(store.testimonials[0].submitted_email, 'unmatched@example.com');
  assert.equal(store.testimonials[0].verified_email, null);
  assert.equal(store.consentEvents.length, 1);
});

test('saving removes the testimonial if its consent history cannot be recorded', async () => {
  const store = new MemoryTestimonialStore();
  store.failConsentInsert = true;

  await assert.rejects(
    saveTestimonial(submission(), customerEligibility, store),
    /consent insert failed/
  );

  assert.deepEqual(store.deletedIds, ['testimonial-1']);
  assert.equal(store.testimonials.length, 0);
});

test('testimonial migration defaults to manual review and preserves consent history', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/011_testimonials.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /create table if not exists public\.testimonials/i);
  assert.match(migration, /status text not null default 'pending'/i);
  assert.match(migration, /check \(consent_website or consent_social or consent_launch_materials\)/i);
  assert.match(migration, /create table if not exists public\.testimonial_consent_events/i);
  assert.match(migration, /alter table public\.testimonials enable row level security/i);
  assert.match(migration, /alter table public\.testimonial_consent_events enable row level security/i);

  const optionalVerificationMigration = await readFile(
    new URL('../supabase/migrations/012_optional_testimonial_verification.sql', import.meta.url),
    'utf8'
  );
  assert.match(optionalVerificationMigration, /add column if not exists submitted_email text null/i);
  assert.match(optionalVerificationMigration, /add column if not exists access_verified boolean not null default false/i);
  assert.match(optionalVerificationMigration, /alter column verification_source drop not null/i);
  assert.match(optionalVerificationMigration, /alter column verification_source_id drop not null/i);
  assert.match(optionalVerificationMigration, /alter column verified_email drop not null/i);
});
