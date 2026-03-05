import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, phone } = body;

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    const loopsApiKey = import.meta.env.LOOPS_API_KEY;

    // Insert into Supabase
    const supabaseRes = await fetch(`${supabaseUrl}/rest/v1/waitlist`, {
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
        return new Response(JSON.stringify({ error: 'This email is already on the waitlist!' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('Supabase error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to join waitlist. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Post to Loops API
    if (loopsApiKey) {
      try {
        await fetch('https://app.loops.so/api/v1/contacts/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loopsApiKey}`,
          },
          body: JSON.stringify({
            email,
            ...(phone ? { phone } : {}),
            source: 'waitlist',
          }),
        });
      } catch (loopsErr) {
        // Log but don't fail the request if Loops fails
        console.error('Loops API error:', loopsErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Waitlist API error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
