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

### SET-003 — Auto-launch should feel polished and context-aware after login launch
- Priority: High
- Status: In Progress
- Version: 1.7.0
- Why it matters: If launch-at-login feels abrupt, noisy, or ambiguous, the default-on behavior can feel like the app is happening to the user instead of quietly supporting them.
- Files: `src/main/main.js`, `src/renderer/App.jsx`, `src/main/store.js`, `src/renderer/components/SettingsModal.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `SET-001`, `SES-001`, `SES-002`
- Notes: Treat this as a polish pass on the shipped launch-at-login foundation, not a rethink of the default-on decision. The near-term path assumes Focana is a resident app after login, so wake/unlock behavior should be modeled as runtime re-entry on an already-running process rather than as a brand-new cold launch. The current `1.7.0` candidate on `main` is the float-first resident path: system-initiated login/wake flows minimize to floating first, then surface `Ready to resume?` or `What's next?` after the system-entry delay; manual launch stays on the idle shell; first-launch activation and preferred-name gates still win immediately. Tomorrow's validation pass should cover first launch, launch+login, wake+login, wake+resume, manual launch, and in-app restart. Keep `package.json` at `1.6.0` until the release-prep pass and packaged testing signoff are complete.
- Commits: `d2700ef`, `2876141`

### UX-014 — Pre-session and post-session boundary screens should feel polished and decisive
- Priority: High
- Status: Next Up
- Version: 1.7.0
- Why it matters: The moments right before starting and right after finishing are where users either carry momentum forward or drift away. If those screens feel clumsy, the core focus loop loses trust at both edges.
- Files: `src/renderer/App.jsx`, `src/renderer/components/PostSessionPrompt.jsx`, `src/renderer/components/TimeUpModal.jsx`, start-session and save-for-later surfaces, `tests/e2e/electron-flows.spec.js`
- Related: `UX-010`, `UX-011`, `UX-013`, `TASK-002`
- Notes: Do a holistic polish pass across the session-boundary surfaces rather than treating pre-session and post-session as unrelated tweaks. Refine the ready/start flow so beginning work feels crisp, then tighten `Session Wrap`, `Save for Later`, and adjacent copy/actions so ending a session always scripts the next obvious move. Prefer visible-state clarity over extra ceremony, keep the highest-confidence next action easy to choose, and make the before and after screens feel like one coherent loop instead of separate features that happen to touch the timer. Acceptance should verify clean manual startup into the ready shell, predictable start-task handoff, polished `Session Wrap` child paths, and save-for-later transitions that preserve context without awkward dead ends.
- Commits: —

### UX-018 — What's Next should make the start action obvious while planning
- Priority: High
- Status: Next Up
- Version: 1.7.0
- Why it matters: If the `What's next?` options are confusing or the visible start arrow disappears while someone is typing, the screen can look like there is no way to begin. Users should not have to discover that Enter starts the task by accident.
- Files: `src/renderer/App.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/renderer/components/SessionBuilderComposer.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-014`, `UX-016`, `TASK-002`, `UX-005`
- Notes: Revisit the `What's next?` screen options and labels so the choices feel direct, distinct, and low-friction. Add a visible `Quick start` button next to `Add subtask` on the planning surface so a user who is typing still sees an obvious way to begin, even when the arrow affordance is hidden and Enter is the keyboard shortcut. The button should start the current typed task/plan through the same path as Enter, preserve the subtask planning context, and stay stable at supported window sizes. Acceptance should verify the confusing options are simplified, typing never leaves the screen without an obvious start control, `Quick start` works with mouse, keyboard, and screen readers, and the layout does not overflow in full, compact-origin, or floating re-entry paths.
- Commits: —

### UX-016 — Re-entry nudges should never interrupt active typing
- Priority: High
- Status: Next Up
- Version: 1.7.0
- Why it matters: If the user is typing in the `What's next?` field, Focana has already regained their attention. Pulsing, refocusing, or clearing draft text at that moment makes the re-entry prompt feel intrusive and can break trust in the resident app behavior.
- Files: `src/renderer/App.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/main/main.js`, `tests/e2e/electron-flows.spec.js`
- Related: `SET-003`, `UX-014`, `UX-006`, `WIN-008`
- Notes: Treat typing in the re-entry prompt as active engagement. Suppress or postpone re-entry pulses while the task field is focused, while the prompt has unsaved draft text, or during a short grace window after text input. Protect `reentrySurfaceTaskText` from being overwritten by timer ticks, pulse state, prompt reopen/signature refreshes, or duplicate resident-window events unless the user explicitly chooses a new source, snoozes, closes, or starts the task. Acceptance should verify that a scheduled pulse does not fire mid-typing, that draft text survives any prompt attention refresh, and that packaged/dev duplicate-instance testing does not allow one Focana instance to clear another instance's active draft.
- Commits: —

### UX-015 — Pause and break flows should help users pick up where they left off
- Priority: High
- Status: Next Up
- Version: 1.7.0
- Why it matters: Pausing or taking a break is often when the thread of the work is most fragile. Focana should make the next step easy to recover without turning a quick pause into paperwork.
- Files: `src/renderer/App.jsx`, `src/renderer/components/PostSessionPrompt.jsx`, `src/renderer/components/SessionNotesModal.jsx`, pause/resume surfaces, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-011`, `UX-014`, `UX-010`, `SES-001`, `UX-006`
- Notes: Add a lightweight `Where should we pick up?` handoff for two intentional exits: manual `Pause` during a running session and `Take a break` from `Session Wrap`. The first pass should reuse the existing split `Immediate next step` / `Additional details` note model, let users skip quickly, and carry the latest pick-up note into the paused resume shell, break timer, and floating resume prompt. Keep elapsed-time semantics unchanged for timed and Freeflow sessions, avoid duplicating `Save for Later` or `Done for now`, and make the note feel like a helpful optional bookmark instead of a blocking modal. Acceptance should verify pause-note-to-resume, break-note-to-break-timer-to-resume, one-click skip paths, and relaunch recovery while paused or on break.
- Commits: —

### LIC-002 — Focana should offer a 7-day free trial before $79 lifetime or $10/month
- Priority: High
- Status: Next Up
- Version: 1.7.0
- Why it matters: Users need a low-friction way to experience the full focus loop before paying, but the upgrade path still has to be clear, simple, and trustworthy once the trial ends.
- Files: `src/main/licenseService.js`, `src/main/licenseConfig.js`, `src/main/main.js`, `src/renderer/App.jsx`, `src/renderer/components/SettingsModal.jsx`, checkout/activation surfaces, `tests/license-service.test.js`, `tests/e2e/electron-flows.spec.js`
- Related: `LIC-001`, `SET-002`, `I18N-001`
- Notes: Replace the current license-first posture with a `7-day` free-trial model that transitions into two purchase options: `$79` lifetime or `$10/month`. Scope the first pass end-to-end so trial state, checkout or variant mapping, first-run messaging, expiry gating, restore and re-validate behavior, and settings/account surfaces all agree on what the user currently has and what happens next. Keep the upgrade UX calm and explicit rather than punitive, and make sure existing paid licenses, offline grace behavior, and packaged/dev-test flows continue to work without ambiguity. Acceptance should verify a new install enters trial automatically, trial expiry routes the user into the correct upgrade choices, both paid paths activate successfully, and relaunch/validation flows preserve the right entitlement state.
- Commits: —

### MKT-001 — Lifecycle emails should cover trial, checkout, and license activation
- Priority: High
- Status: Next Up
- Version: 2.2.3
- Why it matters: The new 7-day trial and day-8 paywall need calm, useful follow-up outside the app so users understand what happens next without feeling nagged or surprised.
- Files: `supabase/functions/loops-lifecycle/index.ts`, `supabase/functions/loops-lifecycle/README.md`, Loops workflows, Supabase secrets, future lifecycle event callers
- Related: `LIC-002`, `MKT-002`, `MKT-003`
- Notes: Finish the Loops lifecycle path now that the Supabase bridge exists. Ask Loops support to enable Workflows API alpha access for the `Focana` team so workflows can be inspected by CLI; until then, manage workflow structure in the Loops dashboard and verify by sending events through Supabase. Starting workflow triggers should be `trial_started`, `trial_day_6`, `trial_expired`, `checkout_started`, and `license_activated`. Keep copy practical and non-punitive: welcome users, remind them before trial end, explain day-8 choices, follow up on checkout-started/no-activation, and acknowledge successful activation with a short next-step orientation. Acceptance should verify each event can be sent through the hosted Supabase function, reaches Loops, and triggers the intended dashboard workflow without creating duplicate contacts.
- Commits: —

### MKT-002 — Existing users should get a clear lifetime-upgrade outreach sequence
- Priority: High
- Status: Next Up
- Version: 2.2.3
- Why it matters: Current and early users are the highest-trust audience for the paid launch. They should hear directly that lifetime is available, why it exists, and how to choose it without being pushed into a confusing subscription path.
- Files: Loops campaigns, Loops audience segments, Lemon checkout links, customer/user export source, campaign copy
- Related: `LIC-002`, `MKT-001`, `MKT-004`
- Notes: Create a one-time outreach pass for existing users, with a special emphasis on the lifetime upgrade. Segment at minimum into founding/early users, active trial users, and prior downloaders or interested users where data is available. Message should be direct and appreciative: what changed, what the lifetime option includes, the monthly alternative, and what happens after checkout with the license key email. Avoid scarcity pressure, guilt, or over-emailing. Acceptance should include reviewed email copy, verified checkout links for monthly and lifetime, a test send, and a send/holdout plan that tracks opens, clicks, replies, purchases, and license activations.
- Commits: —

### MKT-003 — Landing page should match the 7-day trial and lifetime/monthly offer
- Priority: High
- Status: Next Up
- Version: 2.2.3
- Why it matters: The app, checkout, emails, and website all need to tell the same story. If the landing page still describes an older purchase flow, users will arrive at the trial/paywall with avoidable uncertainty.
- Files: marketing site or landing-page repo, `release-notes/2.2.3.json`, Lemon checkout URLs, pricing copy, download CTA
- Related: `LIC-002`, `MKT-001`, `MKT-002`
- Notes: Refresh the landing page around the actual first-run promise: download Focana, use the full app free for 7 days, then choose `$10/month` or `$79 lifetime`. The first viewport should make Focana's ADHD-friendly focus loop immediately concrete, not just describe productivity in generic terms. Add pricing clarity, license-key-after-checkout expectations, a short "who this is for" section, and a calmer paid-upgrade explanation that matches the day-8 screen. Acceptance should verify the landing page CTA, price points, download flow, checkout links, and app paywall copy all agree.
- Commits: —

### MKT-004 — Marketing plan should restart as a weekly learning loop
- Priority: High
- Status: Next Up
- Version: 2.2.3
- Why it matters: Focana needs a repeatable path back to users and buyers, not just a release followed by scattered one-off posts.
- Files: marketing plan, Loops campaign calendar, landing page, user interview/reply tracker
- Related: `MKT-002`, `MKT-003`, `LIC-002`
- Notes: Build a lightweight marketing plan around one weekly loop: choose a target audience, publish or send one clear message, talk to users who reply, inspect conversion signals, and update the next message. Near-term channels should include existing users, founding members, direct user outreach, the landing page, product directories or launch channels already on the radar, and follow-up emails for trial/paywall behavior. Track a small metric set: downloads, trial starts, day-8 paywall views, checkout clicks, lifetime purchases, monthly starts, activations, replies, and unsubscribes. Acceptance should produce a 2-week campaign calendar, first outreach copy, landing page task list, and a simple weekly review ritual.
- Commits: —

## Later

### TASK-002 — Session planning should require a project-based task hierarchy
- Priority: High
- Status: Later
- Version: TBD
- Why it matters: Flat task entry makes it too easy to start vague work. Requiring a parent/child structure pushes users to name the project and break the work into concrete, intentional units before they spend time on it.
- Files: `src/renderer/App.jsx`, `src/main/store.js`, session start flow, future queue/planning UI
- Related: `UX-005`, `ANA-001`, `TASK-001`
- Notes: Add a project-based task queue that forces intentional structure before focus starts. Users should have to identify either `Project -> Task` or `Task -> Subtask` before beginning a session, rather than entering one flat line and improvising from there. First pass should support a lightweight queue under the chosen parent item, make it easy to break work into the next concrete steps, and let the active focus block pull from that queue while preserving the parent context. This is broader than the in-session checklist in `UX-005`, but it should still avoid turning Focana into a heavyweight project-management board.
- Commits: —

### UX-005 — Focus blocks should support a checklist of sub-tasks
- Priority: High
- Status: Later
- Version: TBD
- Why it matters: A single work block often contains a short queue of concrete sub-tasks that users want to check off without losing the top-level focus.
- Files: `src/renderer/App.jsx`, `src/main/store.js`, relevant session UI components
- Related: `UX-003`, `TASK-002`
- Notes: Model it as an active-session checklist under one block or task title, not as a Parking Lot enhancement or flat note list. First pass should let the user take the structured plan they created and work through the next concrete steps inside the active session without losing the parent project or task context. Acceptance coverage should confirm one focus block can hold multiple checkable sub-tasks without turning Parking Lot into the work queue.
- Commits: —

### UX-013 — Cosmetic pass should remove redundant ceremony and obvious state toasts
- Priority: High
- Status: Later
- Version: TBD
- Why it matters: When Focana repeats state changes the user just watched happen, the interface can feel performative instead of supportive. The cosmetic pass should trust visible UI state, simplify copy, and keep celebration moments singular.
- Files: `src/renderer/App.jsx`, `src/renderer/components/TimeUpModal.jsx`, startup/re-entry/check-in surfaces, `tests/e2e/electron-flows.spec.js`
- Related: `UX-010`, `UX-007A`, `UX-008`
- Notes: Add the remaining cosmetic cleanup to the current pass. Change the Time Up secondary action copy from `No, Save for Later` to `Save for Later` so it does not imply a missing antecedent question. Remove ceremonial state toasts that confirm changes the user already saw: `Session started`, `Session paused`, `Compact Mode On/Off`, `Enter a task to start timer`, and `Nice to meet you, {name}.` The new `Session Wrap` celebration should carry the completion moment on its own, so delete the `showCompletedSessionMessage()` call sites that currently stack a toast with confetti right before the wrap surface opens. Reduce preferred-name interpolation on check-ins so it is never always-on; either remove it entirely or gate it to a low-frequency sample (`~30%` max) to avoid sounding performative. Acceptance should verify the simplified Time Up copy, absence of the redundant toasts, single-celebration behavior on `Session Wrap`, and lower-dose name usage on check-ins.
- Commits: —

### SET-004 — Focana should support wake-plus-unlock launch even when the app is not already running
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: The resident-app model covers wake/unlock only while Focana is already alive. Users who expect the app to appear after wake+password even when it is not running need a separate background-launch strategy.
- Files: macOS helper or launch-agent packaging, `src/main/main.js`, startup handoff plumbing, release/signing flow, `tests/e2e/electron-flows.spec.js`
- Related: `SET-003`, `SET-001`
- Notes: Scope this as a helper or LaunchAgent project, not as a tweak to the current Electron main-process listeners. Electron can observe `unlock-screen` only while the app is already running, so the current resident-app direction is the near-term path. A later pass can investigate a dedicated macOS helper that stays alive across the user session, listens for wake/unlock or related session-activation signals, and relaunches or signals the main Focana app when needed. Acceptance should verify wake+password can surface Focana even after the user fully closed the main app, without breaking ordinary login launch, explicit quit behavior, or macOS signing/notarization.
- Commits: —

### UX-006 — Re-entry timing should be fully hardened after the 1.4.0 break flow lands
- Priority: High
- Status: Later
- Version: TBD
- Why it matters: The thin break/re-entry slice in `1.4.0` will cover the new post-session flow, but the wider reminder system still needs a full trust pass so nudges always feel intentional instead of random or sticky.
- Files: `src/renderer/App.jsx`, `src/renderer/components/TaskInput.jsx`, `src/main/main.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-010`, `UX-007A`
- Notes: Finish the shared re-entry timer hardening after `1.4.0`: persist remaining delay and snooze state across relaunch, keep remaining time consistent across full-window and floating surfaces, suppress nudges immediately for Do Not Disturb, paused sessions, update/license blockers, and pause countdown across system sleep/hibernate so wake resumes from the remaining awake time instead of treating sleep as idle.
- Commits: —

### UX-017 — Long focus sessions should offer a gentle take-a-break nudge
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Long uninterrupted sessions can help users stay locked in, but after a while they may need a humane prompt to pause, reset, hydrate, stretch, or decide intentionally to keep going.
- Files: `src/renderer/App.jsx`, active timer/check-in surfaces, break timer surfaces, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-015`, `UX-006`, `UX-007B`, `SES-003`
- Notes: Add a calm long-session nudge after sustained focus, starting with a `90 minutes` threshold and copy like `You've been at it for 90 minutes. Want to take a real break?` This should be an invitation, not an interruption or warning: offer `Take a break`, `Keep going`, and a lightweight snooze option, respect Do Not Disturb and active typing/editing, and avoid resetting the user's task context. The nudge should work across full, compact, and floating timer surfaces, and should not fire repeatedly after the user responds. Acceptance should verify threshold timing, snooze/keep-going behavior, break handoff, relaunch persistence, and no surprise prompts during paused sessions, system sleep, modal flows, or active text entry.
- Commits: —

### SES-003 — Running timers should support adding more time before time is up
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Users often realize mid-session that they need a little more time and should be able to extend the current timer without waiting for the time-up interruption.
- Files: `src/renderer/App.jsx`, active timer controls, compact/floating timer surfaces, `tests/e2e/electron-flows.spec.js`
- Related: `SES-002`
- Notes: Scope this as an in-session add-time control for active timed sessions, not just the existing post-expiry time-up flow. First pass should make it easy to add a few common increments plus a custom amount, update the visible timer immediately across full, compact, and floating surfaces, and preserve check-in/pulse timing in a predictable way after the extension.
- Commits: —

### UX-007A — Floating re-entry prompt should finish its snooze and collapse behavior
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: The floating prompt becomes much more trustworthy when dismissing it feels lightweight and predictable instead of sticky.
- Files: `src/main/floating-icon.html`, `src/main/floatingPreload.js`, `src/main/main.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-006`
- Notes: Complete the existing floating re-entry prompt behavior before adding new timer modes. Escape and click-away should snooze for `10 minutes`, choosing a snooze in the floating re-entry flow should collapse immediately to minimized floating by default, and the window sizing/animation should feel clean through every prompt stage. Treat the minimized float state as the quiet default after snooze rather than restoring the larger prompt surface.
- Commits: —

### WIN-008 — Floating logo should not pulse while re-entry is snoozed
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Snooze is supposed to buy quiet time. If the floating logo keeps pulsing anyway, the app feels like it ignored the user’s choice and the snooze becomes hard to trust.
- Files: `src/renderer/App.jsx`, `src/main/main.js`, `src/main/floating-icon.html`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-006`, `UX-007A`
- Notes: Treat this as a bug, not a new cue design. When re-entry is snoozed, suppress both the floating prompt and the floating logo pulse until the snooze expires or the user explicitly reopens the app. Acceptance should verify that choosing any snooze option collapses back to the icon without follow-up pulse animations during the snooze window.
- Commits: —

### UX-007B — Floating re-entry should support Pomodoro as a first-class start mode
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Pomodoro is a meaningful new timer mode, not just a prompt tweak, and it should land after the post-session and re-entry foundations are solid.
- Files: `src/main/floating-icon.html`, `src/main/floatingPreload.js`, `src/main/main.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-006`, `UX-007A`
- Notes: Add `Pomodoro` to the existing start-session flow rather than creating a parallel entry path. The mode should manage work/break cycling, skip the normal single-session time-up path, and keep history/check-in semantics predictable across chained intervals.
- Commits: —

### WIN-006 — Focana should support a temporary peek-through transparency mode
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: An always-on-top focus window sometimes blocks links, form fields, or reference material the user only needs to touch for a few seconds. They need a fast "let me reach what's behind this" escape hatch without dismissing or moving Focana.
- Files: `src/main/main.js`, floating window plumbing, shortcut registration, context-menu affordances, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-001`
- Notes: Recommendation is a dedicated shortcut-driven `Peek Through` mode rather than long-click or double-click. Long-click conflicts with dragging, and double-click is too easy to trigger accidentally while also overloading the current click model. First pass should use a shortcut such as `Cmd/Ctrl+Shift+T` to toggle a temporary low-opacity, click-through state for the active Focana window, with obvious visual feedback and easy restore by repeating the shortcut, clicking a restore affordance, or timing out after a short interval. Context-menu access can follow as a secondary affordance once the shortcut flow exists.
- Commits: —

### WIN-007 — Minimize to floating should relocate to the nearest display edge
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: If the floating window lands in an arbitrary or stale position after minimize, it feels sloppy and takes extra mouse work to recover. The minimize action should leave Focana tucked into the closest natural edge of the display the user is already working on.
- Files: `src/main/main.js`, floating window positioning logic, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-010`, `WIN-006`
- Notes: When the user minimizes to floating, place the floating window on the nearest edge of the current display work area instead of reusing an unrelated old coordinate. First pass should determine the active display from the main window being minimized, choose the closest edge based on the window position at the moment of minimize, clamp the result fully on-screen, and avoid jumping to a different monitor unless the source window is already there.
- Commits: —

### UX-008 — Post-session feedback prompt should persist until dismissed and support optional written context
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: The current thumbs up/down prompt disappears too quickly, can fall back into `Did you finish?` before the user is done responding, misses the qualitative context needed to understand why a session felt good or bad, and skips the quick encouragement moment users should feel before being asked for feedback.
- Files: `src/renderer/App.jsx`, post-session feedback UI, relevant modal/flow components, `tests/e2e/electron-flows.spec.js`
- Related: `QA-001`
- Notes: Keep the post-session feedback prompt locked in place until the user explicitly responds or dismisses it instead of auto-clearing too fast. Before the thumbs-up/down prompt appears, show a brief `Good job` acknowledgement for any ended session, including `No, Save for Later`, so feedback feels like a follow-up instead of the first thing Focana says. After a thumbs-up or thumbs-down selection, reveal an optional text box for extra context before moving on. Acceptance should verify the prompt does not immediately fall back to `Did you finish?`, can be dismissed intentionally, and preserves a smooth path whether the user leaves only a thumb reaction or also adds written feedback.
- Commits: —

### UX-012 — Post-session encouragement should surface rotating “Did you know?” tips
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Helpful features like keyboard shortcuts are easy to miss if users never stumble into them. A lightweight post-session teaching moment can help users get more out of Focana without interrupting active focus.
- Files: `src/renderer/App.jsx`, post-session acknowledgment/feedback UI, shortcut copy source, `tests/e2e/electron-flows.spec.js`
- Related: `UX-008`, `UX-009`
- Notes: Use the positive post-session acknowledgement as the education surface rather than creating a separate tutorial system. First pass should support short rotating `Did you know?` tips inside or immediately after the `Good job` message, including after `Save for Later`, with concrete examples such as the check-in shortcut `Cmd/Ctrl+Shift+Y` for `Yes` and the global `Keep for Later` shortcut `Cmd/Ctrl+Shift+K` for Parking Lot capture. Teach the shortcut with behavior-first copy like `If something comes up, give it to Focana to keep for later.` Tips should feel optional, upbeat, and skimmable, and the system should avoid repeating the same hint too often.
- Commits: —

### ONB-001 — First launch should offer a dismissible guided feature wizard with first-use scripting
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Focana has several high-value behaviors that are easy to miss or misunderstand without guidance, but a long mandatory onboarding flow would create the exact sustained-attention burden the product is supposed to reduce.
- Files: `src/renderer/App.jsx`, first-run state in `src/main/store.js`, future onboarding/walkthrough UI, feature-trigger plumbing, `tests/e2e/electron-flows.spec.js`
- Related: `UX-012`, `UX-009`, `UX-010`, `TASK-002`
- Notes: Scope this as a dismissible first-launch guide plus progressive feature scripting, not a forced tutorial. On first launch, offer a lightweight wizard the user can skip, snooze, or exit at any time. Then, as the user encounters key features for the first time, script each one in-context with short, behavior-led guidance instead of one long tour. First pass should cover the main surfaces that define Focana's value, such as starting a session, responding to a check-in, using Parking Lot, reviewing Session History, minimizing to floating, and moving through the end-session flow. Persist completion and dismissal state per feature so tips do not repeat excessively, and avoid blocking the user from starting work just to finish onboarding.
- Commits: —

### TST-001 — Playwright E2E coverage should be split for parallel workers
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: The current monolithic Electron E2E file makes every regression pass slow, which discourages broader coverage right when more flow combinations are landing. Splitting the suite will make it practical to run more tests without turning every release candidate into a long serialized wait.
- Files: `playwright.config.js`, `tests/e2e/electron-flows.spec.js`, future `tests/e2e/*.spec.js`
- Related: `QA-001`
- Notes: Break the current all-in-one Playwright spec into domain files such as startup/settings, check-ins, post-session, windowing/floating, history/parking-lot, and timer regressions. Start with `3-4` workers, keep the most fragile window-position/relaunch cases in serial groups, and preserve the per-test temp store isolation that already exists. Acceptance should verify the split suite still passes reliably while materially reducing wall-clock time enough to support broader E2E coverage by default.
- Commits: —

### NOTE-001 — Notes should support optional reminder timers
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Notes often capture something the user wants to revisit later, and without a lightweight reminder they can disappear into the backlog instead of resurfacing at the right moment.
- Files: `src/renderer/components/ContextBox.jsx`, `src/renderer/components/SessionNotesModal.jsx`, `src/main/store.js`, reminder/notification plumbing
- Related: `UX-011`, `UX-006`
- Notes: Let users attach a simple reminder to a note without turning it into a full recurring task. First pass should support a few quick reminder choices plus a custom time, persist the reminder alongside the note, and re-surface the note clearly when the reminder fires whether the note came from in-session context, `Save for Later`, or another note surface.
- Commits: —

### NOTE-002 — Focana notes should be exportable to Markdown files
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Users should be able to keep or reuse their notes outside the app instead of feeling locked into Focana as the only place their session context lives.
- Files: `src/main/main.js`, `src/main/store.js`, `src/renderer/components/SettingsModal.jsx`, note/history surfaces
- Related: `UX-011`, `NOTE-001`
- Notes: First pass should support saving session notes and `Save for Later` notes as `.md` files in a user-chosen folder, with a predictable filename and enough metadata to be useful outside the app. Avoid silent duplicate exports, make the destination easy to find, and keep the export model simple before adding richer sync or external workspace integrations.
- Commits: —

### HIST-001 — Session history should auto-archive older entries locally
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Long session history should stay useful without turning the live history view into a giant scroll or forcing users to manually delete old sessions just to keep the app feeling tidy.
- Files: `src/main/store.js`, `src/renderer/adapters/store.js`, `src/renderer/components/HistoryModal.jsx`, `src/renderer/components/SettingsModal.jsx`
- Related: `UX-003`, `ANA-001`
- Notes: Treat this as local archiving, not silent destructive cleanup. First pass should keep a recent working set visible in Session History, move older entries into a locally stored archive, and give the user a simple retention rule they can understand and adjust later. Prioritize age/count-based archiving over hard deletion, make archived sessions recoverable/searchable when needed, and avoid asking the user to guess when they should clear history to save space.
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

### TASK-001 — Recurring tasks should support reusable scheduled presets
- Priority: Low
- Status: Later
- Version: TBD
- Why it matters: Repeated obligations like weekly expense reports are easier to start when the task already exists as a preset instead of being recreated from scratch every time.
- Files: `src/renderer/App.jsx`, `src/main/store.js`, future task scheduling UI
- Related: —
- Notes: Natural evolution for the task model, but not for the current cycle. Scope this as recurring task presets like "Every Monday I need to do expense reports," not as full calendar integration.
- Commits: —

### CAL-001 — Calendar sync should warn about upcoming meetings during focus sessions
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Focus sessions should help users protect their time, not accidentally make them miss hard commitments that already exist on their calendar.
- Files: `src/main/main.js`, `src/main/store.js`, `src/renderer/components/SettingsModal.jsx`, session reminder/notification surfaces
- Related: `TASK-001`
- Notes: Scope the first pass as read-only calendar awareness rather than event creation. Let users connect a calendar source, detect when an active or planned session overlaps an upcoming meeting, and surface clear reminders before the meeting starts so they can wrap up, pause, or reschedule intentionally.
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

### ANA-003 — Next app open should backfill local session history into Supabase
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: Historical usage is still stranded on users' Macs because Supabase only sees feedback-backed sessions today. A one-time backfill on the next app open would recover real session history for users who still have their local Electron Store data, making analytics materially more trustworthy without waiting for a full long-term sync architecture.
- Files: `src/renderer/App.jsx`, `src/renderer/adapters/store.js`, `src/main/store.js`, licensing/startup flow, future Supabase session-sync endpoint
- Related: `ANA-001`, `HIST-001`
- Notes: Scope this as a device-local historical import, not a general cloud history feature. On app open after runtime/license resolution, read local `sessions` from Electron Store, upload any unsynced historical sessions to Supabase tagged with `install_id` and `license_instance_id`, and persist a local synced marker so the same rows are not resent. The import should be idempotent, safe across retries, and tolerant of partial failures. Important constraint: this only works if the original local store still exists on that same machine; it will not recover history from wiped installs or different devices. Acceptance should verify an existing user with local session history and no prior cloud rows can launch once, backfill their historical sessions, and then relaunch without creating duplicates.
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

### SET-002 — License info should live at the bottom of Settings
- Priority: Low
- Status: Later
- Version: TBD
- Why it matters: License details are important, but they are not a high-frequency daily control. Keeping them at the bottom lets core focus settings stay front-and-center while still leaving license management easy to find.
- Files: `src/renderer/components/SettingsModal.jsx`
- Related: `LIC-001`, `SET-001`
- Notes: Move the license status and actions to the bottom of the Settings modal instead of placing them above more frequently used controls. Keep validation and deactivation accessible, but treat the license block as admin/account information rather than a primary in-session setting.
- Commits: —

### MOB-001 — Focana should have an iPhone companion app that mirrors focus sessions on the Lock Screen
- Priority: Medium
- Status: Later
- Version: TBD
- Why it matters: If focus only lives on the desktop, the phone stays an easy escape hatch. A synced iPhone presence should carry the active session onto the device, add friction before casual phone use, and keep break/Pomodoro timing trustworthy away from the Mac.
- Files: desktop session sync layer, future iPhone app, Lock Screen / Live Activity surfaces, notification scheduling or push plumbing
- Related: `UX-007`, `SES-003`
- Notes: Scope this as a real iPhone companion app, not just one-way notifications. The app should sync the active focus state from desktop, show the current task and timer on the iPhone Lock Screen in a persistent way that the user has to dismiss before slipping into the rest of the phone, and stay aligned with timed, Freeflow, and Pomodoro sessions. If the user is on a break or running a Pomodoro cycle, the phone should notify them when break time is up and the next work interval should begin. First pass should prioritize reliable desktop-to-phone session sync and local notification behavior over deeper mobile editing features, and acceptance should verify pause, resume, stop, break start, and break end all stay in sync across desktop and iPhone.
- Commits: —

## Done

### WIN-009 — Parking Lot hotkey from floating should not collapse back to compact
- Status: Done
- Version: 1.7.0
- Why it matters: A global capture shortcut should feel lighter than changing modes by hand. If invoking Parking Lot from floating drops the user back into compact, the shortcut interrupts the exact low-friction flow it is supposed to protect.
- Files: `src/main/main.js`, `src/main/shortcuts.js`, `src/renderer/App.jsx`, Parking Lot entry/exit flow, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-007`, `UX-010`
- Notes: Quick Capture now restores the originating display mode instead of turning the shortcut into a mode switch. The shortcut-triggered flow returns `full -> full`, `compact/pill -> compact/pill`, and `floating minimize -> floating minimize`, with targeted regression coverage for save and dismiss across the real shortcut path.
- Commits: `953718d`

### WIN-010 — Global shortcuts should preserve the user’s typing context in the previous app
- Status: Done
- Version: 1.7.0
- Why it matters: Global commands are supposed to reduce friction mid-flow. If Focana steals keyboard focus and leaves the user stranded there, the shortcut defeats its own purpose by interrupting the app they were actively using.
- Files: `src/main/main.js`, `src/main/shortcuts.js`, window activation/focus plumbing, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-001`, `WIN-009`, `WIN-006`
- Notes: Shortcut flows now capture the previously active app and hand focus back after the shortcut interaction completes. `Check-in: Yes` can resolve the visible prompt without leaving typing stranded in Focana, and text-entry flows such as `Keep for Later` can temporarily focus Focana for input before returning focus after save or cancel.
- Commits: `ab8a3a3`, `953718d`, `4926f02`

### UX-010 — Post-session transition should script the next move
- Status: Done
- Version: 1.4.0
- Why it matters: The moment after a session ends is a high-risk drift point. If Focana drops straight back to a blank home screen, users have to remember and orchestrate their own next move at exactly the point where momentum is most fragile.
- Files: `src/renderer/components/TimeUpModal.jsx`, `src/renderer/App.jsx`, post-session flow components, `tests/e2e/electron-flows.spec.js`
- Related: `UX-008`, `UX-007`
- Notes: End-session flows now route into the shipped `Session Wrap` family instead of dropping straight back to a blank home screen. The live flow supports inline keep-working, take-a-break, start-something-new, and done-for-now paths, keeps the handoff inside the same post-session context, and routes `Done for now` back into the resumable surface rather than discarding the task. The shipped new-task handoff also includes explicit `Save for later` and `Mark complete` decisions before returning to the idle shell.
- Commits: `cf2c74c`, `f355d0d`, `8bae8f0`

### UX-011 — Session notes should split `Immediate next step` from `Additional details`
- Status: Done
- Version: 1.4.0
- Why it matters: One catch-all note box makes it harder to restart. Users need a clear separation between what already happened and the very next action they should take when they come back.
- Files: `src/renderer/components/ContextBox.jsx`, `src/renderer/App.jsx`, `src/main/store.js`, resume/history surfaces
- Related: `UX-003`
- Notes: Session notes now persist split `nextSteps` and `recap` fields, keep legacy single-note data readable through the recap/additional-details path, and surface both fields across the main notes modal, save-for-later flows, resumable context, and history/task preview editing. Regression coverage verifies split notes survive save-for-later and resume flows without collapsing back into one blob.
- Commits: `f355d0d`

### UX-009 — Check-ins should support keyboard shortcuts for quick responses
- Status: Done
- Version: 1.4.0
- Why it matters: When a check-in appears, reaching for the mouse adds friction and can break focus, especially in compact or floating mode.
- Files: `src/renderer/App.jsx`, check-in prompt components, `src/main/main.js`, `tests/e2e/electron-flows.spec.js`
- Related: `WIN-004`
- Notes: The original `1.4.0` pass added a keyboard shortcut for the positive `Yes` path. The current behavior on `main` is a temporary global `Cmd/Ctrl+Shift+Y` while the first check-in prompt is visible, plus focus return to the previously active app after the shortcut resolves the check-in. `Cmd/Ctrl+Shift+K` also now restores the prior Focana view and returns focus to the previously active app after Parking Lot capture, so the shortcut story stays lightweight while the user keeps working.
- Commits: `fbd4769`, `8bae8f0`, `ab8a3a3`, `953718d`

### SET-001 — Focana should launch at login by default with a settings toggle
- Status: Done
- Version: 1.6.0
- Why it matters: Focana works best as a daily habit tool when it is already there at the start of the day, but users still need an easy way to turn that behavior off.
- Files: `src/main/main.js`, `src/renderer/components/SettingsModal.jsx`, `src/main/store.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `SES-001`, `SES-002`
- Notes: Launch at login now defaults on for new installs, the Settings toggle persists user intent, and startup no longer branches into a separate kickoff surface. Clean launches route to the normal idle shell, interrupted active work restores into the paused resume shell, and resumable sticky work stays on the dedicated resume path. Regression coverage now includes login-launch wiring, gate sequencing, startup restore behavior, and the release tooling path used to ship `1.6.0`.
- Commits: `0246025`

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
