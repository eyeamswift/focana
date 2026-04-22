# Debug Log

Reusable incident notes for bugs that are easy to repeat and expensive to rediscover.

Use this file when:
- the app launches but the renderer stays blank
- Playwright times out waiting for `[data-testid="task-input"]`
- a bug only shows up after a fresh Electron launch or build
- a fix required a non-obvious debugging path that we should reuse later

How to maintain it:
- add newest incidents at the top
- keep each entry short and operational
- include the symptom, root cause, fastest detection path, and the durable fix

## 2026-04-22: Renderer Boots To Blank Root After Resume-Flow Edit

**Symptom**

- Electron launches, but the app body is effectively empty except for `<div id="root"></div>`.
- Playwright fails at startup with `TimeoutError` while waiting for `[data-testid="task-input"]`.
- A clean launch can look deceptively quiet until the page is reloaded or console errors are captured.

**What actually happened**

- A new `useCallback` handler was declared before the helper it referenced.
- Because the helper was a `const` callback defined later in the component, the renderer hit a temporal dead zone during boot.
- The bundled console error surfaced as `ReferenceError: Cannot access 'Hi' before initialization` after minification, rather than a friendly source-name error.

**Fastest way to confirm**

1. Launch Electron against a fresh temp store.
2. If the task input never appears, inspect the page body.
   If it only contains `#root`, assume renderer boot failed.
3. Attach `console`, `pageerror`, and `requestfailed` listeners to the first window.
4. Force `page.reload()` once.
5. Look for:
   - `requestfailed ... index-*.js net::ERR_ABORTED`
   - `pageerror` or console error with `Cannot access ... before initialization`

**Root cause**

- Callback order inside [App.jsx](/Users/swift/focana/src/renderer/App.jsx) mattered.
- `handleSaveForLaterFromResumeCandidate` referenced `saveResumeCandidateForLater` before that helper was initialized.

**Fix**

- Move the dependent callback below the helper it calls.
- When adding new `useCallback` helpers in `App.jsx`, avoid forward references between `const` callbacks inside the same render scope.

**Prevention**

- After state-machine edits in [App.jsx](/Users/swift/focana/src/renderer/App.jsx), run a fresh-launch sanity check, not just hot-reload or existing dev session checks.
- If E2E startup suddenly fails for multiple unrelated tests, suspect renderer boot first before debugging individual assertions.

**Reusable probe**

```js
page.on('console', (msg) => console.log('console', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('pageerror', err.message));
page.on('requestfailed', (req) => console.log('requestfailed', req.url(), req.failure()?.errorText));
await page.reload();
```
