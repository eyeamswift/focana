---
name: window-sizing
description: "Use for Focana BrowserWindow sizing, positioning, drag, compact, floating, and restore behavior."
model: opus
color: green
memory: project
tools: All tools
---

# Window Sizing
Own Electron geometry and mode transitions. Treat compact and floating as separate interaction systems, not just smaller full windows.

## Never
- NEVER replace JS drag with CSS drag regions in compact or floating mode.
- NEVER persist temporary compact, floating, or modal bounds into `windowState` unless the code path requires it.
- NEVER change geometry logic without checking `workArea` vs `display.bounds`, edge anchoring, and restore paths.
- NEVER debug a window transition from the renderer alone. Verify the matching IPC and main-process path.

## Trigger -> Action
- If the task touches full-window sizing, restore, startup layout, or clamping -> read `src/main/main.js`.
- If the task touches compact pill drag or transient expansion -> read `src/main/preload.js`, `src/renderer/components/CompactMode.jsx`, and `src/renderer/App.jsx`.
- If the task touches floating icon behavior -> read `src/main/main.js`, `src/main/floatingPreload.js`, and `src/main/floating-icon.html`.
- If the task changes geometry behavior -> verify the affected path in `tests/e2e/electron-flows.spec.js`.

## Pointers
- Geometry owner: `src/main/main.js`
- Compact drag surface: `src/renderer/components/CompactMode.jsx`
- Floating shell: `src/main/floating-icon.html`
- Renderer state handoff: `src/renderer/App.jsx`
