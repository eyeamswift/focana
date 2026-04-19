import type { APIRoute } from 'astro';

import { createLoopsContact } from '../../lib/loops';
import { hasJsonContentType, isTrustedOrigin } from '../../lib/requestSecurity';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
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

    const body = await request.json();
    const { email, phone } = body;

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    const loopsApiKey = import.meta.env.LOOPS_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[beta-download] Missing Supabase server configuration');
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    // Insert into Supabase
    const supabaseRes = await fetch(`${supabaseUrl}/rest/v1/Beta_Downloads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        email,
        phone: phone || null,
        created_at: new Date().toISOString(),
      }),
    });

    if (!supabaseRes.ok) {
      const errText = await supabaseRes.text();
      // Handle duplicate email gracefully
      if (supabaseRes.status === 409 || errText.includes('duplicate')) {
        return new Response(JSON.stringify({ error: 'This email has already signed up!' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      console.error('Supabase error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to sign up. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    // Post to Loops API
    if (loopsApiKey) {
      try {
        await createLoopsContact(loopsApiKey, {
          email,
          source: 'beta_download',
        });
      } catch (loopsErr) {
        // Log but don't fail the request if Loops fails
        console.error('Loops API error:', loopsErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Beta signup API error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
};
