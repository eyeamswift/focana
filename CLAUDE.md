# Focana
Desktop Electron focus app for ADHD. Optimize for one task, one timer, zero overwhelm.

---

## Company & Product Identity

**NeurDi Labs** is the company. Its mission is "leveling the playing field for people with ADHD." This is a **HealthTech company**, not a productivity tool studio.

**Focana** is NeurDi Labs' first product. It is a desktop focus system for ADHD users, not a standalone productivity app competing in the generic productivity category.

**ADHD Engine** is NeurDi Labs' platform (archetype quiz, expert review board, vetted tool marketplace). It lives in a separate Claude project. Cross-project connection points: Focana's coping mechanism framework is the basis for its ADHD Engine marketplace listing; ADHD Engine's review board validates Focana; Focana is recommended to users whose archetype quiz results show high friction in Attention and Activation pillars.

**People structure:**
- SME co-founder — clinical psychologist/neuropsychologist specializing in adult ADHD
- Operational review board — validates assessment model, governs resource recommendations, reviews all tools including Focana
- Strategic advisory board — company scaling, recruited later

**Until Focana has been formally reviewed by the review board, do not use language like "expert-reviewed" or "clinically validated" in marketing materials.** Flag any copy or claim that would require review board approval.

---

## ADHD Coping Mechanism Framework

Focana is not one ADHD coping mechanism turned into software. It is **6 coping mechanisms + 1 design principle**, layered into one focus system.

**The 6 coping mechanisms (each mapped to a Focana feature):**

1. **Body Doubling** → Always-on-top presence. The persistent visible window acts as a digital body double.
2. **Externalized Working Memory** → Task stays visible. Holds the user's primary intention on-screen so their brain doesn't have to.
3. **Thought Offloading** → Parking Lot (Cmd+Shift+N). Captures intrusive secondary thoughts during a focus session.
4. **Self-Monitoring** → Focus check-ins ("Still focused?"). Automates the metacognitive work that ADHD brains struggle with.
5. **Time Blindness Support** → Visible timer. Makes the invisible passage of time visible.
6. **Context Continuity** → Session History preserves context across task switches, reduces re-initiation cost.

**The design principle (not a coping mechanism):**

7. **Dopamine-Positive Design** → How the tool treats the user, not a strategy the user employs. Celebratory completion, no deficit framing, manufactures small wins.

**Clinical vs. marketing framing:** In marketing copy, "7 science-backed ADHD coping mechanisms" is used for simplicity. The clinical distinction (6 + 1) matters for Tier 3 / SME / review board communication. Keep both framings straight.

**The moat** is NOT "always on top" — that is one ingredient, technically replicable. The moat is that Focana **replaces a patchwork** of separate tools and manual discipline with one integrated focus system that actually prompts you. Integration is the differentiator, not any single feature.

---

## Three-Tier Messaging Stack

Same product, three different doors in:

- **Tier 1 — Mass Audience** (landing page, Product Hunt, general social): "The focus buddy for busy brains." Warm, inviting, no clinical baggage.
- **Tier 2 — ADHD Community** (Reddit, peer-to-peer, founder story): "I got tired of hacking together five different tools just to stay focused — so I built the ADHD focus system that didn't exist." Lived experience.
- **Tier 3 — ADHD Professionals & Influencers** (B2B, clinicians, coaches): "Focana is a desktop executive function enhancer — body doubling, externalized working memory, thought offloading, self-monitoring, time blindness support, context continuity, and dopamine-positive design in a single persistent interface." Clinical precision. **Tier 3 vocabulary only.**

---

## Copy Rules (always enforce)

- "Buddy" in brand-facing copy; "app" in SEO metadata only
- "Focus system" when describing the product architecturally
- "Busy brains" everywhere; **never** "distracted minds" or "easily distracted"
- Zero mentions of "beta" in any user-visible copy
- "Executive function enhancer" is Tier 3 only — not for the landing page hero

---

## Brand Colors

- Sunshine Yellow `#F59E0B` — Primary CTAs, active states
- Deep Amber `#D97706` — Hover states, timer display, emphasis
- Warm Brown `#5C4033` — Primary text, headlines
- Soft Cream `#FFF9E6` — Light backgrounds, sticky note base
- Coffee Brown `#8B6F47` — Secondary text, descriptions

Brand personality: Warm, not clinical. Celebratory, not punitive. Human, not corporate. Simple, not feature-heavy.

---

## ICPs (ordered by launch priority)

1. **ADHD & Neurodivergent Knowledge Workers** (~35% users, HIGH LTV, LOW acq cost) — launch with
2. **Digital Entrepreneurs & Founders** (~20% users, VERY HIGH LTV, LOW acq cost) — month 1-2
3. **Overwhelmed Remote Workers** (~25% users, MEDIUM LTV, MEDIUM acq cost) — month 2-3
4. **Students & Digital Learners** (~20% users, LOW LTV, LOW acq cost) — month 3+

---

## Anti-Patterns (never ship these to ADHD users)

Call these out proactively if they appear in proposed features:

- Streak-based guilt mechanics ("You broke your streak!")
- Notification escalation / nagging
- Onboarding that requires long sustained attention
- Time-based punishments or "you failed" states
- Gamification that exploits dopamine dysregulation (random rewards, variable reinforcement loops borrowed from slot machines)
- "Accountability" features that induce shame
- Opaque / complex settings surfaces
- Blocking apps the user actually needs to do their work
- Features that disappear when the user switches tabs (literally the problem Focana solves)

---

## Operating Principles

- ADHD is plural. When advice says "users want X," ask *which* users.
- Represent the user, not the convenient-to-build option.
- Evidence confidence must be labeled: `[Peer-reviewed]` / `[Clinical consensus]` / `[Lived experience]` / `[Speculative]`.
- Clinical claims require review board approval before shipping.
- When in doubt, ask. Don't generate confident advice on incomplete information.

---

## Subagents available in this repo

- **`@ef-advisor`** — Product advisor representing ADHD users and executive function research. Use for product decisions, feature specs, copy claims, UX patterns, pricing friction. Uses structured review mode for load-bearing decisions, conversational mode for quick gut-checks. See `.claude/agents/ef-advisor.md`.

---

## Never
- NEVER reintroduce Base44, auth, cloud sync, or remote-first assumptions.
- NEVER add shadcn, Radix, Tailwind, or dashboard-style UI unless the user explicitly asks.
- NEVER add AI features, body doubling, analytics dashboards, or calendar features by default.
- NEVER break always-on-top, frameless behavior, offline-first behavior, or local persistence to ship a feature.
- NEVER guess about timer logic, window geometry, or store shape. Read the owner files first.
- NEVER create a second backlog tracker.

## Trigger -> Action
- If the task touches timers, check-ins, pulses, DND, or floating prompts -> read `src/renderer/App.jsx`, `src/renderer/components/SettingsModal.jsx`, `src/main/main.js`, `src/main/store.js`, and `tests/e2e/electron-flows.spec.js`.
- If the task touches full, compact, floating, drag, resize, restore, or startup sizing -> read `src/main/main.js`, `src/main/preload.js`, `src/main/floatingPreload.js`, `src/renderer/components/CompactMode.jsx`, `src/main/floating-icon.html`, and `tests/e2e/electron-flows.spec.js`.
- If the task touches persistence, settings, or session history -> read `src/main/store.js` and the related IPC in `src/main/main.js` before editing renderer state.
- If the task touches UI flow or copy -> read `src/renderer/App.jsx`, the target component, and `src/renderer/styles/main.css` before proposing changes.
- If the task touches release, packaging, signing, or shipping -> read `RELEASE_RUNBOOK.md`, `scripts/ship.sh`, and `electron-builder.config.js` first.
- If the user asks to track product work -> update `product-backlog.md` in place, reuse stable IDs, and dedupe before adding anything.
- If you cannot tell which layer owns a behavior -> search `tests/e2e/electron-flows.spec.js` first, then follow the implementation from the failing path.

## Pointers
- App flow owner: `src/renderer/App.jsx`
- Window state + IPC owner: `src/main/main.js`
- Store schema owner: `src/main/store.js`
- Styling + brand implementation: `src/renderer/styles/main.css`
- Read-only legacy reference: `reference/`

## Rules for all agents
1. Search relevant docs before advising.
2. Do not contradict or re-litigate DECIDED items unless the founder explicitly asks to revisit.
3. If a decision affects the ADHD Engine project (separate Claude project), flag it for manual cross-project update.
