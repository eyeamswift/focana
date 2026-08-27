import type { APIRoute } from 'astro';
import {
  createFriendsAndFamilyCheckout,
  createSupabaseFriendsAndFamilyInviteStore,
  isActiveFriendsAndFamilyInvite,
  normalizeCheckoutLocation,
  normalizeCreatorSlug,
} from '../../../../lib/friendsAndFamily';
import { hasJsonContentType, isTrustedOrigin } from '../../../../lib/requestSecurity';
import { resolveSiteOrigin } from '../../../../lib/siteOrigin';

export const prerender = false;

type CheckoutRequestBody = {
  location?: string;
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

function redirect(location: string, status = 303) {
  return new Response(null, {
    status,
    headers: {
      'Location': location,
      'Cache-Control': 'no-store',
    },
  });
}

async function createCheckoutResponse(request: Request, slug: string, location: string) {
  const apiKey = import.meta.env.LEMONSQUEEZY_API_KEY;
  const storeId = import.meta.env.LEMONSQUEEZY_STORE_ID;
  const variantId = import.meta.env.LEMONSQUEEZY_FREE_VARIANT_ID;
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  const creatorSlug = normalizeCreatorSlug(slug);
  const checkoutLocation = normalizeCheckoutLocation(location);

  if (!creatorSlug) {
    throw new Response('Not found', { status: 404 });
  }

  if (!apiKey || !storeId || !variantId || !supabaseUrl || !supabaseServiceKey) {
    throw new Response(JSON.stringify({ error: 'Service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const inviteStore = createSupabaseFriendsAndFamilyInviteStore({
    supabaseUrl,
    supabaseServiceKey,
  });
  const invite = await inviteStore.findInviteBySlug(creatorSlug);

  if (!isActiveFriendsAndFamilyInvite(invite)) {
    throw new Response('Not found', { status: 404 });
  }

  const siteOrigin = resolveSiteOrigin(new URL(request.url).origin);

  return createFriendsAndFamilyCheckout({
    apiKey,
    storeId,
    variantId,
    creatorSlug,
    checkoutLocation,
    siteOrigin,
  });
}

export const GET: APIRoute = async ({ request, params }) => {
  try {
    const location = new URL(request.url).searchParams.get('location');
    const result = await createCheckoutResponse(request, params.slug || '', location || 'unknown');
    return redirect(result.checkoutUrl);
  } catch (error) {
    if (error instanceof Response) return error;

    console.error('[friends-and-family-checkout] Failed to create checkout:', error);
    return json({ error: 'Could not open checkout right now.' }, 500);
  }
};

export const POST: APIRoute = async ({ request, params }) => {
  if (!isTrustedOrigin(request)) {
    return json({ error: 'Forbidden' }, 403);
  }

  if (!hasJsonContentType(request)) {
    return json({ error: 'Expected application/json' }, 415);
  }

  let body: CheckoutRequestBody;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  try {
    const result = await createCheckoutResponse(request, params.slug || '', body.location || 'unknown');
    return json({ checkoutUrl: result.checkoutUrl });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error('[friends-and-family-checkout] Failed to create checkout:', error);
    return json({ error: 'Could not open checkout right now.' }, 500);
  }
};
