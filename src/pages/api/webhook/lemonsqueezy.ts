import type { APIRoute } from 'astro';
import {
  claimFriendsAndFamilyInvite,
  createSupabaseFriendsAndFamilyInviteStore,
} from '../../../lib/friendsAndFamily';

export const prerender = false;

const KNOWN_VARIANT_PLANS: Record<string, 'monthly' | 'lifetime' | 'legacy_lifetime' | 'friends_family'> = {
  '1442573': 'monthly',
  '1611321': 'lifetime',
  '1442556': 'legacy_lifetime',
  '1438451': 'friends_family',
};

const ORDER_EVENTS = new Set(['order_created']);
const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
  'subscription_payment_success',
  'subscription_payment_failed',
  'subscription_payment_recovered',
]);

async function verifySignature(
  secret: string,
  body: string,
  signatureHeader: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const digest = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return digest === signatureHeader;
}

function clampText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeId(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  return text || null;
}

function firstPresent(...values: unknown[]) {
  for (const value of values) {
    const text = normalizeId(value);
    if (text) return text;
  }
  return null;
}

function extractVariantId(payload: any) {
  const attributes = payload?.data?.attributes || {};
  const customData = payload?.meta?.custom_data || {};
  const firstOrderItem = attributes.first_order_item || attributes.first_order_item_data || {};
  const firstSubscriptionItem = attributes.first_subscription_item || {};

  return firstPresent(
    customData.variant_id,
    customData.variantId,
    attributes.variant_id,
    attributes.variantId,
    firstOrderItem.variant_id,
    firstOrderItem.variantId,
    firstSubscriptionItem.variant_id,
    firstSubscriptionItem.variantId
  );
}

function extractSubscriptionId(payload: any) {
  const attributes = payload?.data?.attributes || {};
  const customData = payload?.meta?.custom_data || {};
  const firstOrderItem = attributes.first_order_item || attributes.first_order_item_data || {};
  const firstSubscriptionItem = attributes.first_subscription_item || {};
  const dataType = String(payload?.data?.type || '').toLowerCase();

  return firstPresent(
    dataType.includes('subscription') ? payload?.data?.id : null,
    customData.subscription_id,
    customData.subscriptionId,
    attributes.subscription_id,
    attributes.subscriptionId,
    firstOrderItem.subscription_id,
    firstOrderItem.subscriptionId,
    firstSubscriptionItem.subscription_id,
    firstSubscriptionItem.subscriptionId
  );
}

function getPlanType(variantId: string | null, customSource = '') {
  if (customSource === 'friends_and_family') return 'friends_family';
  return variantId ? KNOWN_VARIANT_PLANS[variantId] || 'paid' : 'paid';
}

function getCustomerSource(planType: string, customSource = '', betaUser = false) {
  if (customSource === 'friends_and_family' || planType === 'friends_family') return 'friends_and_family';
  if (customSource) return customSource;
  if (betaUser) return 'beta_convert';
  if (planType === 'monthly') return 'trial_upgrade_monthly';
  if (planType === 'lifetime') return 'trial_upgrade_lifetime';
  if (planType === 'legacy_lifetime') return 'legacy_lifetime';
  return 'paid_checkout';
}

function getSubscriptionStatus(payload: any) {
  const attributes = payload?.data?.attributes || {};
  return clampText(
    attributes.status ||
    attributes.subscription_status ||
    attributes.status_formatted ||
    '',
    80
  ) || null;
}

function buildSupabaseHeaders(serviceKey: string, extraHeaders: Record<string, string> = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extraHeaders,
  };
}

async function checkBetaUser({
  supabaseUrl,
  supabaseServiceKey,
  email,
}: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  email: string;
}) {
  const betaCheck = await fetch(
    `${supabaseUrl}/rest/v1/Beta_Downloads?email=eq.${encodeURIComponent(email)}&select=email`,
    {
      headers: buildSupabaseHeaders(supabaseServiceKey),
    }
  );

  if (!betaCheck.ok) return false;
  const betaRows = await betaCheck.json();
  return Array.isArray(betaRows) && betaRows.length > 0;
}

async function patchCustomers({
  supabaseUrl,
  supabaseServiceKey,
  filter,
  patch,
}: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  filter: string;
  patch: Record<string, unknown>;
}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/customers?${filter}&select=id`, {
    method: 'PATCH',
    headers: buildSupabaseHeaders(supabaseServiceKey, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase customer patch failed with status ${response.status}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function handleSubscriptionEvent({
  payload,
  supabaseUrl,
  supabaseServiceKey,
}: {
  payload: any;
  supabaseUrl: string;
  supabaseServiceKey: string;
}) {
  const attributes = payload.data?.attributes || {};
  const subscriptionId = extractSubscriptionId(payload);
  const variantId = extractVariantId(payload);
  const planType = getPlanType(variantId);
  const subscriptionStatus = getSubscriptionStatus(payload);
  const email = clampText(attributes.user_email || attributes.email || '', 320).toLowerCase();
  const name = clampText(attributes.user_name || attributes.name || '', 160);
  const customerIdLs = normalizeId(attributes.customer_id);

  const patch: Record<string, unknown> = {
    status: subscriptionStatus || 'subscription_event',
    source: getCustomerSource(planType),
    plan_type: planType,
    variant_id_ls: variantId,
    subscription_id_ls: subscriptionId,
    subscription_status: subscriptionStatus,
    updated_at: new Date().toISOString(),
  };
  if (email) patch.email = email;
  if (name) patch.name = name;
  if (customerIdLs) patch.customer_id_ls = customerIdLs;

  try {
    let updatedRows: unknown[] = [];

    if (subscriptionId) {
      updatedRows = await patchCustomers({
        supabaseUrl,
        supabaseServiceKey,
        filter: `subscription_id_ls=eq.${encodeURIComponent(subscriptionId)}`,
        patch,
      });
    }

    if (!updatedRows.length && customerIdLs) {
      updatedRows = await patchCustomers({
        supabaseUrl,
        supabaseServiceKey,
        filter: `customer_id_ls=eq.${encodeURIComponent(customerIdLs)}`,
        patch,
      });
    }

    if (!updatedRows.length && email) {
      updatedRows = await patchCustomers({
        supabaseUrl,
        supabaseServiceKey,
        filter: `email=eq.${encodeURIComponent(email)}`,
        patch,
      });
    }

    if (updatedRows.length) {
      return { supabaseOk: true, inserted: false };
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/customers`, {
      method: 'POST',
      headers: buildSupabaseHeaders(supabaseServiceKey, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({
        ...patch,
        purchased_at: new Date().toISOString(),
        email_opted_in: true,
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error(`[subscription_id=${subscriptionId || 'unknown'}] Supabase subscription insert error:`, errText);
      return { supabaseOk: false, inserted: false };
    }

    return { supabaseOk: true, inserted: true };
  } catch (err) {
    console.error(`[subscription_id=${subscriptionId || 'unknown'}] Supabase subscription error:`, err);
    return { supabaseOk: false, inserted: false };
  }
}

export const POST: APIRoute = async ({ request }) => {
  const webhookSecret = import.meta.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const loopsApiKey = import.meta.env.LOOPS_API_KEY;

  const rawBody = await request.text();
  const signature = request.headers.get('X-Signature') || '';

  const isValid = await verifySignature(webhookSecret, rawBody, signature);
  if (!isValid) {
    console.error('Lemon Squeezy webhook signature verification failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = JSON.parse(rawBody);
  const eventName = payload.meta?.event_name;
  const customData = payload.meta?.custom_data || {};

  if (SUBSCRIPTION_EVENTS.has(eventName)) {
    const result = await handleSubscriptionEvent({
      payload,
      supabaseUrl,
      supabaseServiceKey,
    });

    return new Response(JSON.stringify({ ok: result.supabaseOk, handled: 'subscription', ...result }), {
      status: result.supabaseOk ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!ORDER_EVENTS.has(eventName)) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const orderId = String(payload.data?.id);
  const attributes = payload.data?.attributes || {};
  const email: string = clampText(attributes.user_email, 320).toLowerCase();
  const name: string = clampText(attributes.user_name, 160);
  const customerIdLs = normalizeId(attributes.customer_id);
  const creatorSlug = typeof customData.creator_slug === 'string'
    ? customData.creator_slug.trim().toLowerCase()
    : '';
  const customSource = typeof customData.source === 'string'
    ? customData.source.trim()
    : '';
  const amountPaid = Number(attributes.total) / 100;
  const currency: string = attributes.currency;
  const variantId = extractVariantId(payload);
  const planType = getPlanType(variantId, customSource);
  const subscriptionId = extractSubscriptionId(payload);
  const subscriptionStatus = getSubscriptionStatus(payload);

  let supabaseOk = false;
  let loopsOk = false;
  let inviteClaimOk = customSource !== 'friends_and_family';
  let source = getCustomerSource(planType, customSource);

  try {
    const dupCheck = await fetch(
      `${supabaseUrl}/rest/v1/customers?order_id=eq.${orderId}&select=order_id`,
      {
        headers: buildSupabaseHeaders(supabaseServiceKey),
      }
    );

    if (dupCheck.ok) {
      const existing = await dupCheck.json();
      if (existing.length > 0) {
        console.log(`[order_id=${orderId}] Duplicate order, skipping insert`);
        supabaseOk = true;
      }
    }

    if (!supabaseOk) {
      const betaUser = await checkBetaUser({
        supabaseUrl,
        supabaseServiceKey,
        email,
      });
      source = getCustomerSource(planType, customSource, betaUser);

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/customers`, {
        method: 'POST',
        headers: buildSupabaseHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({
          email,
          name,
          status: planType,
          source,
          order_id: orderId,
          customer_id_ls: customerIdLs,
          amount_paid: amountPaid,
          currency,
          purchased_at: new Date().toISOString(),
          creator_slug: creatorSlug || null,
          beta_user: betaUser,
          email_opted_in: true,
          plan_type: planType,
          variant_id_ls: variantId,
          subscription_id_ls: subscriptionId,
          subscription_status: subscriptionStatus,
        }),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error(`[order_id=${orderId}] Supabase insert error:`, errText);
      } else {
        supabaseOk = true;
      }
    }

    if (supabaseOk && customSource === 'friends_and_family') {
      if (!creatorSlug) {
        console.error(`[order_id=${orderId}] Missing creator slug for friends-and-family order`);
      } else {
        const inviteStore = createSupabaseFriendsAndFamilyInviteStore({
          supabaseUrl,
          supabaseServiceKey,
        });
        const claimResult = await claimFriendsAndFamilyInvite(
          {
            slug: creatorSlug,
            purchaserEmail: email,
            orderId,
          },
          {
            store: inviteStore,
          }
        );

        inviteClaimOk = claimResult.ok;

        if (!claimResult.ok) {
          console.error(
            `[order_id=${orderId}] Friends-and-family invite claim failed for slug=${creatorSlug}: ${claimResult.status}`
          );
        }
      }
    }
  } catch (err) {
    console.error(`[order_id=${orderId}] Supabase error:`, err);
  }

  try {
    if (loopsApiKey) {
      const contactRes = await fetch('https://app.loops.so/api/v1/contacts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loopsApiKey}`,
        },
        body: JSON.stringify({
          email,
          firstName: name,
          source,
          userGroup: 'customer',
          planType,
        }),
      });

      if (!contactRes.ok) {
        const errText = await contactRes.text();
        console.error(`[order_id=${orderId}] Loops contact create error:`, errText);
      }

      const eventRes = await fetch('https://app.loops.so/api/v1/events/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loopsApiKey}`,
        },
        body: JSON.stringify({
          email,
          eventName: 'purchase_completed',
          planType,
        }),
      });

      if (!eventRes.ok) {
        const errText = await eventRes.text();
        console.error(`[order_id=${orderId}] Loops event send error:`, errText);
      }

      loopsOk = true;
    } else {
      console.error(`[order_id=${orderId}] LOOPS_API_KEY not configured`);
    }
  } catch (err) {
    console.error(`[order_id=${orderId}] Loops error:`, err);
  }

  if (customSource === 'friends_and_family' && !inviteClaimOk) {
    return new Response(
      JSON.stringify({ error: 'Friends-and-family invite claim failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (!supabaseOk && !loopsOk) {
    return new Response(
      JSON.stringify({ error: 'Both Supabase and Loops failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify({ ok: true, planType, variantId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
