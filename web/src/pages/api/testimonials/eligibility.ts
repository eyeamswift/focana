import type { APIRoute } from 'astro';

import { isValidEmail, normalizeEmail } from '../../../lib/emailCapture';
import { hasJsonContentType, isTrustedOrigin } from '../../../lib/requestSecurity';
import {
  createSupabaseTestimonialStore,
  resolveTestimonialEligibility,
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

export const POST: APIRoute = async ({ request }) => {
  if (!isTrustedOrigin(request) || !hasJsonContentType(request)) {
    return json({ error: 'Request not allowed.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Please enter a valid email.' }, 400);
  }

  const email = normalizeEmail(typeof body.email === 'string' ? body.email : '');
  if (!isValidEmail(email)) {
    return json({ eligible: false, error: 'Please enter a valid email.' }, 400);
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[testimonials/eligibility] Missing server configuration');
    return json({ error: 'We could not check that email right now. Please try again.' }, 500);
  }

  try {
    const eligibility = await resolveTestimonialEligibility(
      email,
      createSupabaseTestimonialStore({ supabaseUrl, supabaseServiceKey })
    );

    if (!eligibility) {
      return json({
        eligible: false,
        error: 'We could not find Focana access under that email. Try the email you used for your purchase, beta download, or friends-and-family access.',
      });
    }

    return json({ eligible: true, email: eligibility.email });
  } catch (error) {
    console.error('[testimonials/eligibility] Lookup failed:', error);
    return json({ error: 'We could not check that email right now. Please try again.' }, 500);
  }
};
