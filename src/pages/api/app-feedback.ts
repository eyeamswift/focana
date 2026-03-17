import type { APIRoute } from 'astro';

export const prerender = false;

const MAX_BATCH_SIZE = 25;

type RawFeedbackItem = {
  id?: unknown;
  sessionId?: unknown;
  feedback?: unknown;
  surface?: unknown;
  completionType?: unknown;
  sessionMode?: unknown;
  sessionDurationMinutes?: unknown;
  clientCreatedAt?: unknown;
  appVersion?: unknown;
  osVersion?: unknown;
  channel?: unknown;
  installId?: unknown;
  licenseInstanceId?: unknown;
};

type FeedbackInsertRow = {
  id: string;
  session_id: string | null;
  feedback: 'up' | 'down';
  surface: string;
  completion_type: string;
  session_mode: 'freeflow' | 'timed';
  session_duration_minutes: number;
  client_created_at: string;
  app_version: string;
  os_version: string;
  channel: string;
  install_id: string;
  license_instance_id: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function clampText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeIso(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeFeedbackItem(rawItem: RawFeedbackItem): FeedbackInsertRow | null {
  const id = clampText(rawItem.id, 160);
  const feedback = rawItem.feedback === 'down' ? 'down' : (rawItem.feedback === 'up' ? 'up' : null);
  if (!id || !feedback) return null;

  const sessionId = clampText(rawItem.sessionId, 160) || null;
  const surface = clampText(rawItem.surface, 80) || 'unknown';
  const completionType = clampText(rawItem.completionType, 40) || 'unknown';
  const sessionMode = rawItem.sessionMode === 'timed' ? 'timed' : 'freeflow';
  const sessionDurationMinutes = Number.isFinite(Number(rawItem.sessionDurationMinutes))
    ? Math.max(0, Number(rawItem.sessionDurationMinutes))
    : 0;
  const clientCreatedAt = safeIso(rawItem.clientCreatedAt) || new Date().toISOString();
  const appVersion = clampText(rawItem.appVersion, 40) || 'unknown';
  const osVersion = clampText(rawItem.osVersion, 120);
  const channel = clampText(rawItem.channel, 40) || 'latest';
  const installId = clampText(rawItem.installId, 160);
  const licenseInstanceId = clampText(rawItem.licenseInstanceId, 160) || null;

  return {
    id,
    session_id: sessionId,
    feedback,
    surface,
    completion_type: completionType,
    session_mode: sessionMode,
    session_duration_minutes: sessionDurationMinutes,
    client_created_at: clientCreatedAt,
    app_version: appVersion,
    os_version: osVersion,
    channel,
    install_id: installId,
    license_instance_id: licenseInstanceId,
  };
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
    const insertUrl = new URL(`${supabaseUrl}/rest/v1/app_session_feedback`);
    insertUrl.searchParams.set('on_conflict', 'id');

    const response = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(normalizedRows),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[app-feedback] Supabase insert error:', errText);
      return json({ error: 'Failed to store app feedback' }, 500);
    }

    return json({ acceptedIds });
  } catch (error) {
    console.error('[app-feedback] Unexpected error:', error);
    return json({ error: 'Failed to store app feedback' }, 500);
  }
};
