# Product Backlog

## Roadmap

Release-theme view of the backlog. Order = build order. Items keep their stable IDs and full detail in the sections below; this section is the prioritized scheduling lens. `Status: Later` + a target `Version` = planned for that release but not yet started.

### 2.2.5 — In flight (in-session loop + boundaries + infra)
Finish the execution loop and exit surfaces: `UPD-001`, `UX-014`, `UX-015`, `UX-016`, `UX-018`, `UX-019`, `UX-020`, `UX-021`. Marketing stream runs in parallel: `MKT-001`..`MKT-005`. Quick close: verify `UX-005` is delivered by `UX-020` and close it rather than rebuild.

### 2.3.0 — Shipped: "A focus rhythm you can trust: work, break, resume"
Give a session a humane cadence and make every nudge trustworthy enough to earn the right to prompt. Also absorbs standalone Pomodoro/break-timer apps — the integration moat, not a single feature.
- **P0 — trust prereqs:** `WIN-008` (bug: no floating pulse while snoozed), `UX-007A` (snooze → collapse to minimized), plus a shared **nudge-suppression contract** carved from `UX-006` (every nudge respects DND, active typing, paused sessions, and snooze — the two new prompting surfaces below inherit it)
- **P1 — headline:** `UX-007B` (Pomodoro as a first-class start mode)
- **P1 — pairs with headline:** `UX-017` (gentle long-session break nudge)
- **P2 — cheap, high-leverage:** `SES-003` (add time mid-session)
- **Stretch (2.3.1 tail):** `UX-006` remainder (persist snooze/delay across relaunch, keep remaining time consistent across surfaces, pause countdown across sleep) — its DND/typing/snooze suppression slice is pulled into P0 above
- Guardrails: no streaks/points/forced breaks; nudges = one invitation, respect DND + active typing; "add time" copy stays neutral (never "you're behind").
- **Continuation invariant (spans UX-007B Q2 / SES-003 Q3 / UX-017 Q4 / INIT-001 Q5):** every "keep going" / continuation path saves accumulated work as legitimate, never fires an interim wrap, and never exposes a failure state. State it once in the specs so the four don't drift apart in implementation.

### 2.4.0 — Shipped: "Running plans + next-up handoff"
The published 2.4.0 delivered the middle/end of the planned "From stuck to started" story, but not the full initiation package.
- **Shipped:** `UX-023` timed wrap with next-up handoff.
- **Shipped, partial:** `UX-020` running checklist polish — parent/main task is preserved, a subtask can become the visible focus with a right-side focus arrow, and completed subtasks hide behind `Show completed` / `View all`.
- **Did not ship:** `INIT-003` Prep Next Session, `INIT-001` task-initiation scaffold / 2-minute just-start ramp, `INIT-002` implementation intentions, `TASK-002` optional parent/context field, and `UX-021` step estimates.
- **Read:** useful release, but not the complete "write down the next move before it disappears, see it while working, and return to it without re-deciding" package.

### 2.4.1 — Next deploy: "Prep Next Session"
This should be the next deploy. It is not `3.0.0`: it completes the 2.4 task-initiation promise without changing pricing, platforms, data ownership, or the core app model.
- **P0 — headline:** `INIT-003` Prep Next Session. Prepare one next task/subtasks/next-up plan before leaving, optionally take a short deep-breathing reset, then return to it with `Start`, `Edit`, and `Clear` without starting a timer early.
- **P0 — close the visible checklist gap:** finish the remaining `UX-020` acceptance by making active subtasks immediately visible where the shipped UI still hides them behind an edit/builder feel, and add an explicit compact plan-bucket `X`/back affordance that returns to the normal compact pill.
- **P1 — Pomodoro transition trust fix:** `UX-025` intentional Pomodoro break handoff. When work time ends, require a short break intention before the break timer starts; when break time ends, reuse the existing `Ready to resume?` surface instead of auto-starting the next work interval.
- **P1 — simplify saved-work surface:** `UX-026` demote full Session History and replace the visible user-facing entry point with a lightweight To-Do / Pick Up list for resumable and prepared work.
- **P1 only if it falls out naturally:** the smallest version of `TASK-002` as a single optional parent/context text field on the prepared plan. Do not add persistent projects, recents, labels, or hierarchy.
- **Cut from 2.4.1:** `INIT-001`, `INIT-002`, `UX-021`, creator/GTM attribution, rewards, emotional off-ramp, and persistent project queues.

### 2.4.2 — Candidate: "Just Start"
- **P0:** `INIT-001` task-initiation scaffold: smallest next step plus optional 2-minute just-start ramp.
- **P1:** `INIT-002` implementation intentions only if the re-entry display stays lightweight. Otherwise push it again.
- **Cut:** step estimates unless there is evidence users need orientation more than they need less planning math.

### 2.4.1 — Patch: "Break handoffs and To-Do pickup"
- **P0 — trust patch:** `UX-025` (Pomodoro work completion requires a typed break handoff, then waits on Ready to resume after the break)
- **P1 — recovery simplification:** `UX-026` (the visible saved-work surface is To-Do; completed/discarded session records are tucked behind recovery)
- Guardrails: keep break-taking optional and skippable, do not force shamey acknowledgements, keep historical records recoverable without making the first view feel like a log file.

### 2.4.2 — Hotfix: "Wake resume and update readiness"
- **P0 — wake trust:** keep wake/login prompts on `Ready to resume` when resumable work exists, including repeated wake after snooze.
- **P0 — update trust:** preserve the downloaded update state in Settings when the OS notification has already announced an update, and clarify that `latest` is the update channel rather than proof the installed version is current.
- Guardrails: no new feature scope; this is a trust hotfix for already-shipped wake and updater surfaces.

### 2.4.3 — Patch: "Update trust and cleaner planned starts"
- **P0 — update trust:** keep ready-to-install updates visible even if a late updater event reports an error, and show clear install-location copy when Focana is launched from a mounted DMG instead of Applications.
- **P1 — planned start flow:** split session planning from time selection so the first screen focuses on subtasks, next-up tasks, and Quick start, while the second screen handles timed, Freeflow, and Pomodoro choices.
- **P1 — compact preview polish:** let the running task preview sit closer to the compact window edges and add a visible Hide tasks control so users can collapse subtasks without ending or changing the timer.
- Guardrails: keep this a tight 2.4.x trust/polish release; do not pull forward the 2.5.0 regulation/reward scope or GTM lifecycle work.

### GTM Track — after 2.4.0 ships
- **Next GTM build:** `MKT-006` (creator promo-code + affiliate attribution). Explicitly excluded from 2.4.0; finish after the task-initiation release is shipped and the creator-code model is decided.
- **Pricing model decision:** `LIC-003` replaces the shipped day-8 full-app paywall with a free-for-life tier and calm Focana Plus feature gates. Decide before rewriting lifecycle emails, landing-page copy, and attribution so `MKT-001`, `MKT-003`, `MKT-004`, and `MKT-005` do not keep optimizing around trial copy.

### 2.5.0 — "Focus Insights + earned progress"
Ship the Focus Ledger as a user-benefit layer, not founder analytics: help users see where their focus time went, celebrate real completed work, and optionally receive weekly roadmap/milestone emails.
- **P0 — headline:** `ANA-004` Focus Ledger + Focus Insights. Production-deploy the hosted ingestion/cron API, ship desktop capture/sync, verify Supabase rollups, and add an opt-in insights surface for total time, time per task/subtask, completed work, and missed check-ins.
- **P0 — data trust:** `ANA-003` one-time local history backfill after opt-in, marked lower precision and session/main-task level only.
- **P1 — pairs with headline:** weekly Focana Roadmap email and milestone emails, gated by Focus Insights consent and the "include task names" preference.
- **P1 — small product delight:** `RWD-001` per-subtask reinforcement — consistent, earned, never variable-ratio.
- **Tiny polish if already in path:** `UX-022` only if it is just a Session Wrap simplification; otherwise push it.
- **Cut from 2.5.0:** `EMO-001` emotional off-ramp, creator/GTM attribution, project queues, step estimates, and a full analytics dashboard.

### 2.6.0 — "Project memory without project management"
- **P1:** `TASK-003` (project task queue — add future to-dos to a project, then choose where to start next time)
- Guardrail: Focana can remember the work so users can start; it should not become Asana. No collaboration, assignees, dependencies, statuses, due dates, boards, dashboards, or notification-driven project management by default.

### Parked (Later — do not pull forward)
- Onboarding theme (its own future release): `ONB-001`, `UX-012`, `UX-008`
- Never-by-default, needs an explicit decision to revive: `CAL-001`
- Blocked, needs a genuinely new angle: `WIN-001`
- Infra / low-EF-leverage: `TST-001`, `HIST-001`, `ANA-001`/`ANA-002`, `NOTE-001`/`NOTE-002`, `I18N-001`, `TASK-001`, `MOB-001`, `SET-002`/`SET-004`, `WIN-006`/`WIN-007`, `UX-013` (hygiene — rides any release with slack)

### Open decisions
- **Framework (Q8 — decided):** build the deferred task-initiation features (`INIT-001`, `INIT-002`) WITHOUT canonizing new coping mechanisms; leave framework naming for a separate, deliberate founder pass. Evidence is asymmetric — "If-Then Planning" (implementation intentions) has a controlled ADHD trial behind it, while "Activation Scaffolding" is a Focana-coined, still-unvalidated label; treat the coined name as an unvalidated claim to verify before externalizing. Adopting mechanisms flips the framework from **6 + 1** to **8 + 1** and changes the "7 science-backed" marketing line (a real CLAUDE.md + marketing edit), and each new mechanism must be manually propagated to the ADHD Engine project (marketplace listing + archetype→tool matching). Decoupling is free: the code delivers value whether or not it's canonized.
- **Cross-project:** any new mechanism must be manually flagged in the ADHD Engine project — the marketplace listing and archetype→tool matching depend on the framework.
- **Doc bug:** Parking Lot shortcut is inconsistent — CLAUDE.md says `Cmd+Shift+N`, `UX-012` teaches `Cmd/Ctrl+Shift+K`. Pin the real binding before `UX-012` ships user-facing copy.

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

### UPD-001 — Focana should quietly check for updates every 4 hours while running
- Priority: High
- Status: Next Up
- Version: 2.2.5
- Why it matters: If Focana stays resident all day, a launch-only update check can make a newly shipped fix look missing until the user manually checks. Cadenced checks should make updates feel dependable without interrupting focus.
- Files: `src/main/updater.js`, `src/main/main.js`, `src/renderer/components/SettingsModal.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `SET-003`, `SES-001`, `WIN-005`
- Notes: Keep the existing launch check, then add a packaged-only quiet cadence that checks every `4 hours` of app runtime and checks after wake/resume when the last check is older than the cadence. Automatic failures should stay silent and reset to idle, manual `Check for updates` should still surface concise errors, and the service should avoid duplicate checks while one is in progress or an update is already downloaded/installing. If a new version downloads, use the existing update-ready banner/notification and preserve the calm copy: restart when ready, current work stays saved. Acceptance should verify launch check still runs, a mocked cadenced check can find and download an update, automatic errors remain quiet, manual checks still work, wake-triggered checks respect the cadence, and disabling auto-updates still disables all automatic checks.
- Commits: —

### UX-014 — Pre-session and post-session boundary screens should feel polished and decisive
- Priority: High
- Status: In Progress
- Version: 2.2.5
- Why it matters: The moments right before starting and right after finishing are where users either carry momentum forward or drift away. If those screens feel clumsy, the core focus loop loses trust at both edges.
- Files: `src/renderer/App.jsx`, `src/renderer/components/PostSessionPrompt.jsx`, `src/renderer/components/TimeUpModal.jsx`, start-session and save-for-later surfaces, `tests/e2e/electron-flows.spec.js`
- Related: `UX-010`, `UX-011`, `UX-013`, `TASK-002`
- Notes: Audit update: the `Session Wrap` family, pause surface, `Save and continue later`, start-new decision, and save-for-later child paths already exist and have E2E coverage. Keep this as the remaining polish pass across the session-boundary surfaces rather than a full feature build. Refine the ready/start flow so beginning work feels crisp, then tighten the shipped `Session Wrap`, `Save for Later`, and adjacent copy/actions so ending a session always scripts the next obvious move. Prefer visible-state clarity over extra ceremony, keep the highest-confidence next action easy to choose, and make the before and after screens feel like one coherent loop instead of separate features that happen to touch the timer. Acceptance should verify clean manual startup into the ready shell, predictable start-task handoff, polished `Session Wrap` child paths, and save-for-later transitions that preserve context without awkward dead ends.
- Commits: —

### UX-018 — What's Next should make the start action obvious while planning
- Priority: High
- Status: Next Up
- Version: 2.2.5
- Why it matters: If the `What's next?` options are confusing or the visible start arrow disappears while someone is typing, the screen can look like there is no way to begin. Users should not have to discover that Enter starts the task by accident.
- Files: `src/renderer/App.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/renderer/components/SessionBuilderComposer.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-014`, `UX-016`, `TASK-002`, `UX-005`
- Notes: Audit update: `SessionBuilderComposer` already supports a `Quick start` button, and the draft composer already passes `onQuickStart` so the button appears next to `Add subtask` before normal session start. Remaining work is the actual `What's next?` re-entry path: revisit the screen options and labels so the choices feel direct, distinct, and low-friction, then wire a visible `Quick start` affordance into the re-entry planning surface where the embedded builder currently renders without `onQuickStart`. The button should start the current typed task/plan through the same path as Enter, preserve the subtask planning context, and stay stable at supported window sizes. Acceptance should verify the confusing options are simplified, typing never leaves the screen without an obvious start control, `Quick start` works with mouse, keyboard, and screen readers, and the layout does not overflow in full, compact-origin, or floating re-entry paths.
- Commits: —

### UX-019 — Different task should preserve pickup context before starting something new
- Priority: High
- Status: In Progress
- Version: 2.2.5
- Why it matters: Deleting a task title to change direction can make Focana feel like it dropped the user back at the beginning. A deliberate task-switch path should preserve the old thread and make the next move feel intentional.
- Files: `src/renderer/App.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/renderer/components/SessionNotesModal.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-014`, `UX-018`, `UX-015`, `UX-016`
- Notes: Audit update: the resumable path already has `Start Something New`, opens a save-for-later notes step, can save or mark complete, and hands off to `What's next?`; E2E covers the floating resume start-new path and draft stability. Remaining work is product polish: decide whether this should be renamed or reframed as `Different task`, make the optional save/dismiss choice more explicit, and verify sourced task drafts preserve context without relying on deleting task text. Acceptance should verify save/dismiss paths keep the old task recoverable, the transition lands on `What's next?`, and the flow does not create shamey copy, duplicate sessions, or a blank dead end.
- Commits: —

### UX-020 — Running checklists should prioritize active subtasks
- Priority: High
- Status: In Progress
- Version: 2.4.1 completion
- Why it matters: During focus, the next concrete step should be visible without opening a builder. Hiding planned work behind `View session builder` increases re-initiation cost, especially in compact and floating views.
- Files: `src/renderer/components/RunningTaskPlan.jsx`, `src/renderer/components/CompactMode.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-005`, `TASK-002`, `UX-018`, `UX-021`
- Notes: 2.4.0 shipped the important state behavior: parent/main task stays intact, a subtask can become the visible focus via the right-side focus arrow, and completed subtasks hide behind `Show completed` / `View all`. Remaining 2.4.1 work is the acceptance gap: make active subtasks immediately visible where the current full/compact running UI still feels like an edit/builder surface, keep edit/add controls secondary, and add an explicit compact plan-bucket `X`/back affordance that returns to the normal compact pill without ending the session, changing timer state, or losing checklist progress. Acceptance should verify full-window and compact surfaces show active subtasks first, completed rows stay recoverable but hidden by default, unchecked completed rows return to active order, the compact subtask bucket can be dismissed back to compact with mouse and keyboard, and checklist controls remain keyboard and screen-reader friendly.
- Commits: `3e18804` (partial)

### UX-025 — Pomodoro breaks should require an intentional handoff before resuming
- Priority: High
- Status: Next Up
- Version: 2.4.1
- Why it matters: Pomodoro should help users transition, not silently move them between work and break states. A clear break intention lowers the chance of drifting into an unhelpful break, and a deliberate resume prompt keeps Focana from auto-starting work before the user is actually back.
- Files: `src/renderer/App.jsx`, `src/renderer/components/PomodoroBreakPanel.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-007B`, `UX-017`, `UX-015`, `UX-020`
- Notes: On Pomodoro work expiry, show a warm `Break time` acknowledgement before starting the break countdown. First pass should require a short break intention, with quick-fill chips for common breaks, then `Start break`. When the break countdown ends, do not auto-start the next work interval; reuse the existing `Ready to resume?` prompt with the current task context. Keep `Keep going` / skip-break available, avoid forced breaks, and preserve accumulated work time as legitimate.
- Commits: —

### UX-026 — Visible saved work should be a lightweight To-Do list, not full Session History
- Priority: High
- Status: Next Up
- Version: 2.4.1
- Why it matters: The current Session History modal is a large session log with Resume, Discarded, and Completed tabs. It takes up too much surface area for a workflow users rarely need, while the useful job is much smaller: help them pick up saved work without re-deciding what to do next.
- Files: `src/renderer/App.jsx`, `src/renderer/components/HistoryModal.jsx`, `src/renderer/components/SettingsModal.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `INIT-003`, `UX-020`, `UX-003`, `HIST-001`, `TASK-003`
- Notes: Demote the full Session History from the default user-facing controls and Settings toolbar customization. Preserve local session data and keep completed/discarded records reachable only as a quiet recovery/data-management path, such as an overflow action or advanced Settings entry. Replace the visible entry point with a lightweight `To-Do` or `Pick Up` surface focused on saved-for-later sessions and the prepared next-session plan from `INIT-003`. First pass should not become a project manager: no boards, due dates, labels, statuses, collaboration, or analytics. Acceptance should verify the main header/re-entry shortcuts use the new saved-work label, the full log no longer consumes default Settings/home-screen space, saved/resumable tasks remain startable, completed/discarded recovery remains possible, and existing local history is not deleted or hidden behind a data-loss path.
- Commits: —

### UX-021 — Step estimates should support time blindness without pressure
- Priority: High
- Status: Later
- Version: TBD
- Why it matters: Time blindness can make it hard to choose a realistic focus window or understand how a task breaks down. Optional step estimates should help users orient without turning the plan into a deadline, scorecard, or source of shame.
- Files: `src/renderer/App.jsx`, `src/renderer/components/SessionBuilderComposer.jsx`, `src/renderer/components/RunningTaskPlan.jsx`, `src/renderer/components/CompactMode.jsx`, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-020`, `TASK-002`, `UX-005`, `UX-014`
- Notes: Add a lightweight estimate prompt to planned subtasks and next-up tasks: `How long do you expect each step to take?` First pass should let users add optional minute estimates per step, show a calm total estimate before starting, and keep estimates visible during focus only as orientation. Avoid `overdue`, `behind`, failure states, or negative feedback if a step takes longer than expected. Acceptance should verify users can add optional estimates to subtasks and next-up tasks, the planner shows a total expected time when estimates exist, running and compact views keep active-step estimates readable without clutter, and completed steps do not create pressure when actual time differs.
- Commits: —

### UX-023 — Timed wrap should hand off cleanly when a next-up task exists
- Priority: High
- Status: Done
- Version: 2.4.0
- Why it matters: When a timed block ends and the user already queued a next-up task, dropping them into the normal `What's next?` screen ignores the plan they already made. The decision should be explicit and low-friction: continue the current task, move to the queued task, or stop cleanly.
- Files: `src/renderer/App.jsx`, `src/renderer/components/PostSessionPrompt.jsx`, `src/renderer/utils/taskPlan.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-014`, `UX-018`, `UX-020`, `INIT-003`, `TASK-002`
- Notes: On timed-session expiry, if the active task plan has an unfinished next-up task, do NOT show the generic `What's next?` handoff. Show a next-up-aware Session Wrap with exactly three primary choices: `Continue current task`, `Move onto [next task]`, and `Done for now`. Choosing `Continue current task` should preserve the current keep-working timer/freeflow path. Choosing `Move onto [next task]` should first ask where the user left off on the current task, save that pickup note to the current session, then make the queued next-up task the ready-to-start task with the task plan context intact. Choosing `Done for now` should also ask where the user left off, save the current task for pickup later, and avoid opening the generic `What's next?` screen. Acceptance should verify the three-option screen only replaces timed wrap when a next-up task exists, the queued task title is visible and stable, both non-continue paths collect pickup notes, saved notes survive relaunch, active/resumable task state is not overwritten accidentally, and keyboard/screen-reader affordances remain intact.
- Commits: `3e18804`

### UX-016 — Re-entry nudges should never interrupt active typing
- Priority: High
- Status: In Progress
- Version: 2.2.5
- Why it matters: If the user is typing in the `What's next?` field, Focana has already regained their attention. Pulsing, refocusing, or clearing draft text at that moment makes the re-entry prompt feel intrusive and can break trust in the resident app behavior.
- Files: `src/renderer/App.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/main/main.js`, `tests/e2e/electron-flows.spec.js`
- Related: `SET-003`, `UX-014`, `UX-006`, `WIN-008`
- Notes: Audit update: interaction with the re-entry prompt already settles the strong cue, and E2E covers a save-for-later draft surviving the re-entry cue loop. Remaining work is the stricter typing protection described here. Treat typing in the re-entry prompt as active engagement. Suppress or postpone re-entry pulses while the task field is focused, while the prompt has unsaved draft text, or during a short grace window after text input. Protect `reentrySurfaceTaskText` from being overwritten by timer ticks, pulse state, prompt reopen/signature refreshes, or duplicate resident-window events unless the user explicitly chooses a new source, snoozes, closes, or starts the task. Acceptance should verify that a scheduled pulse does not fire mid-typing, that draft text survives any prompt attention refresh, and that packaged/dev duplicate-instance testing does not allow one Focana instance to clear another instance's active draft.
- Commits: —

### UX-015 — Pause and break flows should help users pick up where they left off
- Priority: High
- Status: In Progress
- Version: 2.2.5
- Why it matters: Pausing or taking a break is often when the thread of the work is most fragile. Focana should make the next step easy to recover without turning a quick pause into paperwork.
- Files: `src/renderer/App.jsx`, `src/renderer/components/PostSessionPrompt.jsx`, `src/renderer/components/SessionNotesModal.jsx`, pause/resume surfaces, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-011`, `UX-014`, `UX-010`, `SES-001`, `UX-006`
- Notes: Audit update: pause now opens a dismissible Session Wrap, can keep working, mark complete, or save for later, and post-session breaks return through the floating resume prompt. Remaining work is the explicit pickup-note bookmark before intentional exits. Add a lightweight `Where should we pick up?` handoff for manual `Pause` during a running session and `Take a break` from `Session Wrap`. The first pass should reuse the existing split `Immediate next step` / `Additional details` note model, let users skip quickly, and carry the latest pick-up note into the paused resume shell, break timer, and floating resume prompt. Keep elapsed-time semantics unchanged for timed and Freeflow sessions, avoid duplicating `Save for Later` or `Done for now`, and make the note feel like a helpful optional bookmark instead of a blocking modal. Acceptance should verify pause-note-to-resume, break-note-to-break-timer-to-resume, one-click skip paths, and relaunch recovery while paused or on break.
- Commits: —

### MKT-001 — Lifecycle emails should cover trial, checkout, and license activation
- Priority: High
- Status: In Progress
- Version: 2.2.5
- Why it matters: The new 7-day trial and day-8 paywall need calm, useful follow-up outside the app so users understand what happens next without feeling nagged or surprised.
- Files: `supabase/functions/loops-lifecycle/index.ts`, `supabase/functions/loops-lifecycle/README.md`, Loops workflows, Supabase secrets, future lifecycle event callers
- Related: `LIC-002`, `MKT-002`, `MKT-003`
- Notes: Audit update: the Supabase `loops-lifecycle` bridge exists, forwards trusted events to Loops, documents the recommended event names, and shipped in the `2.2.3` release notes as bridge-ready. Remaining work is to finish the lifecycle path around it: add app/server callers for `trial_started`, `trial_day_6`, `trial_expired`, `checkout_started`, and `license_activated`; manage or inspect Loops dashboard workflows; and verify hosted events actually reach Loops without duplicate contacts. Ask Loops support to enable Workflows API alpha access for the `Focana` team so workflows can be inspected by CLI; until then, manage workflow structure in the Loops dashboard and verify by sending events through Supabase. Keep copy practical and non-punitive: welcome users, remind them before trial end, explain day-8 choices, follow up on checkout-started/no-activation, and acknowledge successful activation with a short next-step orientation.
- Commits: —

### MKT-002 — Existing users should get a clear lifetime-upgrade outreach sequence
- Priority: High
- Status: Next Up
- Version: TBD
- Why it matters: Current and early users are the highest-trust audience for the paid launch. They should hear directly that lifetime is available, why it exists, and how to choose it without being pushed into a confusing subscription path.
- Files: Loops campaigns, Loops audience segments, Lemon checkout links, customer/user export source, campaign copy
- Related: `LIC-002`, `MKT-001`, `MKT-004`
- Notes: Create a one-time outreach pass for existing users, with a special emphasis on the lifetime upgrade. Segment at minimum into founding/early users, active trial users, and prior downloaders or interested users where data is available. Message should be direct and appreciative: what changed, what the lifetime option includes, the monthly alternative, and what happens after checkout with the license key email. Avoid scarcity pressure, guilt, or over-emailing. Acceptance should include reviewed email copy, verified checkout links for monthly and lifetime, a test send, and a send/holdout plan that tracks opens, clicks, replies, purchases, and license activations.
- Commits: —

### MKT-003 — Landing page should match the 7-day trial and lifetime/monthly offer
- Priority: High
- Status: Next Up
- Version: TBD
- Why it matters: The app, checkout, emails, and website all need to tell the same story. If the landing page still describes an older purchase flow, users will arrive at the trial/paywall with avoidable uncertainty.
- Files: marketing site or landing-page repo, `release-notes/2.2.3.json`, Lemon checkout URLs, pricing copy, download CTA
- Related: `LIC-002`, `MKT-001`, `MKT-002`
- Notes: Refresh the landing page around the actual first-run promise: download Focana, use the full app free for 7 days, then choose `$10/month` or `$79 lifetime`. The first viewport should make Focana's ADHD-friendly focus loop immediately concrete, not just describe productivity in generic terms. Add pricing clarity, license-key-after-checkout expectations, a short "who this is for" section, and a calmer paid-upgrade explanation that matches the day-8 screen. Acceptance should verify the landing page CTA, price points, download flow, checkout links, and app paywall copy all agree.
- Commits: —

### MKT-004 — Marketing plan should restart as a weekly learning loop
- Priority: High
- Status: Next Up
- Version: TBD
- Why it matters: Focana needs a repeatable path back to users and buyers, not just a release followed by scattered one-off posts.
- Files: marketing plan, Loops campaign calendar, landing page, user interview/reply tracker
- Related: `MKT-002`, `MKT-003`, `LIC-002`
- Notes: Build a lightweight marketing plan around one weekly loop: choose a target audience, publish or send one clear message, talk to users who reply, inspect conversion signals, and update the next message. Near-term channels should include existing users, founding members, direct user outreach, the landing page, product directories or launch channels already on the radar, and follow-up emails for trial/paywall behavior. Track a small metric set: downloads, trial starts, day-8 paywall views, checkout clicks, lifetime purchases, monthly starts, activations, replies, and unsubscribes. Acceptance should produce a 2-week campaign calendar, first outreach copy, landing page task list, and a simple weekly review ritual.
- Commits: —

### MKT-005 — Download-to-purchase attribution should identify trial and lifetime buyers
- Priority: High
- Status: Next Up
- Version: TBD
- Why it matters: A lifetime purchase email is not enough context if we do not know whether that person downloaded Focana, started a trial, activated a license, or came from an outreach/link source. Founder follow-up and lifecycle emails need a simple, trustworthy view of who entered the funnel before they bought.
- Files: landing download flow, Supabase lifecycle tables/functions, Loops contacts/events, Lemon checkout/webhook metadata, PostHog event wiring, privacy copy as needed
- Related: `MKT-001`, `MKT-002`, `MKT-004`, `LIC-002`
- Notes: Add lightweight lifecycle attribution across the download/trial/purchase path. First pass should connect email, install or download identifier, source/campaign, `download_clicked`, `first_open` or `trial_started`, `checkout_started`, `lifetime_purchased`, `monthly_started`, and `license_activated` into one founder-readable record or export. Use explicit checkout/download metadata where possible so a Lemon lifetime purchase can be matched back to the original download/trial/contact. Privacy guardrail: track only product lifecycle and revenue attribution needed for support and outreach; do not add detailed focus-session behavior, productivity scoring, or an analytics dashboard by default. Acceptance should verify a test user can download, start trial, purchase lifetime, and appear as one matched contact with the correct timestamps/source, while unmatched purchase emails are flagged for manual follow-up instead of silently disappearing.
- Commits: —

### LIC-003 — Focana should offer Free for life with calm Plus feature gates
- Priority: High
- Status: Next Up
- Version: TBD
- Why it matters: A deadline-based trial can create pressure and waste anxiety for ADHD users who install the app, forget for a few days, and come back to a closed door. A useful free-for-life tier keeps the first focus loop humane and accessible, while Plus monetizes deeper memory, structure, and continuity.
- Files: `src/main/licenseService.js`, `src/main/store.js`, `src/renderer/App.jsx`, `src/renderer/components/SettingsModal.jsx`, `src/renderer/components/ParkingLot.jsx`, `src/renderer/components/HistoryModal.jsx`, `src/renderer/components/SessionBuilderComposer.jsx`, `src/renderer/components/RunningTaskPlan.jsx`, checkout/upgrade surfaces, `tests/license-service.test.js`, `tests/e2e/electron-flows.spec.js`
- Related: `LIC-002`, `MKT-001`, `MKT-003`, `MKT-004`, `MKT-005`, `SET-002`
- Notes: Replace the future commercial model from a `7-day` full-app trial/day-8 startup blocker to `Focana Free` + `Focana Plus`. Free must preserve one complete focus loop: enter a task, start Freeflow or timed focus, use the default `25 / 5` Pomodoro rhythm, pause/resume, complete or save context, and recover the current session locally. Plus gates should appear at expansion moments, not at startup: Session History is Plus from the first click but its entry points stay visible and open a calm Plus modal for Free users; Parking Lot allows `5` active free items, with item #6 gated and completed items not counting; active-task subtasks allow `3` free subtasks, while additional subtasks and all next-up tasks are Plus; Pomodoro keeps `25 / 5` free and gates `50 / 10`, Custom, and future saved presets. Existing over-limit Parking Lot items, subtasks, and restored plans must remain visible/editable/completable so user data is never held hostage. Treat active paid licenses and valid offline-grace states as Plus; treat unlicensed users as Free, not blocked. Replace user-facing `trial` copy with plan language, avoid countdowns or urgency, and keep upgrade copy contextual, calm, and non-punitive. Acceptance should verify normal startup for Free users, History gate behavior, Parking Lot cap behavior across modal/quick-capture/post-session paths, subtask/next-up gates in draft and running plans, Pomodoro customization gates, Plus license access, and no regression to startup/day-8 full-app blocking.
- Commits: —

### MKT-006 — Creator promo-code and affiliate attribution should support the ADHD creator pilot
- Priority: High
- Status: Later
- Version: TBD
- Why it matters: Creator partnerships can borrow trusted ADHD audiences without cold-start ads, but the pilot needs a trustworthy way to attribute trials, purchases, and payouts back to each creator.
- Files: `src/main/licenseService.js`, `src/main/main.js`, `src/main/preload.js`, `src/main/store.js`, `src/renderer/App.jsx`, landing creator routes/APIs, Lemon checkout/webhook metadata, PostHog lifecycle events
- Related: `MKT-004`, `MKT-005`, `LIC-002`
- Notes: Explicitly excluded from 2.4.0. Before continuing implementation, decide whether creator codes are checkout-only discount/affiliate codes or pre-checkout extended-trial codes that later pass attribution into checkout. First pass should support per-creator codes/links, creator-attributed checkout, creator attribution in lifecycle events, and founder-readable reporting for activations, purchases, refunds, and payout review. Keep the user-facing app surface minimal and avoid adding analytics dashboards or creator-management complexity inside Focana.
- Commits: —

### ANA-004 — Focus Ledger should power opt-in Focus Insights and roadmap emails
- Priority: High
- Status: In Progress
- Version: 2.5.0
- Why it matters: Users want to know their real focus patterns — total time in Focana, time per task/subtask, missed check-ins, completed work, and meaningful milestones — without turning Focana into surveillance, a scorecard, or a founder analytics dashboard.
- Files: `src/renderer/App.jsx`, `src/renderer/components/SettingsModal.jsx`, `src/renderer/utils/focusLedger.js`, `src/main/focusLedgerSync.js`, `src/main/store.js`, `src/main/main.js`, `src/main/preload.js`, `tests/focus-ledger-sync.test.js`, `focana-landing/src/pages/api/app-focus-ledger.ts`, `focana-landing/src/lib/appFocusLedgerService.ts`, `focana-landing/src/lib/focusEmailAutomation.ts`, `focana-landing/src/pages/api/cron/focus-milestones.ts`, `focana-landing/src/pages/api/cron/focus-weekly-roadmap.ts`, `focana-landing/supabase/migrations/010_focus_ledger.sql`, `focana-landing/tests/app-focus-ledger.test.ts`, `focana-landing/vercel.json`
- Related: `ANA-003`, `RWD-001`, `MKT-001`
- Notes: Ship the privacy-aware Focus Ledger as a user-facing benefit. Track active focus sessions, per-task/per-subtask segments, check-in outcomes, completed work, and milestone progress. Keep existing users default-off until they opt into `Focus insights and weekly roadmap`; keep raw detour notes local-only; sync task/subtask names only when the separate `include task names` preference is enabled. Current implementation state: Supabase migration `010_focus_ledger.sql` is applied, hosted ingestion/cron code is built and preview-deployed, and desktop capture/sync is implemented locally. Remaining release work: production-deploy `focana-landing`, ship the desktop build, verify local-to-cloud ingestion with a test install, verify Supabase rollups, confirm Loops milestone/weekly events, and smoke the Settings/Insights UI. Vercel Hobby limits milestone cron to daily, so milestone emails may arrive within about 24 hours rather than immediately. Acceptance should verify opt-in/off behavior, task-name-disabled payloads, missed check-ins, pause/sleep exclusion from active time, idempotent retries, one-time lower-precision history backfill, weekly email duplicate prevention, milestone duplicate prevention, and an in-app Focus Insights view that shows total time, task/subtask time, completed work, and missed check-ins without guilt or productivity scoring.
- Commits: —

## Later

### TASK-002 — Session planning should require a project-based task hierarchy
- Priority: High
- Status: Later
- Version: 2.4.1 candidate / TBD
- Why it matters: Flat task entry makes it too easy to start vague work. Requiring a parent/child structure pushes users to name the project and break the work into concrete, intentional units before they spend time on it.
- Files: `src/renderer/App.jsx`, `src/main/store.js`, session start flow, future queue/planning UI
- Related: `UX-005`, `ANA-001`, `TASK-001`
- Notes: 2.4.x REDESIGN — ship the hierarchy as OPTIONAL, not mandatory. The original "users should have to identify Project -> Task before beginning" framing is a task-initiation hazard: forcing structure before starting is exactly what triggers ADHD task paralysis at the moment initiation is hardest. For 2.4.1, include only if it naturally supports `INIT-003`: ONE optional parent/context free-text field on the prepared plan, with no cross-session project store, no recent-label recall, no persistent projects, and no requirement before starting. Original intent below, to be reframed accordingly. Add a project-based task queue that forces intentional structure before focus starts. Users should have to identify either `Project -> Task` or `Task -> Subtask` before beginning a session, rather than entering one flat line and improvising from there. First pass should support a lightweight queue under the chosen parent item, make it easy to break work into the next concrete steps, and let the active focus block pull from that queue while preserving the parent context. This is broader than the in-session checklist in `UX-005`, but it should still avoid turning Focana into a heavyweight project-management board. Earn real cross-session persistence later only if users are demonstrably re-typing the same parent context every session.
- Commits: —

### TASK-003 — Project task queue should remember future work without becoming Asana
- Priority: High
- Status: Later
- Version: 2.6.0
- Why it matters: Users will often identify new project work while they are not ready to do it yet. They should be able to add those future to-dos to Focana, then later load the project and choose where to start, instead of losing the thread or scattering tasks across paper notes and external tools.
- Files: `src/main/store.js`, project/task queue persistence, project picker/start surfaces, `src/renderer/App.jsx`, `src/renderer/components/SessionBuilderComposer.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `TASK-002`, `INIT-003`, `UX-020`, `UX-023`, `ANA-001`
- Notes: Build this as project memory feeding focus sessions, not as general project management. First pass should support a small local project/task to-do list: add tasks/subtasks to a project, load a project, choose any unfinished item as the next focus session, and preserve the remaining project queue for later. Users should be able to add newly discovered work quickly without starting a timer and without being forced to organize everything first. Scope guard: no team collaboration, assignees, due dates, status columns, dependencies, comments, file attachments, recurring schedules, dashboards, or notification nudges by default. The core question stays `What do you want to start now?`, not `Manage your project`. Acceptance should verify users can add project to-dos outside a session, load the project later, start from a chosen item with subtasks intact, complete or save progress back into the project queue, and keep the UI lightweight enough that it does not become an organizing/procrastination surface.
- Commits: —

### UX-005 — Focus blocks should support a checklist of sub-tasks
- Priority: High
- Status: Later
- Version: TBD
- Why it matters: A single work block often contains a short queue of concrete sub-tasks that users want to check off without losing the top-level focus.
- Files: `src/renderer/App.jsx`, `src/main/store.js`, relevant session UI components
- Related: `UX-003`, `TASK-002`
- Notes: VERIFY-AND-CLOSE — likely already delivered by `UX-020` (active subtasks with checkboxes in full/compact/floating). Verify against the shipped running checklist and close rather than rebuild. Original intent below. Model it as an active-session checklist under one block or task title, not as a Parking Lot enhancement or flat note list. First pass should let the user take the structured plan they created and work through the next concrete steps inside the active session without losing the parent project or task context. Acceptance coverage should confirm one focus block can hold multiple checkable sub-tasks without turning Parking Lot into the work queue.
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

### UX-024 — Time Up screen should be quieter and easier to choose from
- Priority: High
- Status: Later
- Version: TBD
- Why it matters: When a timer ends, users are already in a transition moment. A busy Time Up screen adds decision load right when Focana should make the next move feel obvious.
- Files: `src/renderer/components/TimeUpModal.jsx`, `src/renderer/App.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-010`, `UX-013`, `UX-023`
- Notes: Redesign the Time Up screen so it has one clear primary path and fewer competing visual elements. Reduce copy density, keep add-time/freeflow/end-session choices calm and scan-friendly, and verify modal sizing has no excess whitespace, no clipped text/actions, draggable window affordances remain intact, and any deeper/expanded screen has a clear close/back affordance.
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
- Version: 2.3.0 P0 (suppression contract) / 2.3.1 (stretch tail)
- Why it matters: The thin break/re-entry slice in `1.4.0` will cover the new post-session flow, but the wider reminder system still needs a full trust pass so nudges always feel intentional instead of random or sticky.
- Files: `src/renderer/App.jsx`, `src/renderer/components/TaskInput.jsx`, `src/main/main.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-010`, `UX-007A`
- Notes: SCOPE SPLIT (Q4 — decided): the shared **nudge-suppression contract** — every nudge (Pomodoro break transitions in `UX-007B`, the 90-min `UX-017` nudge, and re-entry) respects Do Not Disturb, active typing/editing, paused sessions, and an active snooze — is pulled into 2.3.0 as a P0 trust prereq, because 2.3.0 ships two new prompting surfaces that must inherit it. `WIN-008` (snooze pulse) and `UX-016` (typing protection) already cover their slices, so the net-new P0 pull-forward is primarily DND suppression plus the single shared contract. The heavier remainder stays a 2.3.1 stretch tail. Original scope: Finish the shared re-entry timer hardening after `1.4.0`: persist remaining delay and snooze state across relaunch, keep remaining time consistent across full-window and floating surfaces, suppress nudges immediately for Do Not Disturb, paused sessions, update/license blockers, and pause countdown across system sleep/hibernate so wake resumes from the remaining awake time instead of treating sleep as idle.
- Commits: `d9c9b55` (2.3.0 suppression contract slice; 2.3.1 tail remains)

### UX-017 — Long focus sessions should offer a gentle take-a-break nudge
- Priority: High
- Status: Done
- Version: 2.3.0
- Why it matters: Long uninterrupted sessions can help users stay locked in, but after a while they may need a humane prompt to pause, reset, hydrate, stretch, or decide intentionally to keep going.
- Files: `src/renderer/App.jsx`, active timer/check-in surfaces, break timer surfaces, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-015`, `UX-006`, `UX-007B`, `SES-003`
- Notes: Add a calm long-session nudge after sustained focus, starting with a `90 minutes` threshold and copy like `You've been at it for 90 minutes. Want to take a real break?` This should be an invitation, not an interruption or warning: offer `Take a break`, `Keep going`, and a lightweight snooze option, respect Do Not Disturb and active typing/editing, and avoid resetting the user's task context. The nudge should work across full, compact, and floating timer surfaces, and should not fire repeatedly after the user responds. Acceptance should verify threshold timing, snooze/keep-going behavior, break handoff, relaunch persistence, and no surprise prompts during paused sessions, system sleep, modal flows, or active text entry. Design decision (Q3 — decided): the 90-minute threshold reads the existing active-awake accumulator (`getElapsedSeconds()`), which already excludes manual pause and system sleep and is the same source the current check-ins schedule from — so the nudge measures active focus time, not wall-clock, and it comes essentially for free. Deliberate first-pass cut: no idle detection for "walked away without pausing" (does not exist in the code today) — flag it as a known later refinement, not a silent gap. Inherits the `UX-006` P0 suppression contract. Pomodoro suppression (Q4 — decided): explicitly suppress this nudge while in Pomodoro mode. Because it reads the cumulative active-awake accumulator, without a `mode !== pomodoro` gate it WILL fire at ~90 min of cumulative Pomodoro focus — redundant with the per-interval break prompts and a double-nudge the trust thesis forbids. Suppress cleanly, do not debounce.
- Commits: `d9c9b55`

### SES-003 — Running timers should support adding more time before time is up
- Priority: High
- Status: Done
- Version: 2.3.0
- Why it matters: Users often realize mid-session that they need a little more time and should be able to extend the current timer without waiting for the time-up interruption.
- Files: `src/renderer/App.jsx`, active timer controls, compact/floating timer surfaces, `tests/e2e/electron-flows.spec.js`
- Related: `SES-002`
- Notes: Scope this as an in-session add-time control for active timed sessions, not just the existing post-expiry time-up flow. First pass should make it easy to add a few common increments plus a custom amount, update the visible timer immediately across full, compact, and floating surfaces, and preserve check-in/pulse timing in a predictable way after the extension. Scope (Q3 — decided): in 2.3.0 add-time applies to normal timed sessions ONLY, NOT inside Pomodoro work intervals — Pomodoro's `Keep going` / skip-break is its native extend affordance, and a second in-interval extend control would muddy the fixed-interval semantics and next-break scheduling. Do not render a greyed-out add-time control in Pomodoro; simply don't surface it there.
- Commits: `d9c9b55`

### UX-007A — Floating re-entry prompt should finish its snooze and collapse behavior
- Priority: High
- Status: Done
- Version: 2.3.0
- Why it matters: The floating prompt becomes much more trustworthy when dismissing it feels lightweight and predictable instead of sticky.
- Files: `src/main/floating-icon.html`, `src/main/floatingPreload.js`, `src/main/main.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-006`
- Notes: Complete the existing floating re-entry prompt behavior before adding new timer modes. Escape and click-away should snooze for `10 minutes`, choosing a snooze in the floating re-entry flow should collapse immediately to minimized floating by default, and the window sizing/animation should feel clean through every prompt stage. Treat the minimized float state as the quiet default after snooze rather than restoring the larger prompt surface.
- Commits: `d9c9b55`

### WIN-008 — Floating logo should not pulse while re-entry is snoozed
- Priority: High
- Status: Done
- Version: 2.3.0
- Why it matters: Snooze is supposed to buy quiet time. If the floating logo keeps pulsing anyway, the app feels like it ignored the user’s choice and the snooze becomes hard to trust.
- Files: `src/renderer/App.jsx`, `src/main/main.js`, `src/main/floating-icon.html`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-006`, `UX-007A`
- Notes: Treat this as a bug, not a new cue design. When re-entry is snoozed, suppress both the floating prompt and the floating logo pulse until the snooze expires or the user explicitly reopens the app. Acceptance should verify that choosing any snooze option collapses back to the icon without follow-up pulse animations during the snooze window.
- Commits: `d9c9b55`

### UX-007B — Floating re-entry should support Pomodoro as a first-class start mode
- Priority: High
- Status: Done
- Version: 2.3.0
- Why it matters: Pomodoro is a meaningful new timer mode, not just a prompt tweak, and it should land after the post-session and re-entry foundations are solid.
- Files: `src/main/floating-icon.html`, `src/main/floatingPreload.js`, `src/main/main.js`, `src/renderer/App.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-006`, `UX-007A`
- Notes: Add `Pomodoro` to the existing start-session flow rather than creating a parallel entry path. The mode should manage work/break cycling, skip the normal single-session time-up path, and keep history/check-in semantics predictable across chained intervals. Design decisions (Q1/Q2 — decided): ship CUSTOM work/break lengths from the first pass via preset chips (`25/5`, `50/10`, `custom`) plus one-tap start on a default preset — NOT locked 25/5. The work interval reuses the existing `timed` mode (arbitrary minutes already supported via `handleStartSession`), so only break cycling is genuinely net-new. The break must stay skippable (`Keep going`) — a forced break is a Never-list violation. History (Q2): record ONE session per cycle by accumulating total focus time into a single record, reusing the existing same-record + `carryoverSeconds` pattern rather than one row per interval — the store is a flat `sessions` array with no parent/group concept, so a per-interval breakdown would need a new `intervals[]` sub-array and is deferred to a later pass. No per-interval `did you finish?` prompt or score; one cycle = one wrap. Cycle semantics (Q1/Q2 — decided): a `cycle` = the FULL Pomodoro run (all chained work intervals until the user ends the mode) — the run is the single wrap AND the single history record; breaks are internal transitions, not wraps. `Keep going` at a break SKIPS the break and starts the NEXT full work interval (fresh full-length countdown, next break re-scheduled), presented as seamless continuation — same task, same accumulating record, no interim wrap — NOT a silent conversion to Freeflow (which would drop the time structure the user chose).
- Commits: `d9c9b55`

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
- Status: Next Up
- Version: 2.5.0
- Why it matters: Historical usage is still stranded on users' Macs because Supabase only sees feedback-backed sessions today. A one-time backfill on the next app open would recover real session history for users who still have their local Electron Store data, making analytics materially more trustworthy without waiting for a full long-term sync architecture.
- Files: `src/renderer/App.jsx`, `src/renderer/adapters/store.js`, `src/main/store.js`, licensing/startup flow, future Supabase session-sync endpoint
- Related: `ANA-004`, `HIST-001`
- Notes: Ship this inside the 2.5.0 Focus Ledger work as a device-local historical import, not a general cloud history feature. After the user opts into Focus Insights, read local `sessions` from Electron Store, upload unsynced historical sessions as `precision = session_only_backfill`, and persist a local marker so the same rows are not resent. Do not attempt to reconstruct historical per-subtask time; accurate per-subtask timing begins only after segment capture ships. Important constraint: this only works if the original local store still exists on that same machine; it will not recover history from wiped installs or different devices. Acceptance should verify an existing user with local session history can opt in once, create session/main-task backfill rows, relaunch without duplicates, and still keep task names out of cloud payloads when the task-name preference is disabled.
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

### INIT-001 — Task-initiation scaffold should help users cross from stuck to started
- Priority: High
- Status: Later
- Version: 2.4.2 candidate
- Why it matters: Every current and in-flight feature assumes the user has already started. Task initiation is the highest-friction executive-function domain in ADHD and the one Focana's framework serves least. Nothing today helps the user cross from blank/overwhelmed to typing the first concrete action, which is where ADHD users abandon focus tools.
- Files: `src/renderer/App.jsx`, task-input and session-start surfaces, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: `INIT-002`, `TASK-002`, `UX-018`, `UX-020`
- Notes: Add one optional prompt at session start — `What's the very first thing you'll actually do?` — plus an optional 2-minute `just start` micro-commitment that begins a short low-stakes timer to reduce activation energy. Evidence: task-initiation deficit is core to ADHD `[Peer-reviewed]` / `[Clinical consensus]`; the "smallest physical next step / start for 2 minutes" tactic is `[Clinical consensus]` + `[Lived experience]`. Keep it user-authored (NOT AI-generated) and always skippable — making it mandatory recreates the task-paralysis problem it is meant to solve. Maps to strengthening Externalized Working Memory (hold the first action on screen) or a candidate new coping mechanism, "Activation Scaffolding." Anti-pattern traps: no shame for skipping, no forcing it every session. Build: light-medium; reuses existing task-input and timer surfaces. Design decisions (Q5/Q6 — decided): present the scaffold AMBIENT-INLINE in the normal start flow for everyone — reframe the task field everyone already fills — NOT as an opt-in "I'm stuck" branch (routing to help needs the metacognition + initiation that are impaired in that exact moment, so the branch gets used least by those who need it most) and NOT as a mandatory gate. The 2-minute `just start` is a lightweight pre-session RAMP that rolls into ONE normal block: reuse the existing shell-session pattern (`ensureCurrentSessionId`, `duration_minutes: 0`, updated in place) and keep updating the same record instead of creating a second history row. If the user stops at 2 minutes, save it as legitimate small work, never `incomplete`, and do NOT fire the post-session wrap/feedback on the micro-block; give one quiet, consistent `You started — keep going?` acknowledgment (predictable/earned per `RWD-001`, never variable). Keep the deeper `feeling stuck?` off-ramp distinct in `EMO-001` (2.5.0) so the branch isn't built twice. Post-ramp default (Q5 — decided): when the user hits `Keep going` after the 2-minute ramp, default to Freeflow count-up — zero decisions, no imposed deadline — because there is NO persisted last-used timer length to reuse (`timedSegmentDuration` is only the active/restoring session's value) and at ramp time the user often hasn't picked a length at all; asking `how long?` reinserts the exact decision load that just blocked them, and an imposed countdown creates a latent `you failed` state if they stop early. Offer `reuse last length` only as a secondary one-tap when a length actually exists; the primary/Enter action is count-up. Never silently commit them to a countdown they did not choose.
- Commits: —

### INIT-002 — Implementation intentions should let users pre-commit an if-then plan
- Priority: High
- Status: Later
- Version: 2.4.2 candidate / TBD
- Why it matters: If-then pre-commitment is the strongest-evidence behavioral lever on the roadmap for starting and re-starting work, and it pairs naturally with Focana's existing re-entry cues.
- Files: `src/renderer/App.jsx`, `src/renderer/components/ReentryPrompt.jsx`, session-planning surfaces, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: `INIT-001`, `UX-006`, `UX-016`
- Notes: Add an optional `when ___, I'll ___` field at planning, tied to re-entry cues (e.g. `When I finish this call, I'll open Focana and start the next step`). Evidence: implementation intentions (Gollwitzer's if-then plans) improved response inhibition and normalized the P300 in children with ADHD to methylphenidate-equivalent levels on a Go/NoGo task (Paul-Jordanov, Bechtold & Gawrilow, 2010) `[Peer-reviewed, controlled trial]`; adult desktop application is a `[Speculative]` extrapolation from a children's lab study. Keep it to one or two intentions — do not build a rules-engine settings maze (opaque/complex settings is an anti-pattern). Maps to a candidate new coping mechanism, "Prospective / If-Then Planning." Build: medium. Surface (Q6 — decided): surface if-then plans on RE-ENTRY prompts only (author at planning/pause, show in `ReentryPrompt.jsx` on return) — NOT during the running session. The mechanism is cue-triggered at the moment of return, so mid-focus surfacing is both an interruption and off-target. Cap at one or two plans surfaced at re-entry; no continuously-evaluated rules engine.
- Commits: —

### INIT-003 — Prep Next Session should queue the next plan before a transition
- Priority: High
- Status: Next Up
- Version: 2.4.1
- Why it matters: Transitions are where working memory falls on the floor. If the user is about to leave, commute, ride to a coffee shop, or take a real break, they should be able to park the exact next task, subtasks, and next-up items inside Focana instead of writing a paper note they might lose or ignore. Coming back should start from a prepared plan, not a blank task field.
- Files: `src/renderer/App.jsx`, `src/renderer/components/SessionBuilderComposer.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/main/store.js`, `tests/e2e/electron-flows.spec.js`
- Related: `INIT-001`, `INIT-002`, `TASK-002`, `UX-018`, `UX-020`, `UX-015`, `EMO-001`
- Notes: Add a lightweight `Prep Next Session` path that lets the user author ONE prepared next-session draft without starting a timer or adding ceremony. Example flow: before leaving, open Focana and enter `Main task: Write onboarding copy`, `Subtasks: Review notes, Draft headline, Tighten CTA`, and `Next-up items: Reply to Jamie, Pull screenshots`; then choose `Save for later` or `Ready when I'm back`. Include an optional session-prep deep-breathing reset as a short guided step before saving or starting a prepared session. It should be skippable, quiet, and behavioral: a simple breathing cadence or count, no health claims, no mood tracking, no requirement before focus starts, and no shame if the user skips it. On return, Focana should open to that prepared plan with exactly three obvious actions: `Start`, `Edit`, and `Clear`. Starting hands off to the same session-start path as a normal planned session with subtasks and next-up items intact. Scope guard: one prepared plan at a time, no project board, no schedule/reminder system, no multiple saved templates, no calendar, no recurring tasks, and no pressure copy if the user changes their mind. Acceptance should verify the draft survives relaunch, can be created from idle and session-boundary moments, starts with subtasks/next-up items intact, the breathing reset can be started/skipped without blocking the plan, does not overwrite an active/resumable session, and keeps keyboard/screen-reader affordances on the return surface.
- Commits: —

### RWD-001 — Subtask completion should give predictable immediate reinforcement
- Priority: Medium
- Status: Next Up
- Version: 2.5.0
- Why it matters: Delayed reward is aversive for ADHD brains, so reinforcement should land at each checked subtask, not only at session end. The current Dopamine-Positive Design celebration is session-level; this pushes it to sub-task granularity where the delay-aversion penalty bites hardest.
- Files: `src/renderer/components/RunningTaskPlan.jsx`, `src/renderer/components/CompactMode.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-020`, `UX-021`, `ANA-004`
- Notes: Add a small, consistent, earned acknowledgment on each checked subtask in the existing `UX-020` checklist. Evidence: altered reward processing in ADHD splits into dissociable pathways — immediate-reward drive vs. delay aversion (Sonuga-Barke et al., 2011) `[Peer-reviewed]`; the implication is that reinforcement must be immediate at subtask granularity. Critical anti-pattern: the reward must be predictable and consistent, NEVER variable-ratio. No random jackpots, point-hoarding, or streaks (explicitly forbidden by the Never list and actively harmful given dopamine dysregulation). Same acknowledgment, every time, earned. Build: light — mostly a micro-interaction on an existing surface.
- Commits: —

### EMO-001 — An emotional off-ramp should help at the moment of avoidance
- Priority: Medium
- Status: Later
- Version: 2.5.1 candidate / TBD
- Why it matters: Emotional self-regulation sits at the center of the adult-ADHD executive-function deficit, yet Focana's coping-mechanism framework currently has no mechanism for it. This is the most conspicuous gap in the model relative to the go-to-EF-app goal.
- Files: `src/renderer/App.jsx`, running-session + check-in surfaces, `src/renderer/components/ParkingLot.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-017`, `INIT-001`
- Notes: Add an available, never auto-triggered `feeling stuck?` pathway offering three concrete behavioral moves — shrink the task, dump the overwhelm to Parking Lot, or take a 2-minute reset. Behavioral, not advisory. Evidence: emotional dysregulation is core to adult ADHD `[Peer-reviewed]` / `[Clinical consensus]`; the specific product intervention is `[Speculative]`. Maps to a candidate new coping mechanism, "Affective Scaffolding / Overwhelm Off-ramp." Copy caution: this is the item most likely to drift into therapeutic/clinical framing — keep it strictly behavioral and non-clinical. No "we'll calm your anxiety," no mood tracking that implies assessment or diagnosis. Treat any clinical-sounding claim as unvalidated and verify copy before shipping. Build: medium.
- Commits: —

### UX-022 — Task transitions should support a light disengagement beat
- Priority: Low
- Status: Later
- Version: 2.5.0 stretch / TBD
- Why it matters: In ADHD the hard part of a task switch is often disengaging from the current task (hyperfocus), not just starting the next one. A defined edge between tasks supports cognitive flexibility / set-shifting.
- Files: `src/renderer/App.jsx`, post-session / Session Wrap surfaces, `tests/e2e/electron-flows.spec.js`
- Related: `UX-010`, `UX-013`, `UX-015`
- Notes: Add a single optional `landing` beat between tasks so a switch has a defined edge, extending Context Continuity. Evidence: disengagement / set-shifting difficulty in ADHD is `[Clinical consensus]`, less rigorously quantified than initiation. Check for overlap with the shipped Session Wrap before building — this may already be partly covered. Anti-pattern: do not add ceremony (`UX-013` is actively removing ceremony); keep it to one optional beat or skip it. Build: light-medium.
- Commits: —

## Done

### UX-025 — Pomodoro breaks should require an intentional handoff before resuming
- Status: Done
- Version: 2.4.1
- Why it matters: If Pomodoro silently rolls from work into break and then into the next work interval, users can miss the transition or return disoriented. A small typed break plan makes the break deliberate without making it punitive.
- Files: `src/renderer/App.jsx`, `src/renderer/components/PomodoroBreakPanel.jsx`, `src/renderer/styles/main.css`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-007B`, `UX-015`, `UX-017`
- Notes: When a Pomodoro work interval reaches zero, Focana now shows a `Break time` handoff and disables `Start break` until the user types how they are going to break. The break remains skippable via `Keep going`. When the break countdown ends, Focana waits on a `Ready to resume?` state with `Start focus` instead of auto-starting the next work interval. The break intention is persisted with timer state so reloads do not strand the user mid-transition.
- Commits: —

### UX-026 — Visible saved work should be To-Do, not full Session History
- Status: Done
- Version: 2.4.1
- Why it matters: The full session log is a recovery tool, not something most users need in their face. The visible surface should help people pick work back up quickly without asking them to scan completed/discarded history.
- Files: `src/renderer/components/HistoryModal.jsx`, `src/renderer/components/ReentryPrompt.jsx`, `src/renderer/components/SettingsModal.jsx`, `src/renderer/App.jsx`, `src/main/floating-icon.html`, `src/main/tray.js`, `tests/e2e/electron-flows.spec.js`
- Related: `UX-003`, `INIT-003`, `TASK-003`
- Notes: User-facing access is now labeled `To-Do` and defaults to saved resumable work. The completed/discarded log remains available through `Session records`, preserving restore/delete recovery without making the first modal view feel like a bulky audit trail. Re-entry prompts and the tray label use the same To-Do language. This is a presentation change only: completed and discarded sessions stay in the local `sessions` archive for recovery and future weekly insights unless the user explicitly deletes them.
- Commits: —

### LIC-002 — Focana should offer a 7-day free trial before $79 lifetime or $10/month
- Status: Done
- Version: 2.2.3
- Why it matters: Users need a low-friction way to experience the full focus loop before paying, but the upgrade path still has to be clear, simple, and trustworthy once the trial ends.
- Files: `src/main/licenseService.js`, `src/main/licenseConfig.js`, `src/main/main.js`, `src/renderer/App.jsx`, `src/renderer/components/SettingsModal.jsx`, checkout/activation surfaces, `tests/license-service.test.js`, `tests/e2e/electron-flows.spec.js`
- Related: `LIC-001`, `SET-002`, `I18N-001`
- Notes: Focana now starts new licensed builds in a `7-day` trial, preserves the trial window through deactivation, blocks access on day 8 until a paid license activates, and routes expired trials to a calm upgrade gate with `$10/mo` and `$79 lifetime` checkout actions. Settings also shows trial state and upgrade actions. Unit coverage verifies trial start/deactivation preservation and day-8 expiry; E2E coverage verifies the expired-trial gate, window sizing, monthly/lifetime Lemon checkout links, and startup-gate stability. Lifecycle email follow-up is tracked separately in `MKT-001`.
- Commits: `545014f`, `45989f4`

### SET-003 — Auto-launch should feel polished and context-aware after login launch
- Status: Done
- Version: 2.2.4
- Why it matters: If launch-at-login feels abrupt, noisy, or ambiguous, the default-on behavior can feel like the app is happening to the user instead of quietly supporting them.
- Files: `src/main/main.js`, `src/renderer/App.jsx`, `src/main/store.js`, `src/renderer/components/SettingsModal.jsx`, `tests/e2e/electron-flows.spec.js`
- Related: `SET-001`, `SES-001`, `SES-002`
- Notes: The resident float-first startup path is implemented. Manual launches keep the normal idle shell, login and wake system-entry flows float first and then reveal `What's next?` or `Ready to resume?`, restart launches with paused work open resume immediately, and first-launch activation/preferred-name gates still win over login launch. E2E coverage includes manual launch, login launch, login with saved work, wake+login, wake+resume, interrupted active sessions, saved resumable tasks, and in-app restart behavior.
- Commits: `d2700ef`, `2876141`, `545014f`, `45989f4`

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
