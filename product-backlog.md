# Product Backlog

## In Progress

### WIN-001 — Packaged macOS builds do not reliably stay above true fullscreen apps
- Status: In Progress
- Version: 1.2.1
- Why it matters: Always on Top feels broken if Focana disappears behind native fullscreen apps.
- Files: `src/main/main.js`
- Related: —
- Notes: Baseline fullscreen strategy is `setAlwaysOnTop(true, 'screen-saver')` plus `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` on macOS. `86d3e4b` added `type: 'panel'` for main and floating windows, restored `skipTransformProcessType: true`, re-applied always-on-top on each window `show`, and set `fullscreenable: false` on the main window. `152f6dd` upgraded Electron to 41 and added the 3-second macOS re-assert loop, but dropped `skipTransformProcessType`. `f08d999` restored `skipTransformProcessType` for the fullscreen overlay path. `3b30d27` later introduced the packaged-only `!app.isPackaged` panel gating experiment; that made behavior worse and has been rolled back locally so real macOS runtime uses `type: 'panel'` again while Playwright E2E still skips panel for observability. User reported one earlier build appeared to stay above Codex and VS Code but not Terminal or Chrome; clean packaged smoke after the rollback still failed over true fullscreen apps, including Codex. Current interpretation: Electron/macOS fullscreen-space behavior remains unreliable even with the strongest documented window flags, so further BrowserWindow-level tweaks are low-confidence until we have a genuinely new angle. Future investigation options: (1) explicit `app.dock.hide()` -> create windows -> optional `app.dock.show()` workaround, with the known dock/icon/Cmd+Tab tradeoffs and duplicate-icon risk documented; (2) a cleaner accessory-mode spike using `app.setActivationPolicy('accessory')` before window creation as a fullscreen-overlay beta path rather than the dock hide/show dance.
- Commits: `86d3e4b`, `152f6dd`, `f08d999`, `3b30d27`

## Next Up

### LIC-001 — Local packaged smoke builds can opt into `password` via explicit env flag
- Status: Next Up
- Version: 1.2.1
- Why it matters: Packaged smoke testing should not require embedded Lemon config just to get through activation locally.
- Files: `src/main/licenseService.js`, `tests/license-service.test.js`
- Related: —
- Notes: Local work is present but not committed. Intended contract: packaged builds stay blocked by default, but `FOCANA_ALLOW_DEV_TEST_LICENSE=1` allows the existing `password` dev-test flow for local binary launches only.
- Commits: —

## Later

## Done

### WIN-002 — Compact task appeared missing during a broken local build/runtime state
- Status: Done
- Version: 1.2.0
- Why it matters: This looked like a product bug, but the current evidence points to a dirty local environment rather than a confirmed code regression.
- Files: `src/renderer/components/CompactMode.jsx`, `package.json`
- Related: —
- Notes: Task is now always visible in compact mode (`isTaskVisible = hasTaskLabel`). Settings toggle removed. Reopen only if it reproduces from a clean packaged build.
- Commits: `3b30d27`, `4afcad7`
