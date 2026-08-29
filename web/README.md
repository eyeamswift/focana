# Focana Web

Website, checkout experience, and hosted APIs for [focana.app](https://focana.app). This project lives in the Focana monorepo alongside the desktop app.

## Tech Stack

- **Astro** with React integration
- **Vercel** adapter for deployment
- **Supabase** for beta signup storage
- **Loops** for email marketing

## Setup

1. From the repository root, install web dependencies:

```sh
npm --prefix web install
```

2. Copy `web/.env.example` to `web/.env` and fill in your values:

```sh
cp web/.env.example web/.env
```

Required env vars:
- `PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon/public key
- `LOOPS_API_KEY` — Your Loops API key (server-side only)
- `PUBLIC_GITHUB_ARM64_DMG_URL` — Public GitHub Release DMG URL for Apple Silicon
- `PUBLIC_GITHUB_X64_DMG_URL` — Public GitHub Release DMG URL for Intel Macs
- `PUBLIC_LEMONSQUEEZY_MONTHLY_CHECKOUT_URL` — Lemon Squeezy checkout URL for the $10/month plan
- `PUBLIC_LEMONSQUEEZY_LIFETIME_CHECKOUT_URL` — Lemon Squeezy checkout URL for the $79 lifetime plan

### Focus Fact article email

The desktop app posts explicit one-time article requests to `/api/focus-fact-email`. In Loops,
configure a transactional workflow for the `focus_fact_article_requested` event using
`articleTitle` and `articleUrl`. The payload sets `consentScope` to `one_time_article` and
`marketingConsent` to `false`; this event must not add the recipient to a newsletter or lifecycle
campaign. Loops receives an idempotency key per request so retries do not create duplicate sends.

3. Create a `Beta_Downloads` table in Supabase with columns:
   - `email` (text, unique)
   - `created_at` (timestamptz)

4. Run the dev server from the repository root:

```sh
npm run dev:web
```

## Commands

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm --prefix web install`     | Install web dependencies                         |
| `npm run dev:web`              | Start the web app at `localhost:4321`             |
| `npm run build:web`            | Build the web app to `web/dist/`                  |
| `npm run test:web`             | Run the web tests                                 |
| `npm --prefix web run preview` | Preview the built web app locally                 |

## Deployment

Configured for Vercel. Set the Vercel project root directory to `web` and keep the existing environment variables in the Vercel project.

Link a fresh clone to the existing Vercel project before running release automation:

```sh
vercel link --cwd web
```

The generated `web/.vercel/` directory is local-only and must not be committed.
