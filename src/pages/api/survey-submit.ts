import type { APIRoute } from 'astro';
import { buildSiteUrl } from '../../lib/siteOrigin';
import { isTrustedOrigin } from '../../lib/requestSecurity';
import { saveSurveyToSupabase } from '../../lib/saveSurvey';

export const prerender = false;

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function getStringArray(values: FormDataEntryValue[]) {
  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

export const POST: APIRoute = async ({ request, url }) => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isTrustedOrigin(request)) {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const formData = await request.formData();
  const email = getStringValue(formData.get('email'));
  const orderId = getStringValue(formData.get('order_id'));
  const chip = getStringValue(formData.get('chip'));
  const howFound = getStringValue(formData.get('how_found'));
  const focusStruggles = getStringArray(formData.getAll('focus_struggles'));
  const toolsTried = getStringArray(formData.getAll('tools_tried'));

  const redirectUrl = buildSiteUrl('/next-steps', {
    email,
    order_id: orderId,
    chip,
    survey: 'saved',
  }, url.origin);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[survey-submit] Missing server configuration');
    redirectUrl.searchParams.set('survey', 'error');
    return Response.redirect(redirectUrl, 303);
  }

  try {
    await saveSurveyToSupabase({
      supabaseUrl,
      supabaseServiceKey,
      email,
      orderId,
      howFound,
      focusStruggles,
      toolsTried,
    });
  } catch (error) {
    console.error(
      `[survey-submit] Failed for email=${email || 'n/a'} order_id=${orderId || 'n/a'}:`,
      error
    );
    redirectUrl.searchParams.set('survey', 'error');
  }

  return Response.redirect(redirectUrl, 303);
};
