import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    email?: string;
    how_found?: string;
    focus_struggles?: string[];
    tools_tried?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { email, how_found, focus_struggles, tools_tried } = body;

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
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

  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(patchBody),
    }
  );

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    console.error(`[survey] Supabase patch error for ${email}:`, errText);
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
