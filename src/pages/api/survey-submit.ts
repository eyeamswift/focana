import type { APIRoute } from 'astro';
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

function buildRedirectUrl(url: URL, email: string, orderId: string, chip: string, status: string) {
  const redirectUrl = new URL('/next-steps', url);
  if (email) redirectUrl.searchParams.set('email', email);
  if (orderId) redirectUrl.searchParams.set('order_id', orderId);
  if (chip) redirectUrl.searchParams.set('chip', chip);
  redirectUrl.searchParams.set('survey', status);
  return redirectUrl;
}

export const POST: APIRoute = async ({ request, url }) => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  const formData = await request.formData();
  const email = getStringValue(formData.get('email'));
  const orderId = getStringValue(formData.get('order_id'));
  const chip = getStringValue(formData.get('chip'));
  const howFound = getStringValue(formData.get('how_found'));
  const focusStruggles = getStringArray(formData.getAll('focus_struggles'));
  const toolsTried = getStringArray(formData.getAll('tools_tried'));

  const redirectUrl = buildRedirectUrl(url, email, orderId, chip, 'saved');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[survey-submit] Server misconfigured');
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
