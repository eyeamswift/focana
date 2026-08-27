import type { APIRoute } from 'astro';

import {
  createSupabaseCustomerLicenseStore,
  syncCustomerLicenseInstance,
  type RawCustomerLicenseSyncPayload,
} from '../../lib/customerLicenseSync';

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

  let payload: RawCustomerLicenseSyncPayload | null = null;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const store = createSupabaseCustomerLicenseStore({
      supabaseUrl,
      supabaseServiceKey,
    });

    const result = await syncCustomerLicenseInstance(payload || {}, {
      store,
      logger: console,
    });

    if (!result.ok && result.status === 'invalid_payload') {
      return json({ error: 'Missing or invalid license sync payload' }, 400);
    }

    if (!result.ok && result.status === 'customer_not_found') {
      return json({ status: 'pending_customer' }, 202);
    }

    return json({
      status: result.status,
      customerId: result.customer?.id || null,
      mappingId: result.mapping?.id || null,
    });
  } catch (error) {
    console.error('[license-sync] Unexpected error:', error);
    return json({ error: 'Failed to sync license instance' }, 500);
  }
};
