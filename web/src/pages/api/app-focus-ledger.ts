import type { APIRoute } from 'astro';

import {
  MAX_LEDGER_BATCH_SIZE,
  createSupabaseFocusLedgerStore,
  storeFocusLedgerBatch,
  type RawFocusCheckIn,
  type RawFocusSegment,
  type RawFocusSession,
} from '../../lib/appFocusLedgerService';

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
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  let payload: {
    sessions?: RawFocusSession[];
    segments?: RawFocusSegment[];
    checkins?: RawFocusCheckIn[];
  } | null = null;

  try {
    payload = await request.json();
  } catch (_) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const sessions = Array.isArray(payload?.sessions) ? payload.sessions.slice(0, MAX_LEDGER_BATCH_SIZE) : [];
  const segments = Array.isArray(payload?.segments) ? payload.segments.slice(0, MAX_LEDGER_BATCH_SIZE) : [];
  const checkins = Array.isArray(payload?.checkins) ? payload.checkins.slice(0, MAX_LEDGER_BATCH_SIZE) : [];

  if (!sessions.length && !segments.length && !checkins.length) {
    return json({ error: 'No focus ledger items provided' }, 400);
  }

  try {
    const store = createSupabaseFocusLedgerStore({
      supabaseUrl,
      supabaseServiceKey,
    });
    const result = await storeFocusLedgerBatch({ sessions, segments, checkins }, {
      store,
      logger: console,
    });

    if (result.acceptedIds.length === 0) {
      return json({ error: 'No valid focus ledger items provided' }, 400);
    }

    return json(result);
  } catch (error) {
    console.error('[app-focus-ledger] Unexpected error:', error);
    return json({ error: 'Failed to store focus ledger items' }, 500);
  }
};
