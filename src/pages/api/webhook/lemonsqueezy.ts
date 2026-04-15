import type { APIRoute } from 'astro';
import {
  claimFriendsAndFamilyInvite,
  createSupabaseFriendsAndFamilyInviteStore,
} from '../../../lib/friendsAndFamily';

export const prerender = false;

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

export const POST: APIRoute = async ({ request }) => {
  const webhookSecret = import.meta.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const loopsApiKey = import.meta.env.LOOPS_API_KEY;

  // Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get('X-Signature') || '';

  // Verify HMAC-SHA256 signature
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

  // Only process order_created events
  if (eventName !== 'order_created') {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const orderId = String(payload.data?.id);
  const attributes = payload.data?.attributes || {};
  const email: string = attributes.user_email;
  const name: string = attributes.user_name;
  const customerIdLs = String(attributes.customer_id);
  const creatorSlug = typeof customData.creator_slug === 'string'
    ? customData.creator_slug.trim().toLowerCase()
    : '';
  const customSource = typeof customData.source === 'string'
    ? customData.source.trim()
    : '';
  const amountPaid = Number(attributes.total) / 100;
  const currency: string = attributes.currency;

  let supabaseOk = false;
  let loopsOk = false;
  let inviteClaimOk = customSource !== 'friends_and_family';
  let source = customSource === 'friends_and_family' ? 'friends_and_family' : 'founding_sale';

  // --- Supabase ---
  try {
    // Check for duplicate order_id
    const dupCheck = await fetch(
      `${supabaseUrl}/rest/v1/customers?order_id=eq.${orderId}&select=order_id`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    if (dupCheck.ok) {
      const existing = await dupCheck.json();
      if (existing.length > 0) {
        console.log(`[order_id=${orderId}] Duplicate order, skipping insert`);
        supabaseOk = true;
        // Still attempt Loops below
      }
    }

    if (!supabaseOk) {
      // Check if email exists in beta_downloads
      let betaUser = false;

      const betaCheck = await fetch(
        `${supabaseUrl}/rest/v1/Beta_Downloads?email=eq.${encodeURIComponent(email)}&select=email`,
        {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
        }
      );

      if (betaCheck.ok) {
        const betaRows = await betaCheck.json();
        if (betaRows.length > 0) {
          betaUser = true;
          if (source !== 'friends_and_family') {
            source = 'beta_convert';
          }
        }
      }

      // Insert into customers table
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          email,
          name,
          status: 'founding_member',
          source,
          order_id: orderId,
          customer_id_ls: customerIdLs,
          amount_paid: amountPaid,
          currency,
          purchased_at: new Date().toISOString(),
          creator_slug: creatorSlug || null,
          beta_user: betaUser,
          email_opted_in: true,
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

  // --- Loops ---
  try {
    if (loopsApiKey) {
      const contactRes = await fetch('https://app.loops.so/api/v1/contacts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loopsApiKey}`,
        },
        body: JSON.stringify({
          email,
          firstName: name,
          source,
          userGroup: 'customer',
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
          'Authorization': `Bearer ${loopsApiKey}`,
        },
        body: JSON.stringify({
          email,
          eventName: 'purchase_completed',
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

  // If both Supabase and Loops failed, return 500
  if (!supabaseOk && !loopsOk) {
    return new Response(
      JSON.stringify({ error: 'Both Supabase and Loops failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
