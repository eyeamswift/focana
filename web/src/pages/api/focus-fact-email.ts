import type { APIRoute } from 'astro';
import {
  normalizeFocusFactEmailRequest,
  sendFocusFactArticleEmail,
} from '../../lib/focusFactEmail.ts';

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
  let body: unknown;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const normalized = normalizeFocusFactEmailRequest(body);
  if (!normalized) return json({ error: 'Invalid email request' }, 400);

  const loopsApiKey = import.meta.env.LOOPS_API_KEY;
  if (!loopsApiKey) return json({ error: 'Email service is unavailable right now.' }, 503);

  try {
    await sendFocusFactArticleEmail({ request: normalized, loopsApiKey });
    return json({ accepted: true });
  } catch (error) {
    console.error('[focus-fact-email] Provider error:', error);
    return json({ error: 'The article email could not be sent. Please try again.' }, 502);
  }
};
