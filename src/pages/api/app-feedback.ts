import type { APIRoute } from 'astro';

import {
  MAX_BATCH_SIZE,
  createSupabaseAppFeedbackStore,
  normalizeFeedbackItem,
  storeFeedbackRows,
  type RawFeedbackItem,
  type FeedbackInsertRow,
} from '../../lib/appFeedbackService';

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

  let payload: { items?: RawFeedbackItem[] } | null = null;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const rawItems = Array.isArray(payload?.items) ? payload.items.slice(0, MAX_BATCH_SIZE) : [];
  if (rawItems.length === 0) {
    return json({ error: 'No feedback items provided' }, 400);
  }

  const normalizedRows = rawItems
    .map((item) => normalizeFeedbackItem(item))
    .filter((item): item is FeedbackInsertRow => Boolean(item));

  if (normalizedRows.length === 0) {
    return json({ error: 'No valid feedback items provided' }, 400);
  }

  const acceptedIds = normalizedRows.map((item) => item.id);

  try {
    const store = createSupabaseAppFeedbackStore({
      supabaseUrl,
      supabaseServiceKey,
    });

    await storeFeedbackRows(normalizedRows, {
      store,
      logger: console,
    });

    return json({ acceptedIds });
  } catch (error) {
    console.error('[app-feedback] Unexpected error:', error);
    return json({ error: 'Failed to store app feedback' }, 500);
  }
};
