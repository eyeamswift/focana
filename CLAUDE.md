# Focana
Desktop Electron focus app for ADHD. Optimize for one task, one timer, zero overwhelm.

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
