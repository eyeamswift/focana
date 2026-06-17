# Codex Workspace Instructions

Focana is a desktop Electron focus app for ADHD users. In this repo, treat UI work as product-sensitive HealthTech work: warm, low-friction, ADHD-aware, and careful with claims.

## UI Specialist Mode

Use this mode for any task that touches `src/renderer`, app copy, visual styling, flows, windows, modals, settings, onboarding, prompts, focus states, compact/floating modes, or screenshots.

### Product Posture

- Make the interface feel warm, not clinical; celebratory, not punitive; human, not corporate.
- Prefer calm, direct copy. Avoid shame, urgency theater, guilt mechanics, streak pressure, or "you failed" states.

### Design System

- Read `src/renderer/styles/main.css` before changing visual styles.
- Reuse existing CSS variables, shared components, and local patterns before adding new abstractions.
- Keep Focana's palette grounded in:
  - Sunshine Yellow `#F59E0B`
  - Ember / action amber `#B94E10`
  - Warm Brown `#4A3329`
  - Deep Cocoa `#2E1F18`
  - Soft Cream `#FFF9E6`
- Use `lucide-react` for icon buttons when an icon is needed.
- Reuse components from `src/renderer/components/ui` where possible.
- Do not add Tailwind, shadcn/ui, Radix, dashboard-style UI, or a new design system unless the user explicitly asks.
- Keep controls stable in size and layout. Text must not overflow buttons, cards, modals, compact mode, or floating surfaces at supported window sizes.

### ADHD-Friendly UX Checks

Before shipping a UI change, check whether it:

- Preserves visible task context and reduces re-initiation cost.
- Keeps important actions discoverable without adding visual noise.
- Avoids notification escalation, nagging, or punishment loops.
- Avoids long sustained-attention onboarding or dense settings surfaces.
- Handles empty, loading, disabled, error, and completion states without blame.
- Works in light and dark theme if the touched surface supports both.
- Preserves keyboard and screen-reader affordances for interactive elements.
- Does not break always-on-top, frameless, offline-first, or local-persistence assumptions.

### Files To Read First

- UI flow or copy: `src/renderer/App.jsx`, the target component, and `src/renderer/styles/main.css`.
- Shared UI component changes: inspect all current usages before changing the component API.
- Compact/floating/window behavior: `src/main/main.js`, `src/main/preload.js`, `src/main/floatingPreload.js`, `src/renderer/components/CompactMode.jsx`, `src/main/floating-icon.html`, and `tests/e2e/electron-flows.spec.js`.
- Persistence, settings, or session history: `src/main/store.js` and related IPC in `src/main/main.js`.
- Timers, check-ins, pulses, DND, or prompts: `src/renderer/App.jsx`, `src/renderer/components/SettingsModal.jsx`, `src/main/main.js`, `src/main/store.js`, and `tests/e2e/electron-flows.spec.js`.

### Verification

- For narrow UI-only edits, run `npm run build:renderer`.
- For flow, window, persistence, or Electron behavior changes, run `npm run test:e2e` when feasible.
- After substantial visual changes, start the app with `npm run dev` and verify the relevant screen visually in the browser/Electron app when feasible.
- If verification is skipped, state exactly why and what risk remains.

### Guardrails

- Never reintroduce Base44, auth, cloud sync, or remote-first assumptions.
- Never add AI features, analytics dashboards, body-doubling features, or calendar features by default.
- Never create a second backlog tracker; update `product-backlog.md` in place if product tracking is requested.
- If a decision affects the separate ADHD Engine project, flag it for manual cross-project update.
