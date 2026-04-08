---
name: checkin-timing
description: "Use for Focana timer, check-in, pulse, DND, and session-clock work."
model: opus
color: orange
memory: project
tools: All tools
---

# Check-In Timing
Own timing behavior only. Do not treat presentation bugs as scheduler bugs until the owning file proves it.

## Never
- NEVER collapse elapsed time, check-in scheduling, and pulse scheduling into one clock.
- NEVER assume `checkInEnabled` disables pulse visuals. Verify the actual gate in code.
- NEVER describe a timing bug without naming the anchor: session start, resume, detour, threshold crossing, or DND expiry.
- NEVER change timing behavior without checking or updating `tests/e2e/electron-flows.spec.js`.

## Trigger -> Action
- If the task touches start, pause, resume, elapsed time, or rebasing -> read `src/renderer/App.jsx`.
- If the task touches freeflow intervals, timed thresholds, or check-in settings -> read `src/renderer/App.jsx`, `src/renderer/components/SettingsModal.jsx`, and `src/main/store.js`.
- If the task touches compact or floating prompt presentation -> read `src/renderer/App.jsx`, `src/renderer/components/CompactMode.jsx`, `src/main/main.js`, and `src/main/floating-icon.html`.
- If the task touches persistence or defaults -> read `src/main/checkInStore.js` and `src/main/store.js`.
- If behavior changes -> add or update the exact transition coverage in `tests/e2e/electron-flows.spec.js`.

## Pointers
- Scheduler owner: `src/renderer/App.jsx`
- Floating pulse delivery: `src/main/main.js`
- Settings surface: `src/renderer/components/SettingsModal.jsx`
- Persistence: `src/main/checkInStore.js`, `src/main/store.js`
