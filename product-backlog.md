# Product Backlog

## Blocked

### WIN-001 — Packaged macOS builds do not reliably stay above true fullscreen apps
- Status: Blocked
- Version: 1.2.1
- Why it matters: Always on Top feels broken if Focana disappears behind native fullscreen apps.
- Files: `src/main/main.js`
- Related: —
- Notes: Baseline fullscreen strategy is `setAlwaysOnTop(true, 'screen-saver')` plus `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` on macOS. `86d3e4b` added `type: 'panel'` for main and floating windows, restored `skipTransformProcessType: true`, re-applied always-on-top on each window `show`, and set `fullscreenable: false` on the main window. `152f6dd` upgraded Electron to 41 and added the 3-second macOS re-assert loop, but dropped `skipTransformProcessType`. `f08d999` restored `skipTransformProcessType` for the fullscreen overlay path. `3b30d27` later introduced the packaged-only `!app.isPackaged` panel gating experiment; that made behavior worse and has been rolled back locally so real macOS runtime uses `type: 'panel'` again while Playwright E2E still skips panel for observability. User reported one earlier build appeared to stay above Codex and VS Code but not Terminal or Chrome; clean packaged smoke after the rollback still failed over true fullscreen apps, including Codex. Current interpretation: Electron/macOS fullscreen-space behavior remains unreliable even with the strongest documented window flags, so further BrowserWindow-level tweaks are low-confidence until we have a genuinely new angle. Future investigation options: (1) explicit `app.dock.hide()` -> create windows -> optional `app.dock.show()` workaround, with the known dock/icon/Cmd+Tab tradeoffs and duplicate-icon risk documented; (2) a cleaner accessory-mode spike using `app.setActivationPolicy('accessory')` before window creation as a fullscreen-overlay beta path rather than the dock hide/show dance.
- Commits: `86d3e4b`, `152f6dd`, `f08d999`, `3b30d27`

## Next Up

### UX-006 — No active session should trigger re-entry nudges after five minutes
- Priority: High
- Status: Next Up
- Version: 1.3.2
- Why it matters: Focana helps once a session is running, but it currently goes quiet between sessions and depends on the user to remember to restart focus on their own.
- Files: `src/renderer/App.jsx`, `src/renderer/components/TaskInput.jsx`, `src/main/main.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-007`
- Notes: Start one shared re-entry timer whenever the app is ready, there is no active or resumable session, Do Not Disturb is off, and no blocking modal flow is open. Trigger after 5 minutes and vary the response by surface instead of building separate reminder systems: full-window idle should nudge the existing task input in place, while floating/logo state should hand off to the floating prompt flow. Startup counts as eligible time once the app is ready, and remaining time should carry across full-window and floating states instead of resetting on every surface change.
- Commits: —

### UX-007 — Floating logo should expand into a two-step start-session prompt
- Priority: High
- Status: Next Up
- Version: 1.3.2
- Why it matters: When the app is minimized and no session exists, the floating logo needs to become an active re-entry point rather than a passive brand mark the user has to remember to click.
- Files: `src/main/floating-icon.html`, `src/main/floatingPreload.js`, `src/main/main.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-006`
- Notes: Reuse the existing floating window rather than creating a new BrowserWindow. After the shared no-session timer expires in floating mode, expand the logo into a prompt that first asks what the user is working on and then offers `15m`, `25m`, `45m`, `Custom`, or `Freeflow`. Dismiss should snooze for `10 minutes`, `30 minutes`, `1 hour`, `2 hours`, or `Until I reopen`, with Escape and click-away defaulting to a 10-minute snooze. Starting from this prompt should reopen full Focana and route through the normal session-start flow.
- Commits: —

## Later

### UX-008 — Post-session feedback prompt should persist until dismissed and support optional written context
- Priority: Medium
- Status: Later
- Version: 1.4.0
- Why it matters: The current thumbs up/down prompt disappears too quickly, can fall back into `Did you finish?` before the user is done responding, and misses the qualitative context needed to understand why a session felt good or bad.
- Files: `src/renderer/App.jsx`, post-session feedback UI, relevant modal/flow components, `tests/e2e/electron-flows.spec.js`
- Related: `QA-001`
- Notes: Keep the post-session feedback prompt locked in place until the user explicitly responds or dismisses it instead of auto-clearing too fast. After a thumbs-up or thumbs-down selection, reveal an optional text box for extra context before moving on. Acceptance should verify the prompt does not immediately fall back to `Did you finish?`, can be dismissed intentionally, and preserves a smooth path whether the user leaves only a thumb reaction or also adds written feedback.
- Commits: —

### UX-009 — Check-ins should support keyboard shortcuts for quick responses
- Priority: Medium
- Status: Later
- Version: 1.4.0
- Why it matters: When a check-in appears, reaching for the mouse adds friction and can break focus, especially in compact or floating mode.
- Files: `src/renderer/App.jsx`, check-in prompt components, `src/main/main.js`, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-004`
- Notes: Add clear, discoverable hotkeys for the main check-in actions across full-window, compact, and floating restore flows. First pass should cover the common responses (`Yes`, `No`, and `Finished` where available), avoid conflicting with existing global shortcuts, and make the shortcut affordance visible in the prompt copy or buttons. Acceptance coverage should verify keyboard responses work on every check-in surface and still return to the correct window mode afterward.
- Commits: —

### WIN-006 — Focana should support a temporary peek-through transparency mode
- Priority: Medium
- Status: Later
- Version: 1.4.0
- Why it matters: An always-on-top focus window sometimes blocks links, form fields, or reference material the user only needs to touch for a few seconds. They need a fast "let me reach what's behind this" escape hatch without dismissing or moving Focana.
- Files: `src/main/main.js`, floating window plumbing, shortcut registration, context-menu affordances, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-001`
- Notes: Recommendation is a dedicated shortcut-driven `Peek Through` mode rather than long-click or double-click. Long-click conflicts with dragging, and double-click is too easy to trigger accidentally while also overloading the current click model. First pass should use a shortcut such as `Cmd/Ctrl+Shift+T` to toggle a temporary low-opacity, click-through state for the active Focana window, with obvious visual feedback and easy restore by repeating the shortcut, clicking a restore affordance, or timing out after a short interval. Context-menu access can follow as a secondary affordance once the shortcut flow exists.
- Commits: —

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

### SES-003 — Running timers should support adding more time before time is up
- Priority: Medium
- Status: Later
- Version: 1.4.0
- Why it matters: Users often realize mid-session that they need a little more time and should be able to extend the current timer without waiting for the time-up interruption.
- Files: `src/renderer/App.jsx`, active timer controls, compact/floating timer surfaces, `tests/e2e/electron-flows.spec.js`
- Related: `SES-002`
- Notes: Scope this as an in-session add-time control for active timed sessions, not just the existing post-expiry time-up flow. First pass should make it easy to add a few common increments plus a custom amount, update the visible timer immediately across full, compact, and floating surfaces, and preserve check-in/pulse timing in a predictable way after the extension.
- Commits: —

### I18N-001 — Focana should support multiple languages across payments, site, and app
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Focana should feel native from discovery through purchase and daily use, not English-only at the site, checkout, or in-product layers.
- Files: `src/renderer/App.jsx`, shared UI copy/components, translation resource loading, licensing/checkout localization config, marketing site content system
- Related: —
- Notes: Scope this as end-to-end localization, not just translating in-app strings. First pass should support a shared translation framework, language detection plus a manual language selector, localized website copy, localized payment/checkout surfaces where supported, and app copy that stays aligned with the same language choice. Acceptance should verify a user can discover, buy, activate, and use Focana in a supported language without mixed-language seams.
- Commits: —

### ANA-001 — Goal tracking should roll up focus time by project or theme
- Priority: Low
- Status: Later
- Version: TBD
- Why it matters: Once session analytics ships, users should be able to see where their attention actually went, such as "I focused 3 hours this week on Project X."
- Files: `src/main/store.js`, session history aggregation, future analytics surfaces
- Related: `ANA-002`
- Notes: Do not pull this into the current roadmap. Revisit after session analytics and pattern views ship as part of the planned Phase 2 premium work. First pass should read from existing session history rather than creating a separate manual tracking workflow.
- Commits: —

### TASK-001 — Recurring tasks should support reusable scheduled presets
- Priority: Low
- Status: Later
- Version: TBD
- Why it matters: Repeated obligations like weekly expense reports are easier to start when the task already exists as a preset instead of being recreated from scratch every time.
- Files: `src/renderer/App.jsx`, `src/main/store.js`, future task scheduling UI
- Related: —
- Notes: Natural evolution for the task model, but not for the current cycle. Scope this as recurring task presets like "Every Monday I need to do expense reports," not as full calendar integration.
- Commits: —

### ANA-002 — Goal setting should support intentional focus targets
- Priority: Low
- Status: Later
- Version: TBD
- Why it matters: Some users want to set an explicit target, like "I want to focus 2 hours a day," and compare that intent against real focus time.
- Files: `src/main/store.js`, goal configuration UI, future analytics surfaces
- Related: `ANA-001`
- Notes: Treat this as a later companion to analytics, not a standalone near-term feature. Revisit after the planned analytics dashboard exists so goals can be measured against actual session patterns instead of becoming a disconnected reminder system.
- Commits: —

## Done

### WIN-005 — Post-session flows should never restore to compact with no active task
- Status: Done
- Version: 1.3.2
- Why it matters: Returning users to a blank compact shell after stop/completion feels broken and hides the next obvious action.
- Files: `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-003`
- Notes: Stop/completion flows now restore the full idle shell instead of falling back to a blank compact state when no active task remains. Regression coverage includes `No, Save for Later`, `Yes, Complete`, and the post-session parking-lot handoff path returning to the full idle shell.
- Commits: `2bd92a9`

### SES-002 — System sleep should auto-pause a running session
- Status: Done
- Version: 1.3.2
- Why it matters: Counting sleep time as focused time breaks trust and corrupts session history.
- Files: `src/main/main.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `SES-001`
- Notes: The app now pauses active sessions on system sleep, preserves the paused snapshot through wake, and requires explicit resume instead of counting slept time. Regression coverage verifies pause on sleep, cleared `sessionStartedAt`, and resume behavior after wake.
- Commits: `2bd92a9`

### UX-003 — Session history should support moving completed/discarded work back to Resume
- Status: Done
- Version: 1.3.2
- Why it matters: Users need a reversible way to recover work without starting from scratch or losing context.
- Files: `src/renderer/components/HistoryModal.jsx`, `src/renderer/components/TaskPreviewModal.jsx`, `src/renderer/App.jsx`
- Related: `QA-001`
- Notes: Completed and discarded sessions can now be restored back to `Resume` instead of remaining terminal history states. Regression coverage verifies the item moves back to `Resume`, can be started again, and preserves historical data correctly.
- Commits: `2bd92a9`

### QA-001 — Audit one-click destructive flows and remove unverified data-loss paths
- Status: Done
- Version: 1.3.2
- Why it matters: Silent destructive actions are high-trust failures in a tool meant to reduce overwhelm.
- Files: `src/renderer/components/ParkingLot.jsx`, `src/renderer/components/HistoryModal.jsx`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-003`
- Notes: Destructive paths in parking lot, history, and post-session flows now require confirmation or preserve recoverable state instead of silently discarding user work. Regression coverage includes history delete confirmation, parking lot destructive confirmation, and the post-session parking-lot dismiss confirmation path.
- Commits: `2bd92a9`

### UX-004 — Hour-plus timer formatting should still look active
- Status: Done
- Version: 1.3.2
- Why it matters: Switching from `MM:SS` to `1h 02m` reads like a paused timer even when the clock is still running.
- Files: `src/renderer/utils/time.js`, `src/renderer/components/CompactMode.jsx`, `src/main/floating-icon.html`, `tests/e2e/electron-flows.spec.js`
- Related: `SES-002`
- Notes: Hour-plus timers now stay visibly active across full, compact, and floating surfaces without changing timer semantics. Regression coverage verifies the active presentation after one hour in each surface.
- Commits: `2bd92a9`

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
