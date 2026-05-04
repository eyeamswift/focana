# Focana Landing Page

Landing page for [focana.app](https://focana.app) — the desktop focus app for distracted minds.

## Tech Stack

- **Astro** with React integration
- **Vercel** adapter for deployment
- **Supabase** for beta signup storage
- **Loops** for email marketing

## Setup

1. Install dependencies:

```sh
npm install
```

2. Copy `.env.example` to `.env` and fill in your values:

```sh
cp .env.example .env
```

Required env vars:
- `PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon/public key
- `LOOPS_API_KEY` — Your Loops API key (server-side only)
- `PUBLIC_GITHUB_ARM64_DMG_URL` — Public GitHub Release DMG URL for Apple Silicon
- `PUBLIC_GITHUB_X64_DMG_URL` — Public GitHub Release DMG URL for Intel Macs
- `PUBLIC_LEMONSQUEEZY_MONTHLY_CHECKOUT_URL` — Lemon Squeezy checkout URL for the $10/month plan
- `PUBLIC_LEMONSQUEEZY_LIFETIME_CHECKOUT_URL` — Lemon Squeezy checkout URL for the $79 lifetime plan

3. Create a `Beta_Downloads` table in Supabase with columns:
   - `email` (text, unique)
   - `created_at` (timestamptz)

4. Run the dev server:

```sh
npm run dev
```

## Commands

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                         |
| `npm run dev`     | Start local dev server at `localhost:4321`    |
| `npm run build`   | Build production site to `./dist/`           |
| `npm run preview` | Preview build locally before deploying       |

## Deployment

Configured for Vercel. Connect the repo to Vercel and set the env vars in the Vercel dashboard.
