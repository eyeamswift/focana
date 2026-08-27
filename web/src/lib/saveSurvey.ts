type SaveSurveyOptions = {
  supabaseUrl: string;
  supabaseServiceKey: string;
  email?: string;
  orderId?: string;
  howFound?: string;
  focusStruggles?: string[];
  toolsTried?: string[];
};

type CustomerRow = {
  id: string;
  email: string | null;
  order_id: string | null;
};

const LOOKUP_RETRY_ATTEMPTS = 12;
const LOOKUP_RETRY_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCustomerLookupUrl(supabaseUrl: string, email?: string, orderId?: string) {
  const url = new URL(`${supabaseUrl}/rest/v1/customers`);
  url.searchParams.set('select', 'id,email,order_id');
  url.searchParams.set('limit', '1');

  if (orderId) {
    url.searchParams.set('order_id', `eq.${orderId}`);
  } else if (email) {
    url.searchParams.set('email', `eq.${email}`);
    url.searchParams.set('order', 'created_at.desc');
  }

  return url.toString();
}

async function findCustomer(
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

    const rows = (await lookupRes.json()) as CustomerRow[];
    if (rows.length > 0) {
      return rows[0];
    }

    if (attempt < LOOKUP_RETRY_ATTEMPTS - 1) {
      await sleep(LOOKUP_RETRY_DELAY_MS);
    }
  }

  return null;
}

async function patchCustomerByOrderId(
  supabaseUrl: string,
  supabaseServiceKey: string,
  orderId: string,
  patchBody: Record<string, unknown>
) {
  const patchUrl = new URL(`${supabaseUrl}/rest/v1/customers`);
  patchUrl.searchParams.set('order_id', `eq.${orderId}`);

  for (let attempt = 0; attempt < LOOKUP_RETRY_ATTEMPTS; attempt += 1) {
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
      throw new Error(`Order patch failed: ${errText || patchRes.status}`);
    }

    const updatedRows = (await patchRes.json()) as Array<{ id: string }>;
    if (updatedRows.length > 0) {
      return updatedRows;
    }

    if (attempt < LOOKUP_RETRY_ATTEMPTS - 1) {
      await sleep(LOOKUP_RETRY_DELAY_MS);
    }
  }

  return [];
}

async function patchCustomerById(
  supabaseUrl: string,
  supabaseServiceKey: string,
  customerId: string,
  patchBody: Record<string, unknown>
) {
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
    throw new Error(`Customer patch failed: ${errText || patchRes.status}`);
  }

  return (await patchRes.json()) as Array<{ id: string }>;
}

export async function saveSurveyToSupabase({
  supabaseUrl,
  supabaseServiceKey,
  email,
  orderId,
  howFound,
  focusStruggles,
  toolsTried,
}: SaveSurveyOptions) {
  const normalizedEmail = email?.trim();
  const normalizedOrderId = orderId?.trim();
  const normalizedHowFound = howFound?.trim();
  const normalizedFocusStruggles = Array.isArray(focusStruggles)
    ? focusStruggles.filter(Boolean)
    : [];
  const normalizedToolsTried = Array.isArray(toolsTried)
    ? toolsTried.filter(Boolean)
    : [];

  if (!normalizedEmail && !normalizedOrderId) {
    throw new Error('Email or order_id is required');
  }

  const patchBody: Record<string, unknown> = {};
  if (normalizedHowFound) patchBody.how_found = normalizedHowFound;
  if (normalizedFocusStruggles.length) patchBody.focus_struggles = normalizedFocusStruggles;
  if (normalizedToolsTried.length) patchBody.tools_tried = normalizedToolsTried;

  if (Object.keys(patchBody).length === 0) {
    return { ok: true, skipped: true };
  }

  let updatedRows: Array<{ id: string }> = [];

  if (normalizedOrderId) {
    const customer = await findCustomer(
      supabaseUrl,
      supabaseServiceKey,
      undefined,
      normalizedOrderId
    );

    if (!customer) {
      throw new Error(`Customer record not ready yet for order_id=${normalizedOrderId}`);
    }

    if (
      normalizedEmail &&
      customer.email &&
      customer.email.trim().toLowerCase() !== normalizedEmail.toLowerCase()
    ) {
      throw new Error(
        `Customer email mismatch for order_id=${normalizedOrderId}: submitted=${normalizedEmail} stored=${customer.email}`
      );
    }

    updatedRows = await patchCustomerByOrderId(
      supabaseUrl,
      supabaseServiceKey,
      normalizedOrderId,
      patchBody
    );
  } else {
    const customer = await findCustomer(
      supabaseUrl,
      supabaseServiceKey,
      normalizedEmail,
      normalizedOrderId
    );

    if (!customer) {
      throw new Error(`Customer record not ready yet for email=${normalizedEmail || 'n/a'}`);
    }

    updatedRows = await patchCustomerById(
      supabaseUrl,
      supabaseServiceKey,
      customer.id,
      patchBody
    );
  }

  if (updatedRows.length === 0) {
    throw new Error(
      `Patch completed without updating a row for email=${normalizedEmail || 'n/a'} order_id=${normalizedOrderId || 'n/a'}`
    );
  }

  return { ok: true, skipped: false, updatedRows };
}
