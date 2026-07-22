import type { APIRoute } from 'astro';

import {
  createFocusEmailAutomationStore,
  sendFocusMilestones,
} from '../../../lib/focusEmailAutomation';

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

function isAuthorized(request: Request) {
  const secret = import.meta.env.FOCANA_CRON_SECRET || import.meta.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get('authorization') || '';
  const headerSecret = request.headers.get('x-focana-cron-secret') || '';
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const loopsApiKey = import.meta.env.LOOPS_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  try {
    const store = createFocusEmailAutomationStore({
      supabaseUrl,
      supabaseServiceKey,
    });
    const result = await sendFocusMilestones({ store, loopsApiKey });
    return json(result);
  } catch (error) {
    console.error('[focus-milestones] Unexpected error:', error);
    return json({ error: 'Failed to process focus milestones' }, 500);
  }
}

export const GET: APIRoute = ({ request }) => handle(request);
export const POST: APIRoute = ({ request }) => handle(request);
