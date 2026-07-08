# Session Log

One project-wide log of decisions and working sessions for Focana / NeurDi Labs. **One log for everything** — tag each entry by area (`[GTM]`, `[Product]`, `[Brand]`, `[Release]`, …). Newest first.

Each entry: date, area tag, what was decided/done, the reasoning, and any cross-doc / cross-project flags.

> This is the project *decision* log — not a record of in-app focus sessions.

---

### 2026-07-06 [GTM/Product] — Creator promo-code tracking v1 started, paused mid-build
- **Done:** Began implementing creator-code infrastructure for the ADHD creator pilot. Added landing/backend WIP in `/Users/swift/focana-landing`: `creator_campaigns` + `creator_code_claims` migration, creator-code claim/event APIs, creator checkout redirect, `/c/[slug]` creator page, Lemon webhook attribution for `creator_campaign`, and tests for the new helper. Started desktop WIP in `/Users/swift/focana`: license-service creator attribution, creator-aware checkout URL routing, IPC/preload hooks, store schema, and an optional in-app "creator trial code" entry panel.
- **Why:** supports audience-borrowing creator motion without cold-start ads; the tracking spine needs to connect creator code → trial claim/download → first completed session → checkout → paid license activation.
- **Paused / open:** user raised the key product question: "the creator code would be input at checkout, no?" Need decide next session whether creator codes are **checkout-only paid discount/affiliate codes** or **pre-checkout extended-trial codes that later pass attribution into checkout**. Current WIP leans toward trial-code-before-checkout plus invisible creator-attributed Lemon checkout; revisit before continuing.
- **Verification:** not run yet. Before shipping, run landing tests/build, desktop license tests, and `npm run build:renderer`; finish first-session event reporting and inspect the startup gate UI for overflow/warm copy.

### 2026-07-06 [GTM] — Channel mix set: three plays
- **Decided:** Distribution runs on three plays — **intent capture** (SEO / high-intent search + forum questions), **audience borrowing** (creators, podcasts, newsletters — the current creator pilot lives here), and **guerrilla marketing** (unconventional, community-native, low-cost moments).
- **Why:** organizes all channel work under three complementary, organic-first plays; the creator pilot is the first execution of the audience-borrowing play.
- **Open:** confirm the scope of each play; build out the intent-capture and guerrilla plans. (Definitions in `gtm.md` are `@gtm-strategist`'s read, pending founder confirmation.)

### 2026-07-06 [GTM] — Creator pilot assets built + committed
- **Done:** Wrote the creator outreach kit (`gtm-creator-kit.md`) and a vetted starter target list (`gtm-creator-targets.md` — 17 candidates, 6-creator "contact first" cohort, competitor conflict watchlist). Committed all GTM docs + the `@gtm-strategist` agent to `main` (`f07229a`).
- **Open / next:** verify the 6 cohort handles + live follower counts → draft 6 personalized first-touch messages → stand up promo-code/activation tracking (manual v1 for pilot; real build routes to main / `@ef-advisor`).
- **Flags:** all follower counts are second-hand — re-verify before outreach. Watch competing-product creators (ADHD Love/Dubbii, Dani Donovan/Anti-Planner, Shannon Mo, Hayley Honeyman).

### 2026-07-06 [GTM] — Primary distribution motion: ADHD creator partnerships (ICP #1–2)
- **Decided:** Lead GTM with organic, creator-led distribution to ADHD micro/mid creators (~10k–250k). B2B coach outreach deferred to phase 2. Clinician/psychiatrist channel gated on review-board validation (out of scope now, aside from clinician-influencer reach).
- **Why:** ICP #1–2 are low-acquisition-cost and trust-driven; creators deliver reach *and* pre-qualified leads without heavy cash spend or clinical-claim exposure. Coaches are a strong phase-2 beachhead but fragmented; clinicians force premature efficacy claims and medical-device positioning risk.
- **Plan:** see the Creator Program in `gtm.md`. Pilot cohort of 5–10; gift-first + affiliate + 30-day-trial code; measure activations + paid, not views.
- **Flags:** needs promo-code/affiliate infra (product dependency → main / `@ef-advisor`). Creators must avoid "clinically validated / expert-reviewed" (review-board gated). FTC `#ad` disclosure required. Cross-project: future clinician/coach validation ties to the ADHD Engine review board + marketplace listing.
