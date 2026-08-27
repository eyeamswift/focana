# Focana

Focana is a desktop focus app for ADHD users. This monorepo contains the Electron product and the web experience that supports discovery, checkout, downloads, licensing, feedback, and opt-in focus insights.

## Repository map

- `src/` — Electron main process and desktop React interface
- `web/` — Astro website, Lemon Squeezy checkout experience, Vercel APIs, and web analytics
- `supabase/` and `web/supabase/` — current Supabase function and migration sources; these remain separate during the first migration stage
- `scripts/` — desktop build, release, analytics, and cross-product release automation
- `tests/` and `web/tests/` — desktop and web test suites

## Common commands

```sh
npm run dev:desktop
npm run dev:web
npm run test:all
npm run build:renderer
npm run build:web
```

The desktop and web projects retain independent dependencies and deployment targets. GitHub Releases distributes the desktop app, while Vercel deploys from `web/`.
