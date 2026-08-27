import { isValidEmail, normalizeEmail } from './emailCapture.ts';

export const TESTIMONIAL_CONSENT_VERSION = '2026-08-27';

export const TESTIMONIAL_FEATURES = [
  'always_visible',
  'gentle_checkins',
  'parking_lot',
  'session_history',
  'quick_start',
  'other',
] as const;

export const TESTIMONIAL_ATTRIBUTIONS = [
  'first_name',
  'first_last_initial',
  'anonymous',
] as const;

export type TestimonialFeature = (typeof TESTIMONIAL_FEATURES)[number];
export type TestimonialAttribution = (typeof TESTIMONIAL_ATTRIBUTIONS)[number];
export type TestimonialVerificationSource = 'customer' | 'beta' | 'friends_family';

export type TestimonialEligibility = {
  eligible: true;
  email: string;
  source: TestimonialVerificationSource;
  sourceId: string;
  customerId: string | null;
};

type CustomerAccessRow = {
  id: string;
  email: string | null;
};

type BetaAccessRow = {
  id: string;
  email: string;
};

type FriendsAndFamilyAccessRow = {
  id: string;
  claimed_email: string | null;
};

export type TestimonialSubmissionInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  attribution: TestimonialAttribution;
  selectedFeatures: TestimonialFeature[];
  otherFeature?: string | null;
  featureStory: string;
  recommendationQuote?: string | null;
  consentShare: boolean;
};

export type TestimonialInsert = {
  customer_id: string | null;
  verification_source: TestimonialVerificationSource | null;
  verification_source_id: string | null;
  submitted_email: string | null;
  verified_email: string | null;
  access_verified: boolean;
  first_name: string;
  last_name: string | null;
  attribution_preference: TestimonialAttribution;
  selected_features: TestimonialFeature[];
  other_feature: string | null;
  feature_story: string;
  recommendation_quote: string | null;
  consent_website: boolean;
  consent_social: boolean;
  consent_launch_materials: boolean;
  editing_consent: boolean;
  consent_version: string;
  consented_at: string;
  status: 'pending';
};

export type TestimonialConsentEventInsert = {
  testimonial_id: string;
  event_type: 'granted';
  consent_version: string;
  consent_website: boolean;
  consent_social: boolean;
  consent_launch_materials: boolean;
  editing_consent: boolean;
  created_at: string;
};

export interface TestimonialStore {
  findCustomerByEmail(email: string): Promise<CustomerAccessRow | null>;
  findClaimedFriendsAndFamilyByEmail(email: string): Promise<FriendsAndFamilyAccessRow | null>;
  findBetaDownloadByEmail(email: string): Promise<BetaAccessRow | null>;
  insertTestimonial(input: TestimonialInsert): Promise<{ id: string }>;
  insertConsentEvent(input: TestimonialConsentEventInsert): Promise<void>;
  deleteTestimonial(id: string): Promise<void>;
}

export class TestimonialValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'TestimonialValidationError';
    this.field = field;
  }
}

function trimText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function assertLength(field: string, value: string, minimum: number, message: string) {
  if (value.length < minimum) {
    throw new TestimonialValidationError(field, message);
  }
}

function assertMaxLength(field: string, value: string | null, maximum: number, message: string) {
  if (value && value.length > maximum) {
    throw new TestimonialValidationError(field, message);
  }
}

function isTestimonialFeature(value: unknown): value is TestimonialFeature {
  return TESTIMONIAL_FEATURES.includes(value as TestimonialFeature);
}

function isTestimonialAttribution(value: unknown): value is TestimonialAttribution {
  return TESTIMONIAL_ATTRIBUTIONS.includes(value as TestimonialAttribution);
}

export async function resolveTestimonialEligibility(
  rawEmail: string,
  store: TestimonialStore
): Promise<TestimonialEligibility | null> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return null;

  const customer = await store.findCustomerByEmail(email);
  if (customer) {
    return {
      eligible: true,
      email,
      source: 'customer',
      sourceId: customer.id,
      customerId: customer.id,
    };
  }

  const friendsAndFamily = await store.findClaimedFriendsAndFamilyByEmail(email);
  if (friendsAndFamily) {
    return {
      eligible: true,
      email,
      source: 'friends_family',
      sourceId: friendsAndFamily.id,
      customerId: null,
    };
  }

  const beta = await store.findBetaDownloadByEmail(email);
  if (beta) {
    return {
      eligible: true,
      email,
      source: 'beta',
      sourceId: beta.id,
      customerId: null,
    };
  }

  return null;
}

export function normalizeTestimonialSubmission(
  raw: TestimonialSubmissionInput,
  eligibility: TestimonialEligibility | null,
  submittedAt = new Date().toISOString()
): TestimonialInsert {
  const email = normalizeEmail(trimText(raw.email));
  const firstName = trimText(raw.firstName);
  const lastName = trimText(raw.lastName) || null;
  const featureStory = trimText(raw.featureStory);
  const recommendationQuote = trimText(raw.recommendationQuote) || null;
  const otherFeature = trimText(raw.otherFeature) || null;
  const verifiedEligibility = eligibility?.email === email ? eligibility : null;

  if (!isValidEmail(email)) {
    throw new TestimonialValidationError(
      'email',
      'Please enter a valid email.'
    );
  }

  if (!isTestimonialAttribution(raw.attribution)) {
    throw new TestimonialValidationError(
      'attribution',
      'Please choose how you would like to be credited.'
    );
  }

  if (raw.attribution !== 'anonymous') {
    assertLength('firstName', firstName, 1, 'Please enter your first name.');
  }
  assertLength(
    'featureStory',
    featureStory,
    20,
    'Please share a little more about how Focana helped.'
  );
  assertMaxLength('firstName', firstName, 80, 'Please keep your first name under 80 characters.');
  assertMaxLength('lastName', lastName, 80, 'Please keep your last name under 80 characters.');
  assertMaxLength('featureStory', featureStory, 4000, 'Please keep your story under 4,000 characters.');
  assertMaxLength(
    'recommendationQuote',
    recommendationQuote,
    2000,
    'Please keep this answer under 2,000 characters.'
  );
  assertMaxLength('otherFeature', otherFeature, 160, 'Please keep this answer under 160 characters.');

  if (raw.attribution === 'first_last_initial' && !lastName) {
    throw new TestimonialValidationError(
      'lastName',
      'Please add your last name so we can use its initial.'
    );
  }

  const selectedFeatures = Array.from(
    new Set(Array.isArray(raw.selectedFeatures) ? raw.selectedFeatures : [])
  );
  if (
    selectedFeatures.length < 1 ||
    selectedFeatures.length > 2 ||
    selectedFeatures.some((feature) => !isTestimonialFeature(feature))
  ) {
    throw new TestimonialValidationError(
      'selectedFeatures',
      'Please choose one or two Focana features.'
    );
  }

  if (selectedFeatures.includes('other') && !otherFeature) {
    throw new TestimonialValidationError(
      'otherFeature',
      'Please tell us which other part of Focana helped.'
    );
  }

  if (raw.consentShare !== true) {
    throw new TestimonialValidationError(
      'publishingConsent',
      'Please confirm that Focana may share your testimonial.'
    );
  }

  return {
    customer_id: verifiedEligibility?.customerId || null,
    verification_source: verifiedEligibility?.source || null,
    verification_source_id: verifiedEligibility?.sourceId || null,
    submitted_email: email || null,
    verified_email: verifiedEligibility?.email || null,
    access_verified: verifiedEligibility !== null,
    first_name: raw.attribution === 'anonymous' ? 'Anonymous' : firstName,
    last_name: raw.attribution === 'first_last_initial' ? lastName : null,
    attribution_preference: raw.attribution,
    selected_features: selectedFeatures,
    other_feature: selectedFeatures.includes('other') ? otherFeature : null,
    feature_story: featureStory,
    recommendation_quote: recommendationQuote,
    consent_website: true,
    consent_social: true,
    consent_launch_materials: true,
    editing_consent: false,
    consent_version: TESTIMONIAL_CONSENT_VERSION,
    consented_at: submittedAt,
    status: 'pending',
  };
}

export async function saveTestimonial(
  raw: TestimonialSubmissionInput,
  eligibility: TestimonialEligibility | null,
  store: TestimonialStore,
  submittedAt = new Date().toISOString()
) {
  const insert = normalizeTestimonialSubmission(raw, eligibility, submittedAt);
  const testimonial = await store.insertTestimonial(insert);

  try {
    await store.insertConsentEvent({
      testimonial_id: testimonial.id,
      event_type: 'granted',
      consent_version: insert.consent_version,
      consent_website: insert.consent_website,
      consent_social: insert.consent_social,
      consent_launch_materials: insert.consent_launch_materials,
      editing_consent: insert.editing_consent,
      created_at: insert.consented_at,
    });
  } catch (error) {
    await store.deleteTestimonial(testimonial.id).catch(() => undefined);
    throw error;
  }

  return testimonial;
}

function buildSupabaseHeaders(serviceKey: string, extra: Record<string, string> = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

async function readRows<T>(response: Response, context: string): Promise<T[]> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${context} failed with status ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export function createSupabaseTestimonialStore({
  supabaseUrl,
  supabaseServiceKey,
  fetchImpl = fetch,
}: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  fetchImpl?: typeof fetch;
}): TestimonialStore {
  async function findByEmail<T>({
    table,
    emailColumn,
    email,
    select,
    extraFilters = {},
  }: {
    table: string;
    emailColumn: string;
    email: string;
    select: string;
    extraFilters?: Record<string, string>;
  }) {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    url.searchParams.set(emailColumn, `ilike.${email}`);
    url.searchParams.set('limit', '1');
    for (const [key, value] of Object.entries(extraFilters)) {
      url.searchParams.set(key, value);
    }

    const rows = await readRows<T>(
      await fetchImpl(url, {
        headers: buildSupabaseHeaders(supabaseServiceKey),
      }),
      `${table} lookup`
    );

    return rows[0] || null;
  }

  return {
    findCustomerByEmail(email) {
      return findByEmail<CustomerAccessRow>({
        table: 'customers',
        emailColumn: 'email',
        email,
        select: 'id,email',
        extraFilters: { refunded_at: 'is.null', order: 'created_at.desc' },
      });
    },

    findClaimedFriendsAndFamilyByEmail(email) {
      return findByEmail<FriendsAndFamilyAccessRow>({
        table: 'friends_and_family_invites',
        emailColumn: 'claimed_email',
        email,
        select: 'id,claimed_email',
        extraFilters: { status: 'eq.claimed', order: 'claimed_at.desc' },
      });
    },

    findBetaDownloadByEmail(email) {
      return findByEmail<BetaAccessRow>({
        table: 'Beta_Downloads',
        emailColumn: 'email',
        email,
        select: 'id,email',
        extraFilters: { order: 'created_at.desc' },
      });
    },

    async insertTestimonial(input) {
      const response = await fetchImpl(`${supabaseUrl}/rest/v1/testimonials`, {
        method: 'POST',
        headers: buildSupabaseHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(input),
      });
      const rows = await readRows<{ id: string }>(response, 'Testimonial insert');
      if (!rows[0]?.id) throw new Error('Testimonial insert returned no ID');
      return rows[0];
    },

    async insertConsentEvent(input) {
      const response = await fetchImpl(`${supabaseUrl}/rest/v1/testimonial_consent_events`, {
        method: 'POST',
        headers: buildSupabaseHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Consent event insert failed with status ${response.status}`);
      }
    },

    async deleteTestimonial(id) {
      const url = new URL(`${supabaseUrl}/rest/v1/testimonials`);
      url.searchParams.set('id', `eq.${id}`);
      const response = await fetchImpl(url, {
        method: 'DELETE',
        headers: buildSupabaseHeaders(supabaseServiceKey, {
          Prefer: 'return=minimal',
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Testimonial cleanup failed with status ${response.status}`);
      }
    },
  };
}
