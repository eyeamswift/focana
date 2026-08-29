const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const AUDIT_ENABLED = process.env.FOCANA_UI_AUDIT_STRESS === '1';
const AUDIT_SEED = process.env.FOCANA_UI_AUDIT_SEED || 'focana-ui-audit';
const AUDIT_DIR = path.resolve(
  process.env.FOCANA_UI_AUDIT_DIR || path.join(APP_ROOT, 'outputs', 'ui-audit', AUDIT_SEED),
);
const SEQUENCE_COUNT = 12;
const STEPS_PER_SEQUENCE = 40;
const TASK_TEXT = (`Window transition audit — résumé review 🟠 ${'unbroken'.repeat(7)}`).slice(0, 96);

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function choose(items, random) {
  return items[Math.floor(random() * items.length)];
}

function createStoreDir(sequenceId) {
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), `focana-ui-audit-${sequenceId}-`));
  fs.writeFileSync(path.join(storeDir, 'config.json'), JSON.stringify({
    userEmail: '',
    preferredName: 'Audit',
    emailPromptSkipped: true,
    settings: {
      checkInEnabled: false,
      alwaysOnTop: false,
    },
  }, null, 2));
  return storeDir;
}

function isMainWindow(win) {
  const url = win.url();
  return url.includes('localhost:5173') || (url.includes('/index.html') && !url.includes('floating-icon.html'));
}

async function launchAuditApp(sequenceId) {
  const storeDir = createStoreDir(sequenceId);
  const electronApp = await electron.launch({
    cwd: APP_ROOT,
    args: ['.'],
    env: {
      ...process.env,
      FOCANA_E2E: '1',
      FOCANA_E2E_BACKGROUND: '1',
      FOCANA_STORE_CWD: storeDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
  });

  let page = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    page = electronApp.windows().find((win) => isMainWindow(win)) || null;
    if (page) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!page) throw new Error('Could not find the main audit window.');
  await page.waitForSelector('[data-testid="task-input"]');

  return {
    electronApp,
    page,
    storeDir,
    async cleanup() {
      try {
        await electronApp.close();
      } finally {
        fs.rmSync(storeDir, { recursive: true, force: true });
      }
    },
  };
}

async function readMode(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-window-mode'));
}

async function readVisibilityAndBounds(electronApp) {
  return electronApp.evaluate(({ BrowserWindow, screen }) => {
    const windows = BrowserWindow.getAllWindows();
    const main = windows.find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    const floating = windows.find((win) => win.webContents.getURL().includes('floating-icon.html'));
    const mainBounds = main?.getBounds() || null;
    const floatingBounds = floating?.getBounds() || null;
    const targetBounds = floating?.isVisible() ? floatingBounds : mainBounds;
    const display = targetBounds ? screen.getDisplayMatching(targetBounds) : screen.getPrimaryDisplay();
    return {
      mainVisible: Boolean(main?.isVisible() && (main.getOpacity?.() ?? 1) >= 0.99),
      mainFocused: Boolean(main?.isFocused()),
      floatingVisible: Boolean(floating?.isVisible()),
      floatingFocused: Boolean(floating?.isFocused()),
      mainBounds,
      floatingBounds,
      workArea: display.workArea,
    };
  });
}

function expectBoundsInWorkArea(bounds, workArea) {
  expect(bounds).toBeTruthy();
  expect(Number.isFinite(bounds.x)).toBe(true);
  expect(Number.isFinite(bounds.y)).toBe(true);
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.height).toBeGreaterThan(0);
  expect(bounds.x).toBeGreaterThanOrEqual(workArea.x - 2);
  expect(bounds.y).toBeGreaterThanOrEqual(workArea.y - 2);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(workArea.x + workArea.width + 2);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(workArea.y + workArea.height + 2);
}

async function waitForStableVisibleBounds(electronApp) {
  let previous = null;
  let stableSamples = 0;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const snapshot = await readVisibilityAndBounds(electronApp);
    const current = snapshot.floatingVisible ? snapshot.floatingBounds : snapshot.mainBounds;
    const serialized = JSON.stringify(current);
    stableSamples = serialized === previous ? stableSamples + 1 : 0;
    if (stableSamples >= 2) return snapshot;
    previous = serialized;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error('Visible window bounds did not settle.');
}

async function waitForFloatingWindow(electronApp) {
  await expect.poll(() => electronApp.windows().some((win) => win.url().includes('floating-icon.html'))).toBe(true);
  return electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
}

async function startFreeflow(page) {
  const input = page.locator('[data-testid="task-input"]');
  await input.fill(TASK_TEXT);
  await input.press('Enter');
  await page.getByRole('button', { name: 'Freeflow' }).click();
  await expect.poll(() => readMode(page)).toBe('pill');
}

async function exitPill(page) {
  await expect.poll(async () => page.locator('.pill-mode--transitioning').count()).toBe(0);
  const pill = page.locator('.pill');
  const box = await pill.boundingBox();
  await pill.dblclick({ position: { x: 10, y: Math.max(8, Math.min((box?.height || 72) / 2, (box?.height || 72) - 8)) } });
  await expect.poll(() => readMode(page)).toBe('full');
}

async function enterPill(page) {
  await page.getByRole('button', { name: 'Enter Compact Mode' }).click();
  await expect.poll(() => readMode(page)).toBe('pill');
}

async function enterFloating(page, electronApp) {
  await page.evaluate(() => window.electronAPI.toggleFloatingMinimize());
  const floating = await waitForFloatingWindow(electronApp);
  await expect.poll(async () => (await readVisibilityAndBounds(electronApp)).floatingVisible).toBe(true);
  return floating;
}

async function exitFloating(electronApp) {
  const floating = await waitForFloatingWindow(electronApp);
  await floating.evaluate(() => window.floatingAPI.expand());
  await expect.poll(async () => (await readVisibilityAndBounds(electronApp)).mainVisible).toBe(true);
}

async function moveVisibleWindow(electronApp, random, { resize = false } = {}) {
  await electronApp.evaluate(({ BrowserWindow, screen }, payload) => {
    const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    if (!main) return;
    const current = main.getBounds();
    const workArea = screen.getDisplayMatching(current).workArea;
    const widths = [432, 560, Math.min(760, workArea.width)];
    const heights = [180, 420, Math.min(680, workArea.height)];
    const width = payload.resize ? widths[payload.sizeIndex % widths.length] : current.width;
    const height = payload.resize ? heights[payload.sizeIndex % heights.length] : current.height;
    const positions = [
      { x: workArea.x, y: workArea.y },
      { x: workArea.x + workArea.width - width, y: workArea.y },
      { x: workArea.x, y: workArea.y + workArea.height - height },
      { x: workArea.x + workArea.width - width, y: workArea.y + workArea.height - height },
    ];
    main.setBounds({ ...positions[payload.positionIndex % positions.length], width, height });
  }, {
    resize,
    sizeIndex: Math.floor(random() * 1000),
    positionIndex: Math.floor(random() * 1000),
  });
}

async function dragPill(page, random) {
  const dx = random() < 0.5 ? -4000 : 4000;
  const dy = random() < 0.5 ? -4000 : 4000;
  await page.evaluate(({ nextDx, nextDy }) => {
    window.electronAPI.pillDragStart();
    window.electronAPI.pillDragMove(nextDx, nextDy);
    window.electronAPI.pillDragEnd();
  }, { nextDx: dx, nextDy: dy });
}

async function dragFloating(electronApp, random) {
  const floating = await waitForFloatingWindow(electronApp);
  const dx = random() < 0.5 ? -4000 : 4000;
  const dy = random() < 0.5 ? -4000 : 4000;
  await floating.evaluate(({ nextDx, nextDy }) => {
    window.floatingAPI.dragStart();
    window.floatingAPI.dragMove(nextDx, nextDy);
    window.floatingAPI.dragEnd();
  }, { nextDx: dx, nextDy: dy });
}

async function toggleTheme(electronApp, page) {
  const currentTheme = await page.evaluate(() => document.documentElement.dataset.theme || 'light');
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  await electronApp.evaluate(({ BrowserWindow }, theme) => {
    const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    main?.webContents.send('tray-theme-select', theme);
  }, nextTheme);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(nextTheme);
}

async function revealCompactControls(page) {
  const completeButton = page.getByRole('button', { name: 'Complete task', exact: true });
  if (!await completeButton.isVisible().catch(() => false)) {
    await page.locator('.pill-timer-button').click();
  }
  await expect(completeButton).toBeVisible();
}

async function assertRendererGeometry(page, mode) {
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const selectors = [
      '.pill',
      '.pill-timer-button',
      '.focus-hero',
      'button[aria-label="Enter Compact Mode"]',
      'button[aria-label="Minimize to Floating"]',
    ];
    const visibleRects = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        return { selector: element.matches('.pill') ? '.pill' : selectorFor(element), rect, styles };
      })
      .filter(({ rect, styles }) => styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0)
      .map(({ selector, rect }) => ({ selector, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom }));

    function selectorFor(element) {
      return element.getAttribute('aria-label') || element.className || element.tagName;
    }

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      horizontalOverflow: Math.max(root.scrollWidth - root.clientWidth, body.scrollWidth - body.clientWidth),
      visibleRects,
    };
  });

  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
  for (const rect of geometry.visibleRects) {
    expect(rect.left, `${rect.selector} left edge`).toBeGreaterThanOrEqual(-1);
    expect(rect.top, `${rect.selector} top edge`).toBeGreaterThanOrEqual(-1);
    expect(rect.right, `${rect.selector} right edge`).toBeLessThanOrEqual(geometry.innerWidth + 1);
    expect(rect.bottom, `${rect.selector} bottom edge`).toBeLessThanOrEqual(geometry.innerHeight + 1);
  }
  expect(await readMode(page)).toBe(mode);
}

async function assertSettledState(electronApp, page, state, previousTimerSeconds) {
  const snapshot = await waitForStableVisibleBounds(electronApp);
  expect(snapshot.mainFocused).toBe(false);
  expect(snapshot.floatingFocused).toBe(false);
  if (state === 'floating') {
    expect(snapshot.mainVisible).toBe(false);
    expect(snapshot.floatingVisible).toBe(true);
    expectBoundsInWorkArea(snapshot.floatingBounds, snapshot.workArea);
  } else {
    expect(snapshot.floatingVisible).toBe(false);
    expectBoundsInWorkArea(snapshot.mainBounds, snapshot.workArea);
    await assertRendererGeometry(page, state);
  }

  const currentTask = await page.evaluate(() => window.electronAPI.storeGet('currentTask'));
  expect(currentTask?.text).toBe(TASK_TEXT);
  const timerText = state === 'floating'
    ? await electronApp.windows()
      .find((win) => win.url().includes('floating-icon.html'))
      ?.locator('#timer-pill').textContent().catch(() => null)
    : await page.locator(state === 'pill' ? '.pill-timer' : '.focus-hero__clock').first().textContent().catch(() => null);
  const parts = String(timerText || '').trim().split(':').map(Number);
  const timerSeconds = parts.length === 3
    ? (parts[0] * 3600) + (parts[1] * 60) + parts[2]
    : parts.length === 2
      ? (parts[0] * 60) + parts[1]
      : previousTimerSeconds;
  if (Number.isFinite(previousTimerSeconds) && Number.isFinite(timerSeconds)) {
    expect(timerSeconds).toBeGreaterThanOrEqual(previousTimerSeconds);
    expect(timerSeconds - previousTimerSeconds).toBeLessThanOrEqual(15);
  }
  return Number.isFinite(timerSeconds) ? timerSeconds : previousTimerSeconds;
}

const auditRecords = [];

if (AUDIT_ENABLED) {
  test.describe('seeded window transition stress audit', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(() => {
      fs.mkdirSync(path.join(AUDIT_DIR, 'screenshots'), { recursive: true });
    });

    test.afterAll(() => {
      fs.writeFileSync(path.join(AUDIT_DIR, 'sequence-results.json'), `${JSON.stringify({
        seed: AUDIT_SEED,
        sequenceCount: SEQUENCE_COUNT,
        stepsPerSequence: STEPS_PER_SEQUENCE,
        sequences: auditRecords,
      }, null, 2)}\n`);
    });

    for (let sequenceIndex = 0; sequenceIndex < SEQUENCE_COUNT; sequenceIndex += 1) {
      const sequenceId = `sequence-${String(sequenceIndex + 1).padStart(2, '0')}`;
      test(`${sequenceId} keeps bounds, focus, task, and timer stable for 40 actions`, async () => {
        const random = mulberry32(hashSeed(`${AUDIT_SEED}:${sequenceIndex + 1}`));
        const app = await launchAuditApp(sequenceId);
        const record = {
          id: sequenceId,
          seed: `${AUDIT_SEED}:${sequenceIndex + 1}`,
          actions: [],
          finalState: null,
          theme: null,
          screenshotPath: null,
        };
        auditRecords.push(record);
        let state = 'pill';
        let floatingOrigin = 'pill';
        let previousTimerSeconds = null;

        try {
          await startFreeflow(app.page);
          previousTimerSeconds = await assertSettledState(app.electronApp, app.page, state, previousTimerSeconds);

          for (let step = 0; step < STEPS_PER_SEQUENCE; step += 1) {
            const candidates = state === 'pill'
              ? ['pill_to_full', 'pill_to_floating', 'drag_pill', 'reveal_controls', 'toggle_theme']
              : state === 'full'
                ? ['full_to_pill', 'full_to_floating', 'move_full', 'resize_full', 'toggle_theme']
                : ['floating_to_origin', 'drag_floating', 'toggle_theme'];
            const action = choose(candidates, random);
            record.actions.push(action);

            await test.step(`step ${step + 1}: ${action}`, async () => {
              if (action === 'pill_to_full') {
                await exitPill(app.page);
                state = 'full';
              } else if (action === 'pill_to_floating' || action === 'full_to_floating') {
                floatingOrigin = state;
                await enterFloating(app.page, app.electronApp);
                state = 'floating';
              } else if (action === 'full_to_pill') {
                await enterPill(app.page);
                state = 'pill';
              } else if (action === 'floating_to_origin') {
                await exitFloating(app.electronApp);
                state = floatingOrigin;
                await expect.poll(() => readMode(app.page)).toBe(state);
              } else if (action === 'drag_pill') {
                await dragPill(app.page, random);
              } else if (action === 'drag_floating') {
                await dragFloating(app.electronApp, random);
              } else if (action === 'move_full') {
                await moveVisibleWindow(app.electronApp, random);
              } else if (action === 'resize_full') {
                await moveVisibleWindow(app.electronApp, random, { resize: true });
              } else if (action === 'reveal_controls') {
                await revealCompactControls(app.page);
              } else if (action === 'toggle_theme') {
                await toggleTheme(app.electronApp, app.page);
              }

              previousTimerSeconds = await assertSettledState(
                app.electronApp,
                app.page,
                state,
                previousTimerSeconds,
              );
            });
          }

          const screenshotWindow = state === 'floating'
            ? await waitForFloatingWindow(app.electronApp)
            : app.page;
          const theme = await app.page.evaluate(() => document.documentElement.dataset.theme || 'light');
          const screenshotPath = path.join(AUDIT_DIR, 'screenshots', `${sequenceId}-${state}-${theme}.png`);
          await screenshotWindow.screenshot({ path: screenshotPath });
          record.finalState = state;
          record.theme = theme;
          record.screenshotPath = screenshotPath;
        } finally {
          await app.cleanup();
        }
      });
    }
  });
}
