import type { APIRoute } from 'astro';

import {
  buildEmailCaptureJourney,
  isEmailCaptureSource,
  isValidEmail,
  normalizeEmail,
} from '../../lib/emailCapture';
import { createLoopsContact } from '../../lib/loops';
import { hasJsonContentType, isTrustedOrigin } from '../../lib/requestSecurity';

export const prerender = false;

type EmailCaptureRow = {
  id: string;
  source: string | null;
  source_history: string[] | null;
  created_at: string;
};

function jsonOk() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function readExistingCapture(
  supabaseUrl: string,
  supabaseKey: string,
  email: string
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/Email_Captures?select=id,source,source_history,created_at&email=eq.${encodeURIComponent(email)}&limit=1`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as EmailCaptureRow[];
  return rows[0] || null;
}

async function insertCapture(
  supabaseUrl: string,
  supabaseKey: string,
  email: string,
  source: string,
  sourceHistory: string[]
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/Email_Captures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      email,
      source,
      source_history: sourceHistory,
      created_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function updateCapture(
  supabaseUrl: string,
  supabaseKey: string,
  id: string,
  source: string,
  sourceHistory: string[]
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/Email_Captures?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        source,
        source_history: sourceHistory,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function persistEmailCapture(
  supabaseUrl: string | undefined,
  supabaseKey: string | undefined,
  email: string,
  source: 'exit-intent' | 'newsletter-cta' | 'checkout-started'
) {
  if (!supabaseUrl || !supabaseKey) {
    console.error('[email-capture] Missing Supabase server configuration');
    return;
  }

  const existing = await readExistingCapture(supabaseUrl, supabaseKey, email);
  const journey = buildEmailCaptureJourney(existing, source);

  if (!existing) {
    await insertCapture(supabaseUrl, supabaseKey, email, journey.source, journey.sourceHistory);
    return;
  }

  const currentHistory = Array.isArray(existing.source_history) ? existing.source_history : [];
  const hasSameSource =
    existing.source === journey.source &&
    currentHistory.length === journey.sourceHistory.length &&
    currentHistory.every((value, index) => value === journey.sourceHistory[index]);

  if (hasSameSource) {
    return;
  }

  await updateCapture(supabaseUrl, supabaseKey, existing.id, journey.source, journey.sourceHistory);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isTrustedOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  if (!hasJsonContentType(request)) {
    return new Response(JSON.stringify({ error: 'Expected application/json' }), {
      status: 415,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';
    const source = body?.source;

    if (!email || !isValidEmail(email)) {
      console.error('[email-capture] Invalid email payload');
      return jsonOk();
    }

    if (!isEmailCaptureSource(source)) {
      console.error('[email-capture] Invalid source payload:', source);
      return jsonOk();
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    const loopsApiKey = import.meta.env.LOOPS_API_KEY;

    try {
      await persistEmailCapture(supabaseUrl, supabaseKey, email, source);
    } catch (error) {
      console.error('[email-capture] Supabase error:', error);
    }

    try {
      await createLoopsContact(loopsApiKey, {
        email,
        source,
      });
    } catch (error) {
      console.error('[email-capture] Loops error:', error);
    }

    return jsonOk();
  } catch (error) {
    console.error('[email-capture] Unexpected error:', error);
    return jsonOk();
  }
};
