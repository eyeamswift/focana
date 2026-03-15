import type { APIRoute } from 'astro';

export const prerender = false;

const LOOKUP_RETRY_ATTEMPTS = 12;
const LOOKUP_RETRY_DELAY_MS = 500;

type SurveyRequestBody = {
  email?: string;
  order_id?: string;
  how_found?: string;
  focus_struggles?: string[];
  tools_tried?: string[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCustomerLookupUrl(
  supabaseUrl: string,
  email?: string,
  orderId?: string
) {
  const url = new URL(`${supabaseUrl}/rest/v1/customers`);
  url.searchParams.set('select', 'id');
  url.searchParams.set('limit', '1');

  if (orderId && email) {
    url.searchParams.set('or', `(order_id.eq.${orderId},email.eq.${email})`);
  } else if (orderId) {
    url.searchParams.set('order_id', `eq.${orderId}`);
  } else if (email) {
    url.searchParams.set('email', `eq.${email}`);
  }

  return url.toString();
}

async function findCustomerId(
  supabaseUrl: string,
  supabaseServiceKey: string,
  email?: string,
  orderId?: string
) {
  const lookupUrl = buildCustomerLookupUrl(supabaseUrl, email, orderId);

  for (let attempt = 0; attempt < LOOKUP_RETRY_ATTEMPTS; attempt += 1) {
    const lookupRes = await fetch(lookupUrl, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!lookupRes.ok) {
      const errText = await lookupRes.text();
      throw new Error(`Customer lookup failed: ${errText || lookupRes.status}`);
    }

    const rows = (await lookupRes.json()) as Array<{ id: string }>;
    if (rows.length > 0) {
      return rows[0].id;
    }

    if (attempt < LOOKUP_RETRY_ATTEMPTS - 1) {
      await sleep(LOOKUP_RETRY_DELAY_MS);
    }
  }

  return null;
}

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
    const customerId = await findCustomerId(
      supabaseUrl,
      supabaseServiceKey,
      email,
      orderId
    );

    if (!customerId) {
      console.error(
        `[survey] No matching customer row found for email=${email || 'n/a'} order_id=${orderId || 'n/a'}`
      );
      return new Response(JSON.stringify({ error: 'Customer record not ready yet' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const patchUrl = new URL(`${supabaseUrl}/rest/v1/customers`);
    patchUrl.searchParams.set('id', `eq.${customerId}`);

    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(patchBody),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error(
        `[survey] Supabase patch error for email=${email || 'n/a'} order_id=${orderId || 'n/a'}:`,
        errText
      );
      return new Response(JSON.stringify({ error: 'Failed to save survey' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updatedRows = (await patchRes.json()) as Array<{ id: string }>;
    if (updatedRows.length === 0) {
      console.error(
        `[survey] Patch completed without updating a row for email=${email || 'n/a'} order_id=${orderId || 'n/a'}`
      );
      return new Response(JSON.stringify({ error: 'Failed to save survey' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
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
