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

### WIN-005 — Post-session flows should never restore to compact with no active task
- Priority: High
- Status: Next Up
- Version: 1.3.2
- Why it matters: Returning users to a blank compact shell after stop/completion feels broken and hides the next obvious action.
- Files: `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-003`
- Notes: Merge the duplicate blank-compact reports here and treat the compact/logo observation as part of the same issue unless a packaged-only repro proves otherwise. Desired rule: if stop/completion leaves no active task, restore the full idle shell instead of compact. Acceptance coverage should include `No, Save for Later`, `Yes, Complete`, and post-session parking-lot handoff paths.
- Commits: —

### SES-002 — System sleep should auto-pause a running session
- Priority: High
- Status: Next Up
- Version: 1.3.2
- Why it matters: Counting sleep time as focused time breaks trust and corrupts session history.
- Files: `src/main/main.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `SES-001`
- Notes: Expected behavior is auto-pause on sleep and explicit resume after wake; this should not use wall-clock catch-up. Current code has no sleep/wake handling, so this starts as a behavior gap plus verification task. Acceptance coverage should verify pause on sleep, cleared `sessionStartedAt`, and explicit resume on wake.
- Commits: —

### UX-003 — Session history should support moving completed/discarded work back to Resume
- Priority: High
- Status: Next Up
- Version: 1.3.2
- Why it matters: Users need a reversible way to recover work without starting from scratch or losing context.
- Files: `src/renderer/components/HistoryModal.jsx`, `src/renderer/components/TaskPreviewModal.jsx`, `src/renderer/App.jsx`
- Related: `QA-001`
- Notes: Add a recovery action for completed/discarded entries so they can become resumable again instead of being terminal states. Acceptance coverage should verify the item moves back to `Resume`, can be started again, and does not mutate historical records incorrectly.
- Commits: —

### QA-001 — Audit one-click destructive flows and remove unverified data-loss paths
- Priority: High
- Status: Next Up
- Version: 1.3.2
- Why it matters: Silent destructive actions are high-trust failures in a tool meant to reduce overwhelm.
- Files: `src/renderer/components/ParkingLot.jsx`, `src/renderer/components/HistoryModal.jsx`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-003`
- Notes: Audit delete, clear, start-task, discard, and post-session parking-lot actions. Add confirmation, undo, or state-safe recovery wherever the action is currently one click and irreversible. Acceptance coverage should prove parking lot, history, and post-session flows are confirmable, undoable, or otherwise recoverable.
- Commits: —

### UX-004 — Hour-plus timer formatting should still look active
- Priority: Medium
- Status: Next Up
- Version: 1.3.2
- Why it matters: Switching from `MM:SS` to `1h 02m` reads like a paused timer even when the clock is still running.
- Files: `src/renderer/utils/time.js`, `src/renderer/components/CompactMode.jsx`, `src/main/floating-icon.html`, `tests/e2e/electron-flows.spec.js`
- Related: `SES-002`
- Notes: Treat this as a display/trust issue, not a timer-engine rewrite. Keep elapsed-time semantics intact while making hour-plus timers visibly feel live across full, compact, and floating surfaces. Acceptance coverage should preserve existing parsing and confirm the timer still appears active after one hour.
- Commits: —

## Later

### UX-005 — Focus blocks should support a checklist of sub-tasks
- Priority: Medium
- Status: Later
- Version: 1.4.0
- Why it matters: A single work block often contains a short queue of concrete sub-tasks that users want to check off without losing the top-level focus.
- Files: `src/renderer/App.jsx`, `src/main/store.js`, relevant session UI components
- Related: `UX-003`
- Notes: This is not a Parking Lot enhancement. Model it as an active-session checklist under one block/task title, not as a flat note list. Acceptance coverage should confirm one focus block can hold multiple checkable sub-tasks without turning Parking Lot into the work queue.
- Commits: —

### SET-001 — Focana should launch at login by default with a settings toggle
- Priority: Medium
- Status: Later
- Version: 1.4.0
- Why it matters: Focana works best as a daily habit tool when it is already there at the start of the day, but users still need an easy way to turn that behavior off.
- Files: `src/main/main.js`, `src/renderer/components/SettingsModal.jsx`, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: —
- Notes: Default new installs to launch at login, surface the control in Settings, and persist the user’s choice so the app never silently turns itself back on after they disable it. Acceptance coverage should verify first-run default enabled, toggle-off persists, toggle-on restores startup launch, and platform-specific login-item wiring matches the saved setting.
- Commits: —

## Done

### LIC-001 — Local packaged smoke builds can opt into `password` via explicit env flag
- Status: Done
- Version: 1.2.1
- Why it matters: Packaged smoke testing should not require embedded Lemon config just to get through activation locally.
- Files: `src/main/licenseService.js`, `tests/license-service.test.js`, `scripts/packaged-smoke.js`
- Related: —
- Notes: Packaged builds stay blocked by default, but `FOCANA_ALLOW_DEV_TEST_LICENSE=1` now allows the existing `password` dev-test flow for local binary launches only. Coverage exists in unit tests for both blocked-by-default and opt-in activation, and the packaged smoke script now launches packaged binaries with the env flag set.
- Commits: —

### WIN-004 — Floating check-ins now restore compact-origin timed sessions correctly
- Status: Done
- Version: 1.2.1
- Why it matters: A timed session started in compact and then minimized to float could disappear at the first timed check-in threshold instead of restoring the compact prompt.
- Files: `src/main/main.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-003`
- Notes: The floating check-in handoff now distinguishes compact-origin sessions from full-window-origin sessions. Compact-origin float sessions reveal the existing pill and open the compact check-in prompt directly instead of waiting on a redundant compact re-entry. `bring-to-front` also restores window opacity if a hidden main window needs to be revealed. Regression coverage now includes the real compact -> float -> timed check-in path on a 1-minute timer, plus the existing full -> float path.
- Commits: —

### UX-002 — Compact positive check-ins now use an ember burst instead of a text toast
- Status: Done
- Version: 1.2.1
- Why it matters: The compact pill is too small for a sentence-style success message, especially when a floating session needs to return there and then minimize again quickly.
- Files: `src/renderer/App.jsx`, `src/renderer/components/CompactMode.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-004`
- Notes: Compact-mode positive check-ins no longer show the centered text toast. They now trigger a brief pill-local ember spark animation while keeping the task and timer visible. When the check-in originated from float, the compact pill stays on screen for the short cue and only then returns to float. Full-window check-in success behavior is unchanged.
- Commits: —

### WIN-002 — Compact task appeared missing during a broken local build/runtime state
- Status: Done
- Version: 1.2.0
- Why it matters: This looked like a product bug, but the current evidence points to a dirty local environment rather than a confirmed code regression.
- Files: `src/renderer/components/CompactMode.jsx`, `package.json`
- Related: —
- Notes: Task is now always visible in compact mode (`isTaskVisible = hasTaskLabel`). Settings toggle removed. A later first-render sizing regression for short tasks is tracked separately in `WIN-003`.
- Commits: `3b30d27`, `4afcad7`

### WIN-003 — Compact mode now expands to the task width on first entry
- Status: Done
- Version: 1.2.1
- Why it matters: Entering compact mode should not briefly lock into the timer-only shell and hide a running task, especially for shorter task names.
- Files: `src/renderer/components/CompactMode.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-002`
- Notes: Initial compact sizing now uses the settled width immediately instead of the timer-only base width. Regression coverage includes a short task (`List on Betalist`), regular running entry, and timed-session entry.
- Commits: —

### SES-001 — Quitting or restarting preserves the task but reopens paused
- Status: Done
- Version: 1.2.1
- Why it matters: Hidden wall-clock time after an app quit makes session history unreliable and feels surprising when the app relaunches.
- Files: `src/main/main.js`, `tests/e2e/electron-flows.spec.js`
- Related: —
- Notes: Quit and restart now freeze the running timer snapshot, preserve the active task, clear `sessionStartedAt`, and relaunch with the timer paused until the user explicitly resumes.
- Commits: —

### UX-001 — Rapid task submission no longer drops the last typed character
- Status: Done
- Version: 1.2.1
- Why it matters: Hitting Enter immediately after typing should submit the exact task the user sees, not a stale value missing the final character.
- Files: `src/renderer/App.jsx`, `src/renderer/components/TaskInput.jsx`
- Related: —
- Notes: Task submission now reads the live textarea value before opening the session chooser, so fast Enter presses and submit-button clicks keep the full task text.
- Commits: —
