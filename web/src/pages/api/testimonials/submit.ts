import type { APIRoute } from 'astro';

import { isValidEmail, normalizeEmail } from '../../../lib/emailCapture';
import { hasJsonContentType, isTrustedOrigin } from '../../../lib/requestSecurity';
import {
  createSupabaseTestimonialStore,
  resolveTestimonialEligibility,
  saveVerifiedTestimonial,
  TestimonialValidationError,
  type TestimonialSubmissionInput,
} from '../../../lib/testimonialService';

export const prerender = false;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export const POST: APIRoute = async ({ request }) => {
  if (!isTrustedOrigin(request) || !hasJsonContentType(request)) {
    return json({ error: 'Request not allowed.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Please check the form and try again.' }, 400);
  }

  // Quietly accept bot submissions that fill the hidden field.
  if (stringValue(body.companyWebsite).trim()) {
    return json({ ok: true });
  }

  const email = normalizeEmail(stringValue(body.email));
  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email.', field: 'email' }, 400);
  }

  // Quietly accept obvious bot submissions without adding them to the review queue.
  if (stringValue(body.companyWebsite).trim()) {
    return json({ ok: true }, 201);
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[testimonials/submit] Missing server configuration');
    return json({ error: 'We could not save your story right now. Please try again.' }, 500);
  }

  const store = createSupabaseTestimonialStore({ supabaseUrl, supabaseServiceKey });

  try {
    // Never trust the earlier browser check; eligibility is resolved again at submission.
    const eligibility = await resolveTestimonialEligibility(email, store);
    if (!eligibility) {
      return json(
        {
          error: 'We could not find Focana access under that email. Try the email you used for your purchase, beta download, or friends-and-family access.',
          field: 'email',
        },
        403
      );
    }

    const submission: TestimonialSubmissionInput = {
      firstName: stringValue(body.firstName),
      lastName: stringValue(body.lastName),
      attribution: stringValue(body.attribution) as TestimonialSubmissionInput['attribution'],
      selectedFeatures: Array.isArray(body.selectedFeatures)
        ? body.selectedFeatures.filter((value): value is string => typeof value === 'string') as TestimonialSubmissionInput['selectedFeatures']
        : [],
      otherFeature: stringValue(body.otherFeature),
      featureStory: stringValue(body.featureStory),
      recommendationQuote: stringValue(body.recommendationQuote),
      consentWebsite: body.consentWebsite === true,
      consentSocial: body.consentSocial === true,
      consentLaunchMaterials: body.consentLaunchMaterials === true,
      editingConsent: body.editingConsent === true,
    };

    await saveVerifiedTestimonial(submission, eligibility, store);
    return json({ ok: true }, 201);
  } catch (error) {
    if (error instanceof TestimonialValidationError) {
      return json({ error: error.message, field: error.field }, 400);
    }

    console.error('[testimonials/submit] Save failed:', error);
    return json({ error: 'We could not save your story right now. Please try again.' }, 500);
  }
};
