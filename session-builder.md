# Session Builder Handoff

## Status

Approved design direction for the next Session Builder update. This document captures the product decisions, UI behavior, implementation shape, and test plan so the work can resume without re-litigating the flow.

## Approved Direction

- Keep the primary task always visible as the main focus entry.
- Put optional subtasks and next-up tasks inside a collapsible `Session Builder`.
- The builder is collapsed by default for a new/simple task.
- Empty optional sections are hidden while collapsed.
- The builder opens after the user adds structure.
- V1 supports one subtask level only.
- The active top-level task remains the label used by the timer, check-ins, history labels, shortcuts, and compact mode.

## Set Your Next Focus

Standard collapsed state:

- Show the `Set your next focus` surface.
- Show `Primary task` and the primary task field.
- Show a collapsible `Session Builder` row directly below the primary field.
- Empty collapsed summary copy: `Optional steps and next-up tasks`.
- Populated collapsed summary examples:
  - `3 subtasks - no next-up tasks`
  - `2 subtasks - 1 next-up task`
  - `No subtasks - 2 next-up tasks`
- Use a chevron plus a small `Show` / `Hide` affordance on the row.
- No import/paste parser, file import, or AI parsing in V1.

Expanded builder state:

- Keep the primary task field above the builder content.
- Show a `Subtasks` section with checkbox rows and `+ Add subtask`.
- Show a `Next-up tasks` section with checkbox rows and `+ Add task`.
- If a section is empty while expanded, show an empty state:
  - Subtasks: `No subtasks yet` and `Add smaller steps only if they would help you start.`
  - Next-up tasks: `No next-up tasks yet` and `Add one only if you already know what comes after this.`
- Starting the session should trim/discard empty rows.

## Approved Screens

The following screen concepts are approved:

- `Set your next focus`: primary task visible, optional structure inside collapsible `Session Builder`.
- `Running display + overflow`: active task title, visible subtasks, a next-up chip, and `+N more` overflow.
- `Overflow preview`: hover/focus the `+N more` affordance; click pins the preview; Escape closes it.
- `Subtasks complete`: when all subtasks are complete, ask `Mark [task] complete?` with `Mark complete` and `Keep going`.
- `Next task transition`: after completing the active task, show `Nice work`, the completed task, the next task, and actions:
  - `Continue with [next task]`
  - `Take a break`
  - `Save and continue later`
- `Compact mode preview`: compact remains task-first and reveals plan detail through hover/focus/long press.

## Data Model

Add structured task planning data alongside existing string fields.

```js
taskPlan = {
  version: 1,
  activeTaskId: 'task-id',
  items: [
    {
      id: 'task-id',
      title: 'Prepare launch email',
      completed: false,
      completedAt: null,
      subtasks: [
        {
          id: 'subtask-id',
          title: 'Draft subject line',
          completed: false,
          completedAt: null,
        },
      ],
    },
  ],
}
```

Compatibility rules:

- Keep `currentTask.text` as the active top-level task title.
- Keep `session.task` as the active top-level task title for session records.
- Store a `taskPlan` snapshot on session records.
- Migrate missing plans in memory from existing `currentTask.text` or `session.task` as a one-item plan.
- Do not add nested subtasks in V1.

Helper behavior to implement:

- Normalize plans.
- Create stable ids.
- Trim titles and discard empty rows.
- Find the active top-level task.
- Find the next unfinished top-level task.
- Complete/incomplete subtasks.
- Complete/incomplete top-level tasks.
- Generate collapsed builder summary copy.

## Completion Behavior

- Users can check subtasks and top-level tasks individually while the session runs.
- Completing all subtasks under a parent does not auto-complete the parent.
- When all subtasks are checked, show the parent completion prompt.
- `Keep going` dismisses the prompt and leaves the parent active.
- `Mark complete` completes the parent task.
- Marking a top-level task complete should also mark its subtasks complete.
- Completing an inactive next-up top-level task simply checks it off.
- Completing the active top-level task:
  - If another unfinished top-level task remains, show the next-task transition screen.
  - If no unfinished top-level task remains, use the existing final completion/session wrap path.
- `Continue with [next task]` opens the existing timer choice for the next task. It does not auto-start a timer.

## Display Behavior

Full running view:

- Show the active task title as the main focus.
- Show as many full subtasks and next-up tasks as fit cleanly.
- Prefer visible subtasks before next-up tasks.
- Show the first next-up task as a compact chip when space allows.
- Collapse remaining items behind `+N more`.
- The overflow preview lists the remaining full task/subtask titles.

Compact mode:

- Keep the active task title as the primary compact label.
- Show a small summary such as `3 subtasks - 2 next`.
- Reveal current plan detail on hover/focus/long press.
- Do not let plan detail resize the compact pill unexpectedly.

## Implementation Notes

- Start with docs and helpers, then wire state, then UI.
- Preserve existing single-task flows.
- Keep `data-testid="task-input"` on the primary task field.
- Reuse existing renderer components and CSS variables.
- Do not introduce a new design system.
- Do not change timer/check-in semantics beyond reading the active task title from the plan.
- No import/paste parser, file import, or AI parsing in V1.

## Test Plan

Helper tests:

- Legacy task migrates into a one-item `taskPlan`.
- Empty rows are discarded.
- Active task lookup returns the active top-level task.
- Next unfinished task lookup skips completed top-level tasks.
- Completing all subtasks triggers parent-completion eligibility but does not auto-complete the parent.
- Completing a top-level task completes its subtasks.

E2E tests:

- Simple primary-only task still starts through the existing task input flow.
- Session Builder can collapse and expand.
- User can add subtasks and next-up tasks, start a session, and see them in running view.
- Completing all subtasks shows `Mark [task] complete?`.
- Completing the active task with a next task shows `Continue with [next task]`.
- Continuing opens timer choice preloaded with the next task.
- Restart during a planned session preserves active task, completed items, timer state, and session history.

Visual QA:

- Collapsed Session Builder in light and dark themes.
- Expanded Session Builder in light and dark themes.
- Running display with overflow.
- Overflow preview.
- Subtasks-complete prompt.
- Next-task transition.
- Compact plan preview.

## Defaults And Assumptions

- File name: `session-builder.md`.
- Location: repo root.
- V1 has one subtask level only.
- Builder is collapsed by default.
- Builder auto-expands after adding structure.
- Empty optional sections are hidden while collapsed.
- Existing check-ins, history labels, shortcuts, and compact task text continue to use the active top-level task title.
