import type { APIRoute } from 'astro';

export const prerender = false;

const API_BASE_URL = 'https://api.lemonsqueezy.com/v1';

type CustomerRow = {
  email: string | null;
  order_id: string | null;
  refunded_at: string | null;
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

async function fetchFileDownloadUrl(apiKey: string, fileId: string) {
  const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`File lookup failed for ${fileId}: ${errText || response.status}`);
  }

  const payload = await response.json() as {
    data?: {
      attributes?: {
        download_url?: string;
      };
    };
  };

  const downloadUrl = payload.data?.attributes?.download_url;
  if (!downloadUrl) {
    throw new Error(`File ${fileId} did not include a download_url`);
  }

  return downloadUrl;
}

export const GET: APIRoute = async ({ request }) => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const lemonApiKey = import.meta.env.LEMONSQUEEZY_API_KEY;
  const arm64FileId = import.meta.env.LEMONSQUEEZY_ARM64_FILE_ID;
  const x64FileId = import.meta.env.LEMONSQUEEZY_X64_FILE_ID;

  if (!supabaseUrl || !supabaseServiceKey || !lemonApiKey || !arm64FileId || !x64FileId) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get('order_id')?.trim() || '';
  const email = url.searchParams.get('email')?.trim().toLowerCase() || '';

  if (!orderId || !email) {
    return json({ status: 'denied' });
  }

  const customerLookupUrl = new URL(`${supabaseUrl}/rest/v1/customers`);
  customerLookupUrl.searchParams.set('select', 'email,order_id,refunded_at');
  customerLookupUrl.searchParams.set('order_id', `eq.${orderId}`);
  customerLookupUrl.searchParams.set('limit', '1');

  try {
    const customerRes = await fetch(customerLookupUrl, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!customerRes.ok) {
      const errText = await customerRes.text();
      console.error(`[download-links] Customer lookup failed for order_id=${orderId}:`, errText);
      return json({ error: 'Failed to verify purchase' }, 500);
    }

    const rows = (await customerRes.json()) as CustomerRow[];
    if (rows.length === 0) {
      return json({ status: 'pending' });
    }

    const customer = rows[0];
    const storedEmail = customer.email?.trim().toLowerCase() || '';
    if (!storedEmail || storedEmail !== email) {
      return json({ status: 'denied' });
    }

    if (customer.refunded_at) {
      return json({ status: 'denied' });
    }

    const [arm64Url, x64Url] = await Promise.all([
      fetchFileDownloadUrl(lemonApiKey, arm64FileId),
      fetchFileDownloadUrl(lemonApiKey, x64FileId),
    ]);

    return json({
      status: 'authorized',
      arm64Url,
      x64Url,
    });
  } catch (error) {
    console.error(`[download-links] Unexpected error for order_id=${orderId}:`, error);
    return json({ error: 'Failed to load download links' }, 500);
  }
};
