import type { APIRoute } from 'astro';
import { saveSurveyToSupabase } from '../../lib/saveSurvey';

export const prerender = false;

type SurveyRequestBody = {
  email?: string;
  order_id?: string;
  how_found?: string;
  focus_struggles?: string[];
  tools_tried?: string[];
};

export const POST: APIRoute = async ({ request }) => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: SurveyRequestBody;

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = body.email?.trim();
  const orderId = body.order_id?.trim();
  const { how_found, focus_struggles, tools_tried } = body;

  if (!email && !orderId) {
    return new Response(JSON.stringify({ error: 'Email or order_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const patchBody: Record<string, unknown> = {};
  if (how_found) patchBody.how_found = how_found;
  if (focus_struggles?.length) patchBody.focus_struggles = focus_struggles;
  if (tools_tried?.length) patchBody.tools_tried = tools_tried;

  if (Object.keys(patchBody).length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await saveSurveyToSupabase({
      supabaseUrl,
      supabaseServiceKey,
      email,
      orderId,
      howFound: how_found,
      focusStruggles: focus_struggles,
      toolsTried: tools_tried,
    });

    console.log(
      `[survey] Saved survey for email=${email || 'n/a'} order_id=${orderId || 'n/a'} updated_rows=${result.updatedRows?.length || 0}`
    );
  } catch (error) {
    console.error(
      `[survey] Unexpected error for email=${email || 'n/a'} order_id=${orderId || 'n/a'}:`,
      error
    );
    return new Response(JSON.stringify({ error: 'Failed to save survey' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
