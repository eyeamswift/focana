const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const APP_VERSION = JSON.parse(
  fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')
).version;
const TASK_INPUT_SELECTOR = '[data-testid="task-input"]';
const RUNNING_TASK_SELECTOR = '.focus-hero__task';
const PILL_TASK_SELECTOR = '.pill-content > .pill-task .pill-task-text';
const NAME_GATE_HEADING = 'One more thing. What should we call you?';
const SYSTEM_ENTRY_TEST_DELAY_MS = '900';
const FOCUSED_CHECKIN_MESSAGES = [
  'Nice, keep going',
  'Good Job! 🍊',
  '🙂',
  'Great. You got this.',
  'You\'re doing good 👍🏾',
];
function buildSeedConfig(seedConfig = null) {
  return {
    userEmail: 'justin.franklin90@gmail.com',
    preferredName: 'Justin',
    emailPromptSkipped: true,
    ...(seedConfig || {}),
  };
}

function writeSeedConfig(storeDir, seedConfig = null) {
  fs.writeFileSync(
    path.join(storeDir, 'config.json'),
    JSON.stringify(buildSeedConfig(seedConfig), null, 2),
    'utf8'
  );
}

function createStoreDir(seedConfig = null) {
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focana-e2e-'));
  writeSeedConfig(storeDir, seedConfig);
  return storeDir;
}

function removeStoreDir(storeDir) {
  fs.rmSync(storeDir, { recursive: true, force: true });
}

async function launchApp({
  seedConfig = null,
  background = true,
  waitForTaskInput = true,
  onPage = null,
  storeDir = null,
  extraEnv = null,
} = {}) {
  const effectiveStoreDir = storeDir || createStoreDir(seedConfig);
  if (storeDir && seedConfig) {
    writeSeedConfig(storeDir, seedConfig);
  }

  const electronApp = await electron.launch({
    cwd: APP_ROOT,
    args: ['.'],
    env: {
      ...process.env,
      FOCANA_E2E: '1',
      FOCANA_E2E_BACKGROUND: background ? '1' : '0',
      FOCANA_STORE_CWD: effectiveStoreDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      ...(extraEnv || {}),
    },
  });

  const page = await electronApp.firstWindow();
  if (typeof onPage === 'function') {
    await onPage(page, electronApp);
  }
  if (waitForTaskInput) {
    await page.waitForSelector(TASK_INPUT_SELECTOR);
  }

  let didCleanup = false;
  return {
    electronApp,
    page,
    storeDir: effectiveStoreDir,
    async cleanup({ deleteStoreDir = !storeDir } = {}) {
      if (didCleanup) return;
      didCleanup = true;
      try {
        await electronApp.close();
      } finally {
        if (deleteStoreDir) {
          removeStoreDir(effectiveStoreDir);
        }
      }
    },
  };
}

async function triggerShortcutAction(electronApp, action) {
  await electronApp.evaluate(({ BrowserWindow }, incomingAction) => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    win.webContents.send('shortcut-triggered', incomingAction);
  }, action);
}

async function triggerCheckInYesShortcut(electronApp, payload = 'focused') {
  await electronApp.evaluate(({ BrowserWindow }, incomingPayload) => {
    const mainWindow = BrowserWindow.getAllWindows()
      .find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    if (!mainWindow) return;
    mainWindow.webContents.send('scoped-checkin-shortcut', incomingPayload);
  }, payload);
}

async function readGlobalShortcutRegistrationState(electronApp) {
  return electronApp.evaluate(({ globalShortcut }) => ({
    keepForLater: globalShortcut.isRegistered('CommandOrControl+Shift+K'),
    checkInYes: globalShortcut.isRegistered('CommandOrControl+Shift+Y'),
    startPause: globalShortcut.isRegistered('CommandOrControl+Shift+S'),
    newTask: globalShortcut.isRegistered('CommandOrControl+N'),
    toggleCompact: globalShortcut.isRegistered('CommandOrControl+Shift+I'),
    completeTask: globalShortcut.isRegistered('CommandOrControl+Enter'),
    openParkingLotLegacy: globalShortcut.isRegistered('CommandOrControl+Shift+P'),
  }));
}

async function setE2EFrontmostApp(page, appInfo) {
  await page.evaluate((incomingAppInfo) => (
    window.electronAPI.e2eSetFrontmostApp(incomingAppInfo)
  ), appInfo);
}

async function readE2ELastActivatedApp(page) {
  return page.evaluate(() => window.electronAPI.e2eGetLastActivatedApp());
}

function parseTimerTextToSeconds(timerText) {
  if (typeof timerText !== 'string') return null;
  const hourMatch = timerText.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    const minutes = Number(hourMatch[2]);
    const seconds = Number(hourMatch[3]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return (hours * 3600) + (minutes * 60) + seconds;
  }

  const minuteMatch = timerText.match(/^(\d{2}):(\d{2})$/);
  if (!minuteMatch) return null;
  const minutes = Number(minuteMatch[1]);
  const seconds = Number(minuteMatch[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return (minutes * 60) + seconds;
}

async function readDisplayedTimerSeconds(page) {
  const timerText = await page.evaluate(() => {
    const allText = Array.from(document.querySelectorAll('div, span'))
      .map((el) => (el.textContent || '').trim())
      .filter((text) => /^\d{2}:\d{2}$/.test(text) || /^\d+:\d{2}:\d{2}$/.test(text));
    return allText.length > 0 ? allText[0] : null;
  });

  return parseTimerTextToSeconds(timerText);
}

function isMainAppWindow(win) {
  const url = win.url();
  return url.includes('localhost:5173') || (url.includes('/index.html') && !url.includes('floating-icon.html'));
}

async function readMainWindowBounds(electronApp) {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    return main ? main.getBounds() : null;
  });
}

async function mainWindowMatchesAnchoredCompactPosition(electronApp, sourceBounds) {
  return electronApp.evaluate(({ BrowserWindow, screen }, payload) => {
    const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    if (!main || !payload) return false;

    const currentBounds = main.getBounds();
    const display = screen.getDisplayMatching(payload);
    const candidateAreas = [display.workArea, display.bounds];
    const epsilon = 2;
    const right = payload.x + payload.width;
    const bottom = payload.y + payload.height;
    const leftArea = candidateAreas.find((area) => Math.abs(payload.x - area.x) <= epsilon);
    const rightArea = candidateAreas.find((area) => Math.abs(right - (area.x + area.width)) <= epsilon);
    const topArea = candidateAreas.find((area) => Math.abs(payload.y - area.y) <= epsilon);
    const bottomArea = candidateAreas.find((area) => Math.abs(bottom - (area.y + area.height)) <= epsilon);

    const expectedX = rightArea && !leftArea
      ? Math.round((rightArea.x + rightArea.width) - currentBounds.width)
      : leftArea && !rightArea
        ? Math.round(leftArea.x)
        : payload.x;
    const expectedY = bottomArea && !topArea
      ? Math.round((bottomArea.y + bottomArea.height) - currentBounds.height)
      : topArea && !bottomArea
        ? Math.round(topArea.y)
        : payload.y;

    return Math.abs(currentBounds.x - expectedX) <= epsilon
      && Math.abs(currentBounds.y - expectedY) <= epsilon;
  }, sourceBounds);
}

async function mainWindowMatchesFloatingRestorePosition(electronApp, floatingBounds) {
  return electronApp.evaluate(({ BrowserWindow, screen }, payload) => {
    const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    if (!main || !payload) return false;

    const currentBounds = main.getBounds();
    const display = screen.getDisplayMatching(payload);
    const area = display.bounds;
    const expectedX = Math.max(area.x, Math.min(payload.x, area.x + area.width - currentBounds.width));
    const expectedY = Math.max(area.y, Math.min(payload.y, area.y + area.height - currentBounds.height));

    return Math.abs(currentBounds.x - expectedX) <= 2
      && Math.abs(currentBounds.y - expectedY) <= 2;
  }, floatingBounds);
}

async function readFloatingWindowBounds(electronApp) {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const floating = BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes('floating-icon.html'));
    return floating ? floating.getBounds() : null;
  });
}

async function floatingWindowMatchesNearestCorner(electronApp) {
  return electronApp.evaluate(({ BrowserWindow, screen }) => {
    const floating = BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes('floating-icon.html'));
    const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    if (!floating || !main) return false;

    const floatingBounds = floating.getBounds();
    const mainBounds = main.getBounds();
    const display = screen.getDisplayMatching(mainBounds);
    const workArea = display.workArea;
    const margin = 12;
    const sourceCenter = {
      x: mainBounds.x + (mainBounds.width / 2),
      y: mainBounds.y + (mainBounds.height / 2),
    };
    const candidates = [
      { x: workArea.x + margin, y: workArea.y + margin },
      { x: workArea.x + workArea.width - floatingBounds.width - margin, y: workArea.y + margin },
      { x: workArea.x + margin, y: workArea.y + workArea.height - floatingBounds.height - margin },
      { x: workArea.x + workArea.width - floatingBounds.width - margin, y: workArea.y + workArea.height - floatingBounds.height - margin },
    ];
    const nearest = candidates.reduce((closest, candidate) => {
      if (!closest) return candidate;
      const candidateCenter = {
        x: candidate.x + (floatingBounds.width / 2),
        y: candidate.y + (floatingBounds.height / 2),
      };
      const closestCenter = {
        x: closest.x + (floatingBounds.width / 2),
        y: closest.y + (floatingBounds.height / 2),
      };
      const candidateDistance = ((candidateCenter.x - sourceCenter.x) ** 2) + ((candidateCenter.y - sourceCenter.y) ** 2);
      const closestDistance = ((closestCenter.x - sourceCenter.x) ** 2) + ((closestCenter.y - sourceCenter.y) ** 2);
      return candidateDistance < closestDistance ? candidate : closest;
    }, null);

    return Math.abs(floatingBounds.x - nearest.x) <= 2
      && Math.abs(floatingBounds.y - nearest.y) <= 2;
  });
}

async function readWindowVisibilityState(electronApp) {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows();
    const main = windows.find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    const floating = windows.find((win) => win.webContents.getURL().includes('floating-icon.html'));
    const mainOpacity = main && typeof main.getOpacity === 'function' ? main.getOpacity() : 1;
    return {
      mainVisible: Boolean(main && main.isVisible() && mainOpacity >= 0.99),
      floatingVisible: Boolean(floating && floating.isVisible()),
    };
  });
}

async function readWorkspaceVisibilityState(electronApp) {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows();
    const main = windows.find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    const floating = windows.find((win) => win.webContents.getURL().includes('floating-icon.html'));
    return {
      mainVisibleOnAllWorkspaces: Boolean(main && main.isVisibleOnAllWorkspaces()),
      floatingVisibleOnAllWorkspaces: Boolean(floating && floating.isVisibleOnAllWorkspaces()),
    };
  });
}

async function installTimeOffsetControl(page) {
  await page.evaluate(() => {
    if (!window.__focanaE2ETimeControlInstalled) {
      window.__focanaE2EOriginalDateNow = Date.now.bind(Date);
      window.__focanaE2EOffsetMs = 0;
      Date.now = () => window.__focanaE2EOriginalDateNow() + (window.__focanaE2EOffsetMs || 0);
      window.__focanaE2ETimeControlInstalled = true;
      return;
    }

    window.__focanaE2EOffsetMs = 0;
  });
}

async function setTimeOffset(page, nextOffsetMs) {
  await page.evaluate((offsetMs) => {
    window.__focanaE2EOffsetMs = Number(offsetMs) || 0;
  }, nextOffsetMs);
}

async function waitForFloatingWindow(electronApp) {
  await expect.poll(() => {
    const windows = electronApp.windows();
    return windows.some((win) => win.url().includes('floating-icon.html'));
  }, { timeout: 7000 }).toBe(true);

  const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
  expect(floatingWindow).toBeTruthy();
  return floatingWindow;
}

async function readFloatingPromptState(floatingWindow) {
  return floatingWindow.evaluate(() => ({
    mode: document.body?.dataset?.mode || null,
    stage: document.body?.dataset?.mode === 'prompt'
      ? (document.querySelector('.prompt-step.is-active')?.dataset?.stage || null)
      : null,
  }));
}

async function sendTrayThemeSelect(electronApp, nextTheme) {
  await electronApp.evaluate(({ BrowserWindow }, theme) => {
    const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    main?.webContents.send('tray-theme-select', theme);
  }, nextTheme);
}

async function setAlwaysOnTopEnabled(page, enabled) {
  await page.evaluate(async (nextEnabled) => {
    await window.electronAPI.setAlwaysOnTop(nextEnabled);
  }, enabled);
}

async function setDndEnabled(electronApp, page, enabled) {
  await page.evaluate(async (nextEnabled) => {
    await window.electronAPI.storeSet('settings.doNotDisturbEnabled', nextEnabled);
    await window.electronAPI.storeSet('settings.doNotDisturbUntil', null);
  }, enabled);
  await electronApp.evaluate(({ BrowserWindow }, nextEnabled) => {
    const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    main?.webContents.send('dnd-toggled', nextEnabled);
  }, enabled);
}

async function installFloatingPulseCounter(electronApp) {
  await electronApp.evaluate(({ BrowserWindow }) => {
    global.__focanaE2EFloatingPulseCount = 0;

    const floatingWindow = BrowserWindow.getAllWindows()
      .find((win) => win.webContents.getURL().includes('floating-icon.html'));

    if (!floatingWindow) {
      throw new Error('Floating window not found');
    }

    const webContents = floatingWindow.webContents;
    if (webContents.__focanaE2EPulsePatched) {
      return;
    }

    const originalSend = webContents.send.bind(webContents);
    webContents.send = (channel, ...args) => {
      if (channel === 'floating-icon-pulse') {
        global.__focanaE2EFloatingPulseCount = (global.__focanaE2EFloatingPulseCount || 0) + 1;
      }
      return originalSend(channel, ...args);
    };
    webContents.__focanaE2EPulsePatched = true;
  });
}

async function readFloatingPulseCount(electronApp) {
  return electronApp.evaluate(() => global.__focanaE2EFloatingPulseCount || 0);
}

async function readElapsedSecondsForSession(page, { mode, totalSeconds = null }) {
  const displayedSeconds = await readDisplayedTimerSeconds(page);
  if (!Number.isFinite(displayedSeconds)) {
    return null;
  }

  if (mode === 'timed') {
    return Math.max(0, (Number(totalSeconds) || 0) - displayedSeconds);
  }

  return displayedSeconds;
}

async function setElapsedSecondsForSession(page, targetElapsedSeconds, { mode, totalSeconds = null }) {
  const currentElapsedSeconds = await readElapsedSecondsForSession(page, { mode, totalSeconds });
  expect(currentElapsedSeconds).not.toBeNull();

  const currentOffsetMs = await page.evaluate(() => Number(window.__focanaE2EOffsetMs) || 0);
  const deltaSeconds = Number(targetElapsedSeconds) - Number(currentElapsedSeconds);
  await setTimeOffset(page, currentOffsetMs + (deltaSeconds * 1000));
}

async function readWindowMode(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-window-mode'));
}

async function readDisplayedTaskText(page) {
  const runningTask = page.locator(RUNNING_TASK_SELECTOR).first();
  if (await runningTask.isVisible().catch(() => false)) {
    return ((await runningTask.textContent().catch(() => '')) || '').trim();
  }

  const pillTask = page.locator(PILL_TASK_SELECTOR).first();
  if (await pillTask.isVisible().catch(() => false)) {
    return ((await pillTask.textContent().catch(() => '')) || '').trim();
  }

  const taskInput = page.locator(TASK_INPUT_SELECTOR).first();
  if (await taskInput.isVisible().catch(() => false)) {
    return ((await taskInput.inputValue().catch(() => '')) || '').trim();
  }

  return '';
}

async function startFreeflowSession(page, taskName) {
  await page.locator(TASK_INPUT_SELECTOR).fill(taskName);
  await page.locator(TASK_INPUT_SELECTOR).press('Enter');
  await page.getByRole('button', { name: 'Freeflow' }).click();
  await expect.poll(() => readWindowMode(page)).toBe('pill');
}

async function startTimedSession(page, taskName, minutes) {
  await page.locator(TASK_INPUT_SELECTOR).fill(taskName);
  await page.locator(TASK_INPUT_SELECTOR).press('Enter');
  const minutesInput = page.locator('.start-chooser__input').first();
  await expect(page.locator('.start-chooser').first()).toBeVisible();
  await expect(minutesInput).toBeVisible();
  await minutesInput.fill(String(minutes));
  await expect(minutesInput).toHaveValue(String(minutes));
  await minutesInput.press('Enter');
  await expect.poll(async () => {
    const mode = await readWindowMode(page);
    const chooserVisible = await page.locator('.start-chooser').first().isVisible().catch(() => false);
    return mode === 'pill' && !chooserVisible;
  }).toBe(true);
}

async function exitCompactMode(page) {
  await page.locator('.pill').dblclick();
  await expect.poll(() => readWindowMode(page)).toBe('full');
}

async function readAppRegion(locator) {
  return locator.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return styles.getPropertyValue('-webkit-app-region') || styles.webkitAppRegion || '';
  });
}

async function dismissSessionFeedbackIfPresent(page) {
  const feedbackThumb = page.getByTestId('post-session-feedback-down');
  if (await feedbackThumb.count()) {
    await feedbackThumb.click();
  }
}

async function fillSplitSessionNotes(page, {
  nextSteps = null,
  recap = null,
} = {}) {
  if (typeof nextSteps === 'string') {
    await page.locator('textarea[name="next-steps"]').fill(nextSteps);
  }
  if (typeof recap === 'string') {
    await page.locator('textarea[name="recap"]').fill(recap);
  }
}

async function expectPostSessionPrompt(page, taskName = null) {
  await expect(page.getByRole('region', { name: 'Session Wrap' })).toBeVisible();
  await expect(page.getByTestId('post-session-eyebrow')).toHaveText(/Session wrap/i);
  await expect(page.getByTestId('post-session-heading')).toHaveText('Nice work.');
  await expect(page.getByTestId('post-session-primary')).toBeVisible();
  await expect(page.getByTestId('post-session-break')).toBeVisible();
  await expect(page.getByTestId('post-session-new-task')).toBeVisible();
  await expect(page.getByTestId('post-session-done')).toBeVisible();
  if (taskName) {
    await expect(page.getByTestId('post-session-body')).toContainText(taskName);
  }
}

async function seedPreviousSession(page, overrides = {}) {
  await page.evaluate(async (sessionOverride) => {
    const existing = await window.electronAPI.storeGet('sessions');
    const seedSession = {
      id: 'seed-session-1',
      task: 'seed session',
      durationMinutes: 18,
      mode: 'freeflow',
      completed: false,
      kept: true,
      notes: 'seed recap',
      recap: 'seed recap',
      nextSteps: 'seed next step',
      sessionFeedback: null,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      ...sessionOverride,
    };
    await window.electronAPI.storeSet('sessions', [seedSession, ...(Array.isArray(existing) ? existing : [])]);
  }, overrides);
}

async function expectCheckInToastMessage(page, allowedMessages) {
  const toast = page.locator('.toast-checkin').last();
  await expect(toast).toBeVisible();
  const text = (await toast.locator('p').textContent())?.trim();
  expect(allowedMessages).toContain(text);
}

test('first launch shows one-time name capture gate before app UI', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      preferredName: '',
    },
    waitForTaskInput: false,
  });

  try {
    await expect(page.getByText(NAME_GATE_HEADING)).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveCount(0);
    await expect(page.locator('button[aria-label="Open Settings"]')).toHaveCount(0);

    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeDisabled();

    const nameInput = page.getByPlaceholder('Your name');
    await nameInput.fill('   ');
    await expect(continueBtn).toBeDisabled();

    await nameInput.fill('Ari');
    await expect(continueBtn).toBeEnabled();
    await nameInput.press('Enter');

    await expect(page.getByText(NAME_GATE_HEADING)).toHaveCount(0);
    await page.waitForSelector(TASK_INPUT_SELECTOR);

    const savedPreferredName = await page.evaluate(() => window.electronAPI.storeGet('preferredName'));
    expect(savedPreferredName).toBe('Ari');
  } finally {
    await cleanup();
  }
});

test('name capture gate cannot be skipped and remains until a name is provided', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      preferredName: '',
    },
    waitForTaskInput: false,
  });

  try {
    await expect(page.getByText(NAME_GATE_HEADING)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(NAME_GATE_HEADING)).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('saved preferred name bypasses capture gate on launch', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      preferredName: 'Existing User',
    },
  });

  try {
    await expect(page.getByText(NAME_GATE_HEADING)).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('fresh launch without persisted window state opens in the bottom-right work area', async () => {
  const { electronApp, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      preferredName: 'Existing User',
    },
  });

  try {
    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow, screen }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      if (!main) return false;
      const bounds = main.getBounds();
      const workArea = screen.getDisplayMatching(bounds).workArea;
      const rightDelta = Math.abs((bounds.x + bounds.width) - (workArea.x + workArea.width));
      const bottomDelta = Math.abs((bounds.y + bounds.height) - (workArea.y + workArea.height));
      return rightDelta <= 2 && bottomDelta <= 2;
    }), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('activation gate expands beyond the old 360px startup shell to fit its content', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    seedConfig: {
      preferredName: '',
      license: {
        key: '',
        instanceId: '',
        status: 'unlicensed',
        activatedAt: null,
        lastValidatedAt: null,
        offlineGraceUntil: null,
        lastError: null,
      },
    },
    waitForTaskInput: false,
    extraEnv: {
      FOCANA_FORCE_LICENSE_GATE: '1',
    },
  });

  try {
    await expect(page.getByRole('heading', { name: 'Activate Focana on this Mac' })).toBeVisible();
    await expect(page.getByText('Where is my key? Check your Lemon Squeezy receipt email or Lemon Squeezy My Orders. If this key is already active on another Mac, deactivate it there first or contact support at hello@focana.app.')).toBeVisible();
    await expect.poll(async () => (await readMainWindowBounds(electronApp))?.height || 0, { timeout: 7000 })
      .toBeGreaterThan(360);
  } finally {
    await cleanup();
  }
});

test('activation gate keeps its larger shell even when a running timer restores at startup', async () => {
  const restoredSessionStartedAt = new Date(Date.now() - (2 * 60 * 1000)).toISOString();
  const { electronApp, page, cleanup } = await launchApp({
    seedConfig: {
      preferredName: '',
      currentTask: {
        text: 'Restored startup task',
        contextNote: '',
      },
      timerState: {
        mode: 'freeflow',
        initialTime: 0,
        elapsedSeconds: 120,
        isRunning: true,
        timerVisible: true,
        sessionStartedAt: restoredSessionStartedAt,
        currentSessionId: 'restored-license-gate-session',
      },
      license: {
        key: '',
        instanceId: '',
        status: 'unlicensed',
        activatedAt: null,
        lastValidatedAt: null,
        offlineGraceUntil: null,
        lastError: null,
      },
    },
    waitForTaskInput: false,
    extraEnv: {
      FOCANA_FORCE_LICENSE_GATE: '1',
    },
  });

  try {
    await expect(page.getByRole('heading', { name: 'Activate Focana on this Mac' })).toBeVisible();
    await expect.poll(async () => (await readMainWindowBounds(electronApp))?.height || 0, { timeout: 7000 })
      .toBeGreaterThan(360);

    await page.waitForTimeout(1200);

    await expect.poll(async () => (await readMainWindowBounds(electronApp))?.height || 0, { timeout: 3000 })
      .toBeGreaterThan(360);
  } finally {
    await cleanup();
  }
});

test('license activation flows into name capture and then into the app without bouncing back', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      preferredName: '',
      license: {
        key: '',
        instanceId: '',
        status: 'unlicensed',
        activatedAt: null,
        lastValidatedAt: null,
        offlineGraceUntil: null,
        lastError: null,
      },
    },
    waitForTaskInput: false,
    extraEnv: {
      FOCANA_FORCE_LICENSE_GATE: '1',
    },
  });

  try {
    await expect(page.getByRole('heading', { name: 'Activate Focana on this Mac' })).toBeVisible();
    await page.getByPlaceholder('Paste your Focana license key').fill('password');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText(NAME_GATE_HEADING)).toBeVisible();
    await page.getByPlaceholder('Your name').fill('Ari');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText(NAME_GATE_HEADING)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Activate Focana on this Mac' })).toHaveCount(0);
    await page.waitForSelector(TASK_INPUT_SELECTOR);
  } finally {
    await cleanup();
  }
});

test('settings can update the preferred name and persist it', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      preferredName: 'Ari',
    },
  });

  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    const nameInput = page.getByLabel('What should Focana call you?');
    await nameInput.fill('Ari Franklin');
    await page.getByRole('button', { name: 'Save Settings' }).first().click();

    await expect.poll(async () => page.evaluate(() => window.electronAPI.storeGet('preferredName'))).toBe('Ari Franklin');
  } finally {
    await cleanup();
  }
});

test('theme is restored from electron-store and tray theme changes persist back to the store', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        theme: 'dark',
        themeManual: true,
      },
    },
  });

  try {
    await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

    await sendTrayThemeSelect(electronApp, 'light');

    await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    await expect.poll(async () => page.evaluate(() => window.electronAPI.storeGet('settings.theme'))).toBe('light');
    await expect.poll(async () => page.evaluate(() => window.electronAPI.storeGet('settings.themeManual'))).toBe(true);
  } finally {
    await cleanup();
  }
});

test('theme and always-on-top survive relaunch after tray and runtime changes', async () => {
  const storeDir = createStoreDir({
    settings: {
      theme: 'dark',
      themeManual: true,
      alwaysOnTop: true,
    },
  });

  let firstLaunch = null;
  let secondLaunch = null;

  try {
    firstLaunch = await launchApp({ background: false, storeDir });
    await expect.poll(async () => firstLaunch.page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    await expect.poll(async () => firstLaunch.electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      return main ? main.isAlwaysOnTop() : null;
    })).toBe(true);

    await sendTrayThemeSelect(firstLaunch.electronApp, 'light');
    await setAlwaysOnTopEnabled(firstLaunch.page, false);

    await expect.poll(async () => firstLaunch.page.evaluate(() => window.electronAPI.storeGet('settings.theme'))).toBe('light');
    await expect.poll(async () => firstLaunch.page.evaluate(() => window.electronAPI.storeGet('settings.themeManual'))).toBe(true);
    await expect.poll(async () => firstLaunch.page.evaluate(() => window.electronAPI.storeGet('settings.alwaysOnTop'))).toBe(false);
    await firstLaunch.cleanup({ deleteStoreDir: false });
    firstLaunch = null;

    secondLaunch = await launchApp({ background: false, storeDir });
    await expect.poll(async () => secondLaunch.page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    await expect.poll(async () => secondLaunch.electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      return main ? main.isAlwaysOnTop() : null;
    })).toBe(false);
  } finally {
    if (secondLaunch) {
      await secondLaunch.cleanup({ deleteStoreDir: false });
    }
    if (firstLaunch) {
      await firstLaunch.cleanup({ deleteStoreDir: false });
    }
    removeStoreDir(storeDir);
  }
});

test('settings surfaces mocked update availability and install action', async () => {
  const { page, cleanup } = await launchApp({
    extraEnv: {
      FOCANA_E2E_UPDATER_SCENARIO: 'available',
      FOCANA_E2E_UPDATER_VERSION: '1.2.1',
    },
  });

  try {
    await expect(page.getByText('Update Ready')).toBeVisible();
    await expect(page.getByText('Focana 1.2.1 is downloaded and ready.')).toBeVisible();

    await page.getByRole('button', { name: 'Open Settings' }).click();

    await expect(page.getByText(`Current version ${APP_VERSION} on the latest release.`)).toBeVisible();
    await expect(page.getByText('Focana 1.2.1 is ready to install.')).toBeVisible();

    await page.getByRole('button', { name: 'Restart to Update' }).last().click();

    await expect.poll(async () => {
      const state = await page.evaluate(() => window.electronAPI.getUpdateState());
      return state?.status || null;
    }).toBe('installing');
  } finally {
    await cleanup();
  }
});

test('manual update check reports when the app is already current', async () => {
  const { page, cleanup } = await launchApp({
    extraEnv: {
      FOCANA_E2E_UPDATER_SCENARIO: 'none',
      FOCANA_DISABLE_AUTO_UPDATES: '1',
    },
  });

  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('button', { name: 'Check for Updates' }).click();

    await expect(page.getByText('You are up to date.')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('launch at login defaults on and the settings toggle persists', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await expect.poll(async () => page.evaluate(() => window.electronAPI.getLaunchAtLogin())).toBe(true);

    await page.getByRole('button', { name: 'Open Settings' }).click();
    const launchAtLoginSwitch = page.getByText('Launch at login').locator('..').locator('..').getByRole('switch');
    await expect(launchAtLoginSwitch).toHaveAttribute('aria-checked', 'true');

    await launchAtLoginSwitch.click();
    await page.getByRole('button', { name: 'Save Settings' }).first().click();

    await expect.poll(async () => page.evaluate(() => window.electronAPI.getLaunchAtLogin())).toBe(false);
    await expect.poll(async () => page.evaluate(async () => {
      const settings = await window.electronAPI.storeGet('settings');
      return settings?.launchOnStartup;
    })).toBe(false);

    await page.getByRole('button', { name: 'Open Settings' }).click();
    const relaunchAtLoginSwitch = page.getByText('Launch at login').locator('..').locator('..').getByRole('switch');
    await expect(relaunchAtLoginSwitch).toHaveAttribute('aria-checked', 'false');

    await relaunchAtLoginSwitch.click();
    await page.getByRole('button', { name: 'Save Settings' }).first().click();

    await expect.poll(async () => page.evaluate(() => window.electronAPI.getLaunchAtLogin())).toBe(true);
    await expect.poll(async () => page.evaluate(async () => {
      const settings = await window.electronAPI.storeGet('settings');
      return settings?.launchOnStartup;
    })).toBe(true);
  } finally {
    await cleanup();
  }
});

test('manual launches keep the normal idle task shell instead of the login-first prompt', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await expect(page.getByRole('textbox', { name: 'What are we working on first?' })).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Snooze' })).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test("login launch floats first, then opens What's next after the system-entry delay", async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    waitForTaskInput: false,
    extraEnv: {
      FOCANA_E2E_LAUNCH_SOURCE: 'login',
      FOCANA_E2E_SYSTEM_ENTRY_DELAY_MS: SYSTEM_ENTRY_TEST_DELAY_MS,
    },
  });

  try {
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await expect(page.getByPlaceholder('What are we focusing on next?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Freeflow' })).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('first-launch gates still win over login launch, and finishing them lands in the idle shell', async () => {
  const { page, cleanup } = await launchApp({
    background: false,
    waitForTaskInput: false,
    seedConfig: {
      preferredName: '',
      license: {
        key: '',
        instanceId: '',
        status: 'unlicensed',
        activatedAt: null,
        lastValidatedAt: null,
        offlineGraceUntil: null,
        lastError: null,
      },
    },
    extraEnv: {
      FOCANA_FORCE_LICENSE_GATE: '1',
      FOCANA_E2E_LAUNCH_SOURCE: 'login',
      FOCANA_E2E_SYSTEM_ENTRY_DELAY_MS: SYSTEM_ENTRY_TEST_DELAY_MS,
    },
  });

  try {
    await expect(page.getByRole('heading', { name: 'Activate Focana on this Mac' })).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveCount(0);

    await page.getByPlaceholder('Paste your Focana license key').fill('password');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText(NAME_GATE_HEADING)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activate Focana on this Mac' })).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveCount(0);

    await page.getByPlaceholder('Your name').fill('Ari');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText(NAME_GATE_HEADING)).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveAttribute('placeholder', 'Where are we focusing first?');
    await expect(page.getByRole('button', { name: 'Snooze' })).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('restart launch with paused work opens Ready to resume immediately', async () => {
  const { page, cleanup } = await launchApp({
    background: false,
    waitForTaskInput: false,
    seedConfig: {
      currentTask: {
        text: 'restart-paused-task',
        recap: 'Paused context',
        nextSteps: 'Continue from the checklist',
      },
      timerState: {
        mode: 'freeflow',
        initialTime: 0,
        elapsedSeconds: 420,
        isRunning: false,
        timerVisible: true,
        currentSessionId: 'restart-paused-session',
      },
    },
    extraEnv: {
      FOCANA_E2E_LAUNCH_SOURCE: 'restart',
    },
  });

  try {
    await expect(page.getByRole('heading', { name: 'Ready to resume?' })).toBeVisible();
    await expect(page.getByText('restart-paused-task')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('restart launch with no task stays in the idle shell', async () => {
  const { page, cleanup } = await launchApp({
    background: false,
    extraEnv: {
      FOCANA_E2E_LAUNCH_SOURCE: 'restart',
    },
  });

  try {
    await expect(page.getByRole('heading', { name: 'Ready to resume?' })).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveAttribute('placeholder', 'Where are we focusing first?');
  } finally {
    await cleanup();
  }
});

test("wake plus login with nothing resumable floats first, then opens What's next", async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: true,
    waitForTaskInput: false,
    extraEnv: {
      FOCANA_E2E_SYSTEM_ENTRY_DELAY_MS: SYSTEM_ENTRY_TEST_DELAY_MS,
    },
  });

  try {
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: false }));
    await page.waitForTimeout(600);

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('suspend');
      powerMonitor.emit('resume');
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('unlock-screen');
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await expect(page.getByPlaceholder('What are we focusing on next?')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test("wake plus resume with nothing resumable floats first, then opens What's next", async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: true,
    waitForTaskInput: false,
    extraEnv: {
      FOCANA_E2E_SYSTEM_ENTRY_DELAY_MS: SYSTEM_ENTRY_TEST_DELAY_MS,
    },
  });

  try {
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: false }));
    await page.waitForTimeout(600);

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('suspend');
      powerMonitor.emit('resume');
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await expect(page.getByPlaceholder('What are we focusing on next?')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('wake plus resume with an interrupted active session floats first, then opens Ready to resume', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    extraEnv: {
      FOCANA_E2E_SYSTEM_ENTRY_DELAY_MS: SYSTEM_ENTRY_TEST_DELAY_MS,
    },
  });

  try {
    await startFreeflowSession(page, 'wake-resume-active-session');

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('suspend');
      powerMonitor.emit('resume');
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: 'Ready to resume?' })).toBeVisible();
    await expect(page.getByText('wake-resume-active-session')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('wake plus resume with a saved resumable task floats first, then opens Ready to resume', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: true,
    waitForTaskInput: false,
    seedConfig: {
      currentTask: {
        text: 'wake-resume-saved-task',
        recap: 'Resume notes',
        nextSteps: 'Re-open the draft',
      },
      timerState: {
        mode: 'freeflow',
        initialTime: 0,
        elapsedSeconds: 0,
        isRunning: false,
        timerVisible: false,
        currentSessionId: 'wake-resume-saved-session',
      },
      sessions: [{
        id: 'wake-resume-saved-session',
        task: 'wake-resume-saved-task',
        durationMinutes: 12,
        mode: 'freeflow',
        completed: false,
        kept: true,
        notes: 'Resume notes',
        recap: 'Resume notes',
        nextSteps: 'Re-open the draft',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      }],
    },
    extraEnv: {
      FOCANA_E2E_SYSTEM_ENTRY_DELAY_MS: SYSTEM_ENTRY_TEST_DELAY_MS,
    },
  });

  try {
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: false }));
    await page.waitForTimeout(600);

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('suspend');
      powerMonitor.emit('resume');
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: 'Ready to resume?' })).toBeVisible();
    await expect(page.getByText('wake-resume-saved-task')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('wake plus login with an interrupted active session floats first, then opens Ready to resume', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    extraEnv: {
      FOCANA_E2E_SYSTEM_ENTRY_DELAY_MS: SYSTEM_ENTRY_TEST_DELAY_MS,
    },
  });

  try {
    await startFreeflowSession(page, 'wake-active-session');

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('suspend');
      powerMonitor.emit('resume');
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('unlock-screen');
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: 'Ready to resume?' })).toBeVisible();
    await expect(page.getByText('wake-active-session')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('wake plus login with a saved resumable task floats first, then opens Ready to resume', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: true,
    waitForTaskInput: false,
    seedConfig: {
      currentTask: {
        text: 'wake-saved-resume',
        recap: 'Saved notes',
        nextSteps: 'Pick up the draft',
      },
      timerState: {
        mode: 'freeflow',
        initialTime: 0,
        elapsedSeconds: 0,
        isRunning: false,
        timerVisible: false,
        currentSessionId: 'wake-saved-session',
      },
      sessions: [{
        id: 'wake-saved-session',
        task: 'wake-saved-resume',
        durationMinutes: 18,
        mode: 'freeflow',
        completed: false,
        kept: true,
        notes: 'Saved notes',
        recap: 'Saved notes',
        nextSteps: 'Pick up the draft',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      }],
    },
    extraEnv: {
      FOCANA_E2E_SYSTEM_ENTRY_DELAY_MS: SYSTEM_ENTRY_TEST_DELAY_MS,
    },
  });

  try {
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: false }));
    await page.waitForTimeout(600);

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('suspend');
      powerMonitor.emit('resume');
      powerMonitor.emit('unlock-screen');
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: 'Ready to resume?' })).toBeVisible();
    await expect(page.getByText('wake-saved-resume')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('quit confirmation appears on every explicit quit request and supports cancel', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('button', { name: 'Quit Focana' }).click();

    await expect(page.getByText('Quit Focana?')).toBeVisible();
    await expect(page.getByText('Quitting turns Focana off completely on this Mac. Minimize sends this window to Floating, and Hide removes Focana from view while keeping it running quietly in the background.')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Quit Focana?')).toHaveCount(0);

    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('button', { name: 'Quit Focana' }).click();
    await expect(page.getByText('Quit Focana?')).toBeVisible();

    await page.getByRole('button', { name: 'Quit' }).click();
    await expect.poll(() => page.isClosed(), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup({ deleteStoreDir: true });
  }
});

test('quit confirmation hide keeps the app resident with no visible windows', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('button', { name: 'Quit Focana' }).click();
    await expect(page.getByText('Quit Focana?')).toBeVisible();

    await page.getByRole('button', { name: 'Hide' }).click();

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: false }));
    await expect.poll(() => page.isClosed(), { timeout: 7000 }).toBe(false);
  } finally {
    await cleanup();
  }
});

test('quit confirmation minimize sends the app to floating', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('button', { name: 'Quit Focana' }).click();
    await expect(page.getByText('Quit Focana?')).toBeVisible();

    await page.getByRole('button', { name: 'Minimize', exact: true }).click();

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'icon', stage: null }));
  } finally {
    await cleanup();
  }
});

test('idle re-entry prompt loops in full window and hands off to floating prompt after minimize', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);

    await setTimeOffset(page, (5 * 60 * 1000) + 2000);

    const prompt = page.locator('.reentry-prompt--full').first();
    await expect.poll(async () => await prompt.count(), { timeout: 7000 }).toBe(1);
    await expect(prompt).toBeVisible();
    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await expect(page.getByText('Start something new, or pull from Parking Lot or History.')).toBeVisible();
    await expect(page.getByTestId('reentry-open-parking')).toBeVisible();
    await expect(page.getByTestId('reentry-open-history')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
    await expect(prompt).toHaveClass(/reentry-prompt--attention/);
    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return bounds?.height || 0;
    }, { timeout: 7000 }).toBeGreaterThanOrEqual(320);

    await page.waitForTimeout(6500);
    await expect(prompt).not.toHaveClass(/reentry-prompt--attention/);
    await expect(prompt).toBeVisible();

    await setTimeOffset(page, (5 * 60 * 1000) + 35000);
    await expect(prompt).toHaveClass(/reentry-prompt--attention/);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'task-entry' }));
  } finally {
    await cleanup();
  }
});

test('manual startup shows the first-focus prompt copy', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveAttribute('placeholder', 'Where are we focusing first?');
  } finally {
    await cleanup();
  }
});

test('compact idle re-entry prompt grows for each stage and restores the pill size after snooze', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);

    await page.getByRole('button', { name: 'Enter Compact Mode' }).click();
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await page.waitForTimeout(350);

    const baseBounds = await readMainWindowBounds(electronApp);
    expect(baseBounds).toBeTruthy();

    await setTimeOffset(page, (5 * 60 * 1000) + 2000);

    const compactPrompt = page.locator('.reentry-prompt--compact').first();
    await expect(compactPrompt).toBeVisible();
    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
    const taskEntryBounds = await readMainWindowBounds(electronApp);
    expect(taskEntryBounds?.height).toBeGreaterThanOrEqual(320);

    await page.getByRole('button', { name: 'Snooze' }).click();
    await expect(page.getByRole('heading', { name: 'Snooze reminder' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Until I reopen' })).toBeVisible();
    const snoozeBounds = await readMainWindowBounds(electronApp);
    expect(snoozeBounds?.height).toBeGreaterThanOrEqual(420);

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return bounds?.height || 0;
    }, { timeout: 7000 }).toBeLessThanOrEqual((taskEntryBounds?.height || 0) + 8);

    await page.getByRole('button', { name: 'Snooze' }).click();
    await page.getByRole('button', { name: '10 minutes' }).click();
    await expect(compactPrompt).toHaveCount(0);

    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return Math.abs((bounds?.width || 0) - (baseBounds?.width || 0)) <= 2
        && Math.abs((bounds?.height || 0) - (baseBounds?.height || 0)) <= 2;
    }, { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('idle re-entry prompt can open Session History and Parking Lot from the task-entry step', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await setTimeOffset(page, (5 * 60 * 1000) + 2000);

    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await page.getByTestId('reentry-open-history').click();
    await expect(page.getByRole('heading', { name: 'Session History' })).toBeVisible();
    await page.locator('.dialog-close-btn').first().click();

    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await page.getByTestId('reentry-open-parking').click();
    await expect(page.getByRole('heading', { name: 'Parking Lot' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Parking Lot' }).click();

    await expect(page.getByRole('heading', { name: "What's next?" })).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('floating re-entry prompt requires explicit snooze selection for ten minute snooze', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'icon', stage: null }));

    await setTimeOffset(page, (5 * 60 * 1000) + 5000);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 10000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'task-entry' }));

    await floatingWindow.keyboard.press('Escape');
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'task-entry' }));

    await floatingWindow.mouse.click(8, 8);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'task-entry' }));

    await floatingWindow.getByRole('button', { name: 'Snooze' }).click();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'snooze-options' }));

    await floatingWindow.getByRole('button', { name: '10 minutes' }).click();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'icon', stage: null }));

    await setTimeOffset(page, 14 * 60 * 1000);
    await page.waitForTimeout(1200);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 3000 })
      .toBe(JSON.stringify({ mode: 'icon', stage: null }));

    await setTimeOffset(page, (15 * 60 * 1000) + 3000);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'task-entry' }));
  } finally {
    await cleanup();
  }
});

test('floating re-entry prompt mirrors the idle start flow for new tasks', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'icon', stage: null }));

    await setTimeOffset(page, (5 * 60 * 1000) + 2000);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'task-entry' }));
    await expect(floatingWindow.getByRole('heading', { name: "What's next?" })).toBeVisible();
    await expect(floatingWindow.locator('#prompt-open-parking-btn')).toBeVisible();
    await expect(floatingWindow.locator('#prompt-open-history-btn')).toBeVisible();
    await expect(floatingWindow.locator('#prompt-task-next-btn')).toBeVisible();
    const taskEntryBounds = await readFloatingWindowBounds(electronApp);
    expect(taskEntryBounds?.height).toBeGreaterThanOrEqual(372);

    await floatingWindow.locator('#prompt-dismiss-btn').click();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'snooze-options' }));
    await expect(floatingWindow.locator('#prompt-snooze-reopen')).toBeVisible();
    const snoozeBounds = await readFloatingWindowBounds(electronApp);
    expect(snoozeBounds?.height).toBeGreaterThanOrEqual(378);
    await floatingWindow.locator('#prompt-back-btn').click();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'task-entry' }));

    await floatingWindow.locator('#prompt-task-input').fill('floating-reentry-start');
    await floatingWindow.locator('#prompt-task-next-btn').click();

    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'start-chooser' }));
    await expect(floatingWindow.locator('#prompt-start-timed-btn')).toBeVisible();
    await expect(floatingWindow.locator('#prompt-freeflow-btn')).toBeVisible();
    const chooserBounds = await readFloatingWindowBounds(electronApp);
    expect(chooserBounds?.height).toBeGreaterThanOrEqual(340);

    await floatingWindow.locator('#prompt-freeflow-btn').click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    const timerState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
    const currentTask = await page.evaluate(() => window.electronAPI.storeGet('currentTask'));
    expect(timerState.mode).toBe('freeflow');
    expect(timerState.isRunning).toBe(true);
    expect(timerState.timerVisible).toBe(true);
    expect(currentTask?.text?.trim()).toBe('floating-reentry-start');
  } finally {
    await cleanup();
  }
});

test('floating idle re-entry prompt can open Session History from the task-entry step', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await setTimeOffset(page, (5 * 60 * 1000) + 2000);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'task-entry' }));

    await floatingWindow.locator('#prompt-open-history-btn').click();

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: 'Session History' })).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('done-for-now manual reopen stays in the idle shell until a system re-entry prompt is triggered', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'done-for-now-default-resume');
    await exitCompactMode(page);

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'done-for-now-default-resume');
    await page.getByTestId('post-session-done').click();
    await expect(page.getByRole('heading', { name: 'Done for now' })).toBeVisible();
    await fillSplitSessionNotes(page, {
      nextSteps: 'pick this up tomorrow',
      recap: 'final QA pass still open',
    });
    await page.getByRole('button', { name: 'Done for now' }).click();

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await page.evaluate(() => {
      window.electronAPI.bringToFront?.();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: 'Ready to resume?' })).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('done-for-now-default-resume');
  } finally {
    await cleanup();
  }
});

test('floating resumable re-entry comes back after done-for-now and start something new captures save-for-later notes first', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'resume-choice-task');
    await exitCompactMode(page);

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'resume-choice-task');
    await page.getByTestId('post-session-done').click();
    await expect(page.getByRole('heading', { name: 'Done for now' })).toBeVisible();
    await page.getByRole('button', { name: 'Done for now' }).click();

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
    await expect.poll(async () => page.evaluate(() => window.electronAPI.getFloatingMinimized()), { timeout: 7000, message: 'main window should already be minimized after Done for now' })
      .toBe(true);
    await page.waitForTimeout(1200);
    await setTimeOffset(page, (5 * 60 * 1000) + 2000);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'resume-choice' }));
    await expect(floatingWindow.locator('#prompt-resume-btn')).toBeVisible();
    await expect(floatingWindow.locator('#prompt-start-new-btn')).toBeVisible();
    const resumeBounds = await readFloatingWindowBounds(electronApp);
    expect(resumeBounds?.height).toBeGreaterThanOrEqual(276);

    await floatingWindow.locator('#prompt-resume-btn').click();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'start-chooser' }));

    await floatingWindow.locator('#prompt-back-btn').click();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'resume-choice' }));

    await floatingWindow.locator('#prompt-start-new-btn').click();
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByRole('heading', { name: 'Save “resume-choice-task” for later' })).toBeVisible();
    await fillSplitSessionNotes(page, {
      nextSteps: 'restart with the handoff checklist',
      recap: 'latest notes captured from the floating resume prompt',
    });
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('');
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveAttribute('placeholder', 'Where are we focusing first?');
  } finally {
    await cleanup();
  }
});

test('resume save-for-later can mark complete with confetti and hand off to the next-task prompt', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'resume-mark-complete');
    await exitCompactMode(page);

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'resume-mark-complete');
    await page.getByTestId('post-session-done').click();
    await expect(page.getByRole('heading', { name: 'Done for now' })).toBeVisible();
    await page.getByRole('button', { name: 'Done for now' }).click();

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
    const floatingWindow = await waitForFloatingWindow(electronApp);
    await setTimeOffset(page, (5 * 60 * 1000) + 2000);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'resume-choice' }));

    await floatingWindow.locator('#prompt-start-new-btn').click();
    await expect(page.getByRole('heading', { name: 'Save “resume-mark-complete” for later' })).toBeVisible();

    await fillSplitSessionNotes(page, {
      nextSteps: 'reopen the checklist and verify the last pass',
      recap: 'handoff notes captured before marking it complete',
    });
    await expect(page.getByTestId('reentry-mark-complete')).toBeVisible();
    await page.getByTestId('reentry-mark-complete').click();

    await expect(page.locator('.confetti-overlay')).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('');
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveAttribute('placeholder', 'What are we focusing on next?');

    const savedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    const matchingSession = savedSessions.find((session) => session?.task === 'resume-mark-complete');
    expect(matchingSession).toBeTruthy();
    expect(matchingSession.completed).toBe(true);
    expect(matchingSession.nextSteps).toBe('reopen the checklist and verify the last pass');
    expect(matchingSession.recap).toBe('handoff notes captured before marking it complete');
  } finally {
    await cleanup();
  }
});

test('post-session prompt can mark complete and hand off directly into a clean start-another-session composer', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'resume-choice-task');
    await exitCompactMode(page);

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'resume-choice-task');

    await page.getByTestId('post-session-mark-complete').click();

    await expect(page.getByRole('region', { name: 'Session Wrap' })).toHaveCount(0);
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('');
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveAttribute('placeholder', 'What are we focusing on next?');
    await expect(page.getByRole('button', { name: 'Open Parking Lot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Session History' })).toBeVisible();
    await expect(page.getByText('Start something new, or pull from Parking Lot or History.')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('timed session expiry opens session wrap and Enter from keep working restarts a timed session', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'timeup-audit', 1);

    await setTimeOffset(page, 65000);
    await expectPostSessionPrompt(page, 'timeup-audit');
    await page.getByTestId('post-session-primary').click();
    await expect(page.getByRole('heading', { name: 'Keep working on timeup-audit.' })).toBeVisible();
    await expect(page.getByTestId('post-session-keep-working-minutes')).toHaveValue('1');
    await expect(page.getByRole('button', { name: 'Start timed session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Freeflow' })).toBeVisible();
    await page.getByTestId('post-session-keep-working-minutes').fill('6');
    await page.getByTestId('post-session-keep-working-minutes').press('Enter');
    await expect.poll(() => readWindowMode(page)).toBe('pill');

    const keepGoingState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
    expect(keepGoingState.mode).toBe('timed');
    expect(keepGoingState.initialTime).toBe(360);
    expect(keepGoingState.isRunning).toBe(true);
    expect(keepGoingState.seconds).toBeGreaterThanOrEqual(359);
    expect(keepGoingState.seconds).toBeLessThanOrEqual(360);

    await expect.poll(async () => {
      const currentTaskSnapshot = await page.evaluate(() => window.electronAPI.storeGet('currentTask'));
      return JSON.stringify({
        text: currentTaskSnapshot?.text || '',
        recap: currentTaskSnapshot?.recap || '',
        nextSteps: currentTaskSnapshot?.nextSteps || '',
      });
    }).toBe(JSON.stringify({
      text: 'timeup-audit',
      recap: '',
      nextSteps: '',
    }));

    const currentTask = await page.evaluate(() => window.electronAPI.storeGet('currentTask'));
    expect(currentTask.text).toBe('timeup-audit');
    expect(currentTask.recap).toBe('');
    expect(currentTask.nextSteps).toBe('');

    const savedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(savedSessions.some((session) => (
      session.task === 'timeup-audit'
      && session.durationMinutes === 1
      && session.completed === false
      && session.notes === ''
      && session.recap === ''
      && session.nextSteps === ''
    ))).toBe(true);
  } finally {
    await cleanup();
  }
});

test('timed session expiry can switch into freeflow and restart freeflow check-ins from session wrap', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 1,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'timeup-freeflow-handoff', 1);

    await setTimeOffset(page, 65000);
    await expectPostSessionPrompt(page, 'timeup-freeflow-handoff');
    await page.getByTestId('post-session-primary').click();
    await page.getByRole('button', { name: 'Freeflow' }).click();

    await expect.poll(() => readWindowMode(page)).toBe('pill');

    const freeflowState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
    expect(freeflowState.mode).toBe('freeflow');
    expect(freeflowState.initialTime).toBe(0);
    expect(freeflowState.isRunning).toBe(true);
    expect(freeflowState.seconds).toBeGreaterThanOrEqual(0);
    expect(freeflowState.seconds).toBeLessThanOrEqual(1);

    await setTimeOffset(page, 126000);
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('timeup-freeflow-handoff?')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('timed session expiry keep working stays in the full window when the session expired outside compact mode', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'timeup-full-window', 1);
    await exitCompactMode(page);

    const boundsBeforeExpire = await readMainWindowBounds(electronApp);
    expect(boundsBeforeExpire).toBeTruthy();

    await setTimeOffset(page, 65000);
    await expectPostSessionPrompt(page, 'timeup-full-window');
    await page.getByTestId('post-session-primary').click();
    await page.getByTestId('post-session-keep-working-minutes').fill('6');
    await page.getByRole('button', { name: 'Start timed session' }).click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return bounds?.height || 0;
    }, { timeout: 7000 }).toBeGreaterThanOrEqual(160);

    await expect.poll(async () => page.evaluate(async () => {
      const timerState = await window.electronAPI.storeGet('timerState');
      return {
        isRunning: Boolean(timerState?.isRunning),
        initialTime: Number(timerState?.initialTime) || 0,
      };
    }), { timeout: 7000 }).toEqual({
      isRunning: true,
      initialTime: 360,
    });
  } finally {
    await cleanup();
  }
});

test('timed floating check-in restores a compact-started session into the compact prompt', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      settings: {
        checkInEnabled: true,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'timed-floating-compact-origin', 1);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await setTimeOffset(page, 25000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.locator('.checkin-popup-compact')).toBeVisible();
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('timed-floating-compact-origin?')).toBeVisible();

    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator('.checkin-popup-compact')).toHaveCount(0);
    await expectCheckInToastMessage(page, FOCUSED_CHECKIN_MESSAGES);
    await expect(page.locator('.pill-success-cue--active')).toBeVisible();
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
  } finally {
    await cleanup();
  }
});

test('timed session expiry keep working freeflow returns to floating minimize when the session expired from floating mode', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 1,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'timeup-floating-freeflow', 1);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => {
      const visibility = await readWindowVisibilityState(electronApp);
      return visibility.floatingVisible;
    }, { timeout: 7000 }).toBe(true);

    await setTimeOffset(page, 65000);

    await expect.poll(async () => {
      const visibility = await readWindowVisibilityState(electronApp);
      return visibility.mainVisible;
    }, { timeout: 7000 }).toBe(true);
    await expectPostSessionPrompt(page, 'timeup-floating-freeflow');
    await page.getByTestId('post-session-primary').click();
    await page.getByRole('button', { name: 'Freeflow' }).click();

    await expect.poll(async () => {
      const visibility = await readWindowVisibilityState(electronApp);
      return visibility.floatingVisible;
    }, { timeout: 7000 }).toBe(true);
    await expect.poll(async () => {
      const visibility = await readWindowVisibilityState(electronApp);
      return visibility.mainVisible;
    }, { timeout: 7000 }).toBe(false);

    const resumedState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
    expect(resumedState.mode).toBe('freeflow');
    expect(resumedState.isRunning).toBe(true);
    expect(resumedState.initialTime).toBe(0);
  } finally {
    await cleanup();
  }
});

test('timed session expiry opens session wrap without feedback on session 1', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'feedback-auto-advance', 1);

    await setTimeOffset(page, 65000);
    await expectPostSessionPrompt(page, 'feedback-auto-advance');
    await expect(page.getByTestId('post-session-feedback-row')).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('selecting session feedback saves it on session 2+ and leaves a dimmed confirmation', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await seedPreviousSession(page);
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'feedback-select', 1);

    await setTimeOffset(page, 65000);
    await expectPostSessionPrompt(page, 'feedback-select');
    await expect(page.getByTestId('post-session-feedback-row')).toBeVisible({ timeout: 3000 });

    await page.getByTestId('post-session-feedback-up').click();

    await expect.poll(async () => {
      const queue = await page.evaluate(() => window.electronAPI.storeGet('feedbackQueue'));
      return Array.isArray(queue) ? queue.length : 0;
    }).toBe(1);

    const queue = await page.evaluate(() => window.electronAPI.storeGet('feedbackQueue'));
    expect(queue[0].feedback).toBe('up');
    expect(queue[0].surface).toBe('post_session_wrap');
    expect(queue[0].completionType).toBe('wrap');

    await expect.poll(async () => {
      const sessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
      return sessions?.find((session) => session.task === 'feedback-select')?.sessionFeedback || null;
    }).toBe('up');

    await expect(page.getByTestId('post-session-feedback-confirmation')).toBeVisible();
    await page.waitForTimeout(1700);
    const opacity = await page.getByTestId('post-session-feedback-row').evaluate((node) => window.getComputedStyle(node).opacity);
    expect(Number(opacity)).toBeLessThan(1);
  } finally {
    await cleanup();
  }
});

test('selecting session feedback records an immediate sync attempt', async () => {
  const { page, cleanup } = await launchApp({
    extraEnv: {
      FOCANA_FEEDBACK_API_URL: 'http://127.0.0.1:9/app-feedback',
    },
  });

  try {
    await seedPreviousSession(page);
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'feedback-sync-attempt');
    await setTimeOffset(page, 6500);
    await page.locator('.pill').click();
    await page.locator('button[title="Stop & Save"]').click();

    await expectPostSessionPrompt(page, 'feedback-sync-attempt');
    await expect(page.getByTestId('post-session-feedback-row')).toBeVisible({ timeout: 3000 });
    await page.getByTestId('post-session-feedback-down').click();

    await expect.poll(async () => {
      const queue = await page.evaluate(() => window.electronAPI.storeGet('feedbackQueue'));
      const item = Array.isArray(queue) ? queue[0] : null;
      return item
        ? JSON.stringify({
            attemptCount: item.attemptCount,
            hasLastAttemptAt: Boolean(item.lastAttemptAt),
            syncStatus: item.syncStatus,
            hasLastError: Boolean(item.lastError),
          })
        : null;
    }).toBe(JSON.stringify({
      attemptCount: 1,
      hasLastAttemptAt: true,
      syncStatus: 'failed',
      hasLastError: true,
    }));
  } finally {
    await cleanup();
  }
});

test('direct feedback enqueue records an immediate sync attempt', async () => {
  const { page, cleanup } = await launchApp({
    extraEnv: {
      FOCANA_FEEDBACK_API_URL: 'http://127.0.0.1:9/app-feedback',
    },
  });

  try {
    const enqueueResult = await page.evaluate(() => window.electronAPI.enqueueFeedback({
      id: 'direct-feedback-diag',
      sessionId: 'direct-feedback-session',
      feedback: 'up',
      surface: 'diag',
      completionType: 'completed',
      sessionMode: 'freeflow',
      sessionDurationMinutes: 12,
      clientCreatedAt: new Date().toISOString(),
      appVersion: '1.0.0-test',
      osVersion: 'diag-os',
      channel: 'latest',
      installId: 'diag-install',
      licenseInstanceId: 'diag-license',
      syncStatus: 'pending',
      attemptCount: 0,
      lastAttemptAt: null,
      syncedAt: null,
      lastError: null,
    }));

    await expect.poll(async () => {
      const queue = await page.evaluate(() => window.electronAPI.storeGet('feedbackQueue'));
      const item = Array.isArray(queue) ? queue.find((entry) => entry.id === 'direct-feedback-diag') : null;
      return item
        ? JSON.stringify({
            attemptCount: item.attemptCount,
            hasLastAttemptAt: Boolean(item.lastAttemptAt),
            syncStatus: item.syncStatus,
            hasLastError: Boolean(item.lastError),
          })
        : null;
    }).toBe(JSON.stringify({
      attemptCount: 1,
      hasLastAttemptAt: true,
      syncStatus: 'failed',
      hasLastError: true,
    }));
  } finally {
    await cleanup();
  }
});

test('quick capture thought persists after parking lot interactions', async () => {
  const { electronApp, page, cleanup } = await launchApp();
  try {
    const capturedThought = `quick-capture-${Date.now()}`;

    await triggerShortcutAction(electronApp, 'openParkingLot');
    await expect(page.locator('[data-quick-capture-textarea]')).toBeVisible();
    await page.locator('[data-quick-capture-textarea]').fill(capturedThought);
    await page.getByRole('button', { name: 'Save to Parking Lot (Enter)' }).click();

    await page.getByRole('button', { name: 'Open Parking Lot' }).click();
    await expect(page.getByText(capturedThought)).toBeVisible();

    await page.locator('.checkbox').first().click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('button', { name: 'Open Parking Lot' }).click();
    await expect(page.getByText(capturedThought)).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('floating minimize shows a timer pill while a timer is active', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('shortcut-block');
    await page.locator(TASK_INPUT_SELECTOR).press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(() => {
      const windows = electronApp.windows();
      return windows.some((win) => win.url().includes('floating-icon.html'));
    }, { timeout: 7000 }).toBe(true);

    const floatingWindow = await waitForFloatingWindow(electronApp);

    await expect.poll(async () => floatingWindow.evaluate(() => ({
      mode: document.body.dataset.mode,
      timeText: document.getElementById('timer-pill')?.textContent?.trim() || '',
    })), { timeout: 7000 }).toMatchObject({
      mode: 'timer',
      timeText: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
  } finally {
    await cleanup();
  }
});

test('floating minimize keeps the timer pill visible when timer is visible but not running', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'paused-floating');
    await exitCompactMode(page);
    await triggerShortcutAction(electronApp, 'startPause');

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(() => {
      const windows = electronApp.windows();
      return windows.some((win) => win.url().includes('floating-icon.html'));
    }, { timeout: 7000 }).toBe(true);

    const floatingWindow = await waitForFloatingWindow(electronApp);

    await expect.poll(async () => floatingWindow.evaluate(() => ({
      mode: document.body.dataset.mode,
      timeText: document.getElementById('timer-pill')?.textContent?.trim() || '',
      toggleLabel: document.getElementById('timer-toggle-btn')?.getAttribute('aria-label') || '',
    })), { timeout: 7000 }).toMatchObject({
      mode: 'timer',
      timeText: expect.stringMatching(/^\d{2}:\d{2}$/),
      toggleLabel: 'Resume timer',
    });
  } finally {
    await cleanup();
  }
});

test('freeflow floating pulse mirrors compact cadence', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'floating-freeflow-pulse');

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await waitForFloatingWindow(electronApp);
    await installFloatingPulseCounter(electronApp);

    await expect.poll(() => readFloatingPulseCount(electronApp), { timeout: 1500 }).toBe(0);

    await setElapsedSecondsForSession(page, (5 * 60) - 5, { mode: 'freeflow' });
    await page.waitForTimeout(1200);
    await expect.poll(() => readFloatingPulseCount(electronApp), { timeout: 1500 }).toBe(0);

    await setElapsedSecondsForSession(page, (5 * 60) + 3, { mode: 'freeflow' });
    await expect.poll(() => readFloatingPulseCount(electronApp), { timeout: 4000 }).toBe(1);

    await setElapsedSecondsForSession(page, (10 * 60) + 6, { mode: 'freeflow' });
    await expect.poll(() => readFloatingPulseCount(electronApp), { timeout: 4000 }).toBe(2);
  } finally {
    await cleanup();
  }
});

test('timed floating pulse mirrors compact thresholds', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'floating-timed-pulse', 5);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await waitForFloatingWindow(electronApp);
    await installFloatingPulseCounter(electronApp);

    await expect.poll(() => readFloatingPulseCount(electronApp), { timeout: 1500 }).toBe(0);

    await setElapsedSecondsForSession(page, 25, { mode: 'timed', totalSeconds: 5 * 60 });
    await page.waitForTimeout(1200);
    await expect.poll(() => readFloatingPulseCount(electronApp), { timeout: 1500 }).toBe(0);

    await setElapsedSecondsForSession(page, 31, { mode: 'timed', totalSeconds: 5 * 60 });
    await expect.poll(() => readFloatingPulseCount(electronApp), { timeout: 4000 }).toBe(1);

    await setElapsedSecondsForSession(page, 61, { mode: 'timed', totalSeconds: 5 * 60 });
    await expect.poll(() => readFloatingPulseCount(electronApp), { timeout: 4000 }).toBe(2);
  } finally {
    await cleanup();
  }
});

test('stopping from the floating timer restores the main window and shows the stop flow', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'floating-stop');

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(() => {
      const windows = electronApp.windows();
      return windows.some((win) => win.url().includes('floating-icon.html'));
    }, { timeout: 7000 }).toBe(true);

    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();

    await floatingWindow.locator('#icon-button').click();
    await floatingWindow.locator('#timer-stop-btn').click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expectPostSessionPrompt(page, 'floating-stop');
    await page.getByTestId('post-session-primary').click();
    await expect(page.getByRole('heading', { name: 'Keep working on floating-stop.' })).toBeVisible();

    await page.getByRole('button', { name: 'Freeflow' }).click();

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
  } finally {
    await cleanup();
  }
});

test('compact controls reveal in-place and auto-hide without shifting the pill width or drag anchor', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-control-restore');

    const baseBounds = await readMainWindowBounds(electronApp);
    expect(baseBounds).toBeTruthy();

    const stopButton = page.locator('button[title="Stop & Save"]');
    await page.locator('.pill').click();
    await expect(stopButton).toBeVisible();

    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return nextBounds?.width || 0;
    }).toBe(baseBounds.width);

    await page.waitForTimeout(3400);

    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return nextBounds?.width || 0;
    }).toBe(baseBounds.width);

    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        width: nextBounds?.width || 0,
      });
    }).toBe(JSON.stringify({
      x: baseBounds.x,
      width: baseBounds.width,
    }));

    await page.evaluate(() => {
      window.electronAPI.pillDragStart();
      window.electronAPI.pillDragMove(-160, 0);
      window.electronAPI.pillDragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return nextBounds?.x || 0;
    }).toBeLessThan(baseBounds.x);

    const movedLeftBounds = await readMainWindowBounds(electronApp);
    expect(movedLeftBounds).toBeTruthy();
    expect(movedLeftBounds.x).toBeLessThan(baseBounds.x);

    await page.evaluate(() => {
      window.electronAPI.pillDragStart();
      window.electronAPI.pillDragMove(80, 0);
      window.electronAPI.pillDragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return nextBounds?.x || 0;
    }).toBeGreaterThan(movedLeftBounds.x);
  } finally {
    await cleanup();
  }
});

test('always-on-top persistence applies to floating icon mode', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      return main ? main.isAlwaysOnTop() : null;
    })).toBe(true);

    await setAlwaysOnTopEnabled(page, false);
    await expect.poll(async () => page.evaluate(() => window.electronAPI.storeGet('settings.alwaysOnTop'))).toBe(false);
    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      return main ? main.isAlwaysOnTop() : null;
    })).toBe(false);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow }) => {
      const floating = BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes('floating-icon.html'));
      return floating ? floating.isAlwaysOnTop() : null;
    }), { timeout: 7000 }).toBe(false);
  } finally {
    await cleanup();
  }
});

test('macOS always-on-top enables workspace visibility for main and floating windows', async () => {
  test.skip(process.platform !== 'darwin', 'macOS-only workspace visibility behavior');

  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await expect.poll(async () => {
      const state = await readWorkspaceVisibilityState(electronApp);
      return state.mainVisibleOnAllWorkspaces;
    }).toBe(true);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(
      () => electronApp.windows().filter((win) => win.url().includes('floating-icon.html')).length,
      { timeout: 7000 },
    ).toBeGreaterThan(0);

    await expect.poll(async () => {
      const state = await readWorkspaceVisibilityState(electronApp);
      return state.floatingVisibleOnAllWorkspaces;
    }, { timeout: 7000 }).toBe(true);

    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();
    await floatingWindow.evaluate(() => window.floatingAPI.expand());

    await expect.poll(async () => {
      const state = await readWorkspaceVisibilityState(electronApp);
      return state.mainVisibleOnAllWorkspaces;
    }, { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('settings opened from compact return to the previous compact position', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-settings-position');

    const baseBounds = await readMainWindowBounds(electronApp);
    expect(baseBounds).toBeTruthy();

    await page.evaluate(() => {
      window.electronAPI.pillDragStart();
      window.electronAPI.pillDragMove(-160, -120);
      window.electronAPI.pillDragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }).not.toBe(JSON.stringify({
      x: baseBounds.x,
      y: baseBounds.y,
    }));

    const movedBounds = await readMainWindowBounds(electronApp);
    expect(movedBounds).toBeTruthy();

    await electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      main?.webContents.send('tray-open-settings');
    });

    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await page.locator('.dialog-content-lg .dialog-close-btn').click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }, { timeout: 7000 }).toBe(JSON.stringify({
      x: movedBounds.x,
      y: movedBounds.y,
    }));
  } finally {
    await cleanup();
  }
});

test('parking lot opened from compact returns to the previous compact position', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-parking-position');

    const baseBounds = await readMainWindowBounds(electronApp);
    expect(baseBounds).toBeTruthy();

    await page.evaluate(() => {
      window.electronAPI.pillDragStart();
      window.electronAPI.pillDragMove(-180, -100);
      window.electronAPI.pillDragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }).not.toBe(JSON.stringify({
      x: baseBounds.x,
      y: baseBounds.y,
    }));

    const movedBounds = await readMainWindowBounds(electronApp);
    expect(movedBounds).toBeTruthy();

    await electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      main?.webContents.send('tray-open-parking-lot');
    });

    await expect(page.getByRole('heading', { name: 'Parking Lot' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Parking Lot' }).click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }, { timeout: 7000 }).toBe(JSON.stringify({
      x: movedBounds.x,
      y: movedBounds.y,
    }));
  } finally {
    await cleanup();
  }
});

test('parking lot task switch can be declined and returns to the previous running session view', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-switch-decline');
    const beforeSeconds = await readDisplayedTimerSeconds(page);
    expect(beforeSeconds).not.toBeNull();

    await electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      main?.webContents.send('tray-open-parking-lot');
    });

    await expect(page.getByRole('heading', { name: 'Parking Lot' })).toBeVisible();
    await page.getByPlaceholder('Capture a thought... (Enter to add)').fill('switch later');
    await page.getByRole('button', { name: 'Add Note' }).click();
    await page.getByRole('button', { name: 'Start This Task' }).click();

    await expect(page.getByRole('heading', { name: 'End current session and switch tasks?' })).toBeVisible();
    await page.getByRole('button', { name: 'No, Keep This Session' }).click();

    await expect(page.getByText('Saved in Parking Lot')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Parking Lot' })).toHaveCount(0);
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');

    await page.waitForTimeout(1200);
    const afterSeconds = await readDisplayedTimerSeconds(page);
    expect(afterSeconds).not.toBeNull();
    expect(afterSeconds).toBeGreaterThan(beforeSeconds);

    const storedThoughts = await page.evaluate(() => window.electronAPI.storeGet('thoughts'));
    expect(storedThoughts.some((thought) => thought?.text === 'switch later')).toBe(true);
  } finally {
    await cleanup();
  }
});

test('parking lot task switch can stop the current session and seed the next task', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'switch-current-session');
    await exitCompactMode(page);
    await setTimeOffset(page, 6500);

    await page.getByRole('button', { name: 'Open Parking Lot' }).click();
    await page.getByPlaceholder('Capture a thought... (Enter to add)').fill('queued switch task');
    await page.getByRole('button', { name: 'Add Note' }).click();
    await page.getByRole('button', { name: 'Start This Task' }).click();

    await expect(page.getByRole('heading', { name: 'End current session and switch tasks?' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes, End Session' }).click();

    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('queued switch task');
    await expect(page.getByRole('button', { name: 'Freeflow' })).toBeVisible();

    const storedThoughts = await page.evaluate(() => window.electronAPI.storeGet('thoughts'));
    expect(storedThoughts.some((thought) => thought?.text === 'queued switch task')).toBe(true);

    const storedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(storedSessions.some((session) => session?.task === 'switch-current-session')).toBe(true);
  } finally {
    await cleanup();
  }
});

test('header navigation gap stays draggable while controls remain clickable', async () => {
  const { page, cleanup } = await launchApp();

  try {
    const navRegion = await readAppRegion(page.locator('.full-header__nav'));
    const parkingLotRegion = await readAppRegion(page.getByRole('button', { name: 'Open Parking Lot' }));
    const settingsRegion = await readAppRegion(page.getByRole('button', { name: 'Open Settings' }));

    expect(navRegion).toContain('drag');
    expect(parkingLotRegion).toContain('no-drag');
    expect(settingsRegion).toContain('no-drag');
  } finally {
    await cleanup();
  }
});

test('manual re-entry into compact anchors from the current full-window position after exiting compact', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-manual-return');

    const baseBounds = await readMainWindowBounds(electronApp);
    expect(baseBounds).toBeTruthy();

    await page.evaluate(() => {
      window.electronAPI.pillDragStart();
      window.electronAPI.pillDragMove(-170, -110);
      window.electronAPI.pillDragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }).not.toBe(JSON.stringify({
      x: baseBounds.x,
      y: baseBounds.y,
    }));

    await exitCompactMode(page);
    const fullBoundsAfterExit = await readMainWindowBounds(electronApp);
    expect(fullBoundsAfterExit).toBeTruthy();
    await page.locator('button[aria-label="Enter Compact Mode"]').click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(
      () => mainWindowMatchesAnchoredCompactPosition(electronApp, fullBoundsAfterExit),
      { timeout: 7000 },
    ).toBe(true);
  } finally {
    await cleanup();
  }
});

test('manual compact entry uses the current full-window position after the full window was moved', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-full-handoff');
    await exitCompactMode(page);

    const fullBounds = await readMainWindowBounds(electronApp);
    expect(fullBounds).toBeTruthy();

    const movedFullBounds = await electronApp.evaluate(({ BrowserWindow }, currentBounds) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      if (!main) return null;
      main.setBounds({
        x: Math.max(0, (currentBounds?.x || 0) - 140),
        y: Math.max(0, (currentBounds?.y || 0) - 120),
        width: currentBounds?.width || 500,
        height: currentBounds?.height || 360,
      });
      return main.getBounds();
    }, fullBounds);
    expect(movedFullBounds).toBeTruthy();

    await page.locator('button[aria-label="Enter Compact Mode"]').click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => {
      const nextBounds = await readMainWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }, { timeout: 7000 }).toBe(JSON.stringify({
      x: movedFullBounds.x,
      y: movedFullBounds.y,
    }));
  } finally {
    await cleanup();
  }
});

test('manual compact entry keeps the pill flush to the bottom-right work area', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-work-area-anchor');
    await exitCompactMode(page);

    await electronApp.evaluate(({ BrowserWindow, screen }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      if (!main) return;
      const currentBounds = main.getBounds();
      const workArea = screen.getDisplayMatching(currentBounds).workArea;
      main.setBounds({
        x: Math.round(workArea.x + workArea.width - currentBounds.width),
        y: Math.round(workArea.y + workArea.height - currentBounds.height),
        width: currentBounds.width,
        height: currentBounds.height,
      });
    });

    await page.locator('button[aria-label="Enter Compact Mode"]').click();
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow, screen }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      if (!main) return false;
      const bounds = main.getBounds();
      const workArea = screen.getDisplayMatching(bounds).workArea;
      const rightDelta = Math.abs((bounds.x + bounds.width) - (workArea.x + workArea.width));
      const bottomDelta = Math.abs((bounds.y + bounds.height) - (workArea.y + workArea.height));
      return rightDelta <= 2 && bottomDelta <= 2;
    }), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('idle compact mode without a task uses the timer-only pill width', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await page.locator('button[aria-label="Enter Compact Mode"]').click();
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return bounds?.width || 0;
    }, { timeout: 7000 }).toBeLessThanOrEqual(154);
  } finally {
    await cleanup();
  }
});

test('compact mode shows the active task by default during a running session', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact visible task');
    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return bounds?.width || 0;
    }, { timeout: 7000 }).toBeGreaterThan(130);
    await expect(page.locator('.pill-content > .pill-task .pill-task-text')).toContainText('compact visible task');
  } finally {
    await cleanup();
  }
});

test('compact mode shows short tasks that stay within the default pill metrics', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'List on Betalist');
    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return bounds?.width || 0;
    }, { timeout: 7000 }).toBeGreaterThan(130);
    await expect(page.locator('.pill-content > .pill-task .pill-task-text')).toContainText('List on Betalist');
  } finally {
    await cleanup();
  }
});

test('compact mode shows the active task by default when a timed session starts', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startTimedSession(page, 'timed compact visible task', 5);
    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return bounds?.width || 0;
    }, { timeout: 7000 }).toBeGreaterThan(130);
    await expect(page.locator('.pill-content > .pill-task .pill-task-text')).toContainText('timed compact visible task');
  } finally {
    await cleanup();
  }
});

test('compact mode keeps the info icon at rest and hides it when controls are open', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact help icon');
    const helpButton = page.locator('.pill-help-btn');
    await expect(helpButton).toBeVisible();
    await helpButton.hover();
    await expect(page.locator('.pill-help-hint')).toBeVisible();

    await page.locator('.pill').click();
    await expect(page.locator('.pill-controls--visible')).toBeVisible();
    await expect(helpButton).toBeHidden();
    await expect(page.locator('.pill-help-hint')).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('compact mode double click exits to fullscreen without first opening controls', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact double click');
    await page.locator('.pill').dblclick();
    await expect.poll(() => readWindowMode(page)).toBe('full');
    await expect(page.locator('.pill-controls--visible')).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('compact mode keeps capped long tasks readable without overflowing the pill', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'Refine top of funnel strategy for beta list launch and newsletter positioning review across twitter substack ADHD engine landing page and first-run activation copy, then tighten the onboarding promise, rewrite the social proof section, draft the beta invite email, and map the follow-up conversion flow');
    await expect.poll(async () => {
      const bounds = await readMainWindowBounds(electronApp);
      return bounds?.height || 0;
    }, { timeout: 7000 }).toBeGreaterThanOrEqual(72);
    const pillTaskText = page.locator('.pill-content > .pill-task .pill-task-text');
    await expect(pillTaskText).toContainText('Refine top of funnel strategy');
    await expect.poll(async () => ((await pillTaskText.textContent()) || '').trim().length).toBeLessThanOrEqual(96);
  } finally {
    await cleanup();
  }
});

test('fullscreen idle state uses the draft composer instead of the running hero card', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await expect(page.locator('.task-composer.task-composer--draft')).toBeVisible();
    await expect(page.locator('.focus-hero')).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('fullscreen running state shows the locked hero card and explains locked edits', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'hero state task');
    await exitCompactMode(page);
    await expect(page.locator('.focus-hero')).toBeVisible();
    await expect(page.locator('.focus-timer-panel')).toHaveCount(0);
    await expect(page.locator('.focus-hero__eyebrow')).toHaveText('Focusing on');
    await expect(page.locator('.focus-hero')).toContainText('hero state task');
    await expect(page.locator('.focus-hero__clock')).toBeVisible();
    await page.locator('.focus-hero__lock-surface').click();
    await expect(page.getByText('Task is locked while timer is running. Pause or stop to edit.')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('fullscreen paused state restores the editable composer and resuming restores the hero card', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'paused hero state');
    await exitCompactMode(page);
    await page.getByRole('button', { name: 'Pause Timer' }).click();
    await expect(page.locator('.focus-hero')).toHaveCount(0);
    await expect(page.locator('.task-composer.task-composer--paused')).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('paused hero state');
    await page.getByRole('button', { name: 'Resume Timer' }).click();
    await expect(page.locator('.focus-hero')).toBeVisible();
    await expect(page.locator('.focus-hero')).toContainText('paused hero state');
  } finally {
    await cleanup();
  }
});

test('fullscreen hero keeps timed session context after exiting compact mode', async () => {
  const { page, cleanup } = await launchApp({ background: false });

  try {
    await startTimedSession(page, 'timed hero state', 5);
    await exitCompactMode(page);
    await expect(page.locator('.focus-hero')).toBeVisible();
    await expect(page.locator('.focus-hero')).toContainText('timed hero state');
    await expect(page.locator('.focus-hero__clock')).toHaveText(/^\d{1,2}:\d{2}$/);
  } finally {
    await cleanup();
  }
});

test('quitting while a timer is running restores the task with a paused timer on relaunch', async () => {
  const storeDir = createStoreDir();
  let firstLaunch = null;
  let secondLaunch = null;

  try {
    firstLaunch = await launchApp({ background: false, storeDir });
    await startFreeflowSession(firstLaunch.page, 'resume after quit');

    await firstLaunch.page.waitForTimeout(2200);
    const beforeQuitState = await firstLaunch.page.evaluate(async () => window.electronAPI.storeGet('timerState'));
    expect(beforeQuitState?.isRunning).toBe(true);

    await firstLaunch.cleanup({ deleteStoreDir: false });
    firstLaunch = null;

    const storedAfterQuit = JSON.parse(fs.readFileSync(path.join(storeDir, 'config.json'), 'utf8'));
    expect(storedAfterQuit.currentTask?.text).toBe('resume after quit');
    expect(storedAfterQuit.currentTask?.startedAt ?? null).toBeNull();
    expect(storedAfterQuit.timerState?.isRunning).toBe(false);
    expect(storedAfterQuit.timerState?.sessionStartedAt ?? null).toBeNull();
    expect(storedAfterQuit.timerState?.elapsedSeconds).toBeGreaterThanOrEqual(1);

    secondLaunch = await launchApp({ background: false, storeDir });

    await expect.poll(async () => {
      const timerState = await secondLaunch.page.evaluate(async () => window.electronAPI.storeGet('timerState'));
      return JSON.stringify({
        isRunning: timerState?.isRunning ?? null,
        sessionStartedAt: timerState?.sessionStartedAt ?? null,
      });
    }, { timeout: 7000 }).toBe(JSON.stringify({
      isRunning: false,
      sessionStartedAt: null,
    }));

    await expect.poll(
      () => readDisplayedTimerSeconds(secondLaunch.page),
      { timeout: 7000 },
    ).not.toBeNull();
    const firstDisplayedSeconds = await readDisplayedTimerSeconds(secondLaunch.page);
    await expect(secondLaunch.page.locator(TASK_INPUT_SELECTOR)).toHaveValue('resume after quit');

    await secondLaunch.page.waitForTimeout(1800);
    const secondDisplayedSeconds = await readDisplayedTimerSeconds(secondLaunch.page);
    expect(secondDisplayedSeconds).toBe(firstDisplayedSeconds);
  } finally {
    await firstLaunch?.cleanup({ deleteStoreDir: false });
    await secondLaunch?.cleanup({ deleteStoreDir: true });
  }
});

test('compact drag can clamp flush to the left work area edge', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-left-edge');
    await page.evaluate(() => {
      window.electronAPI.pillDragStart();
      window.electronAPI.pillDragMove(-4000, 0);
      window.electronAPI.pillDragEnd();
    });

    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow, screen }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      if (!main) return false;
      const bounds = main.getBounds();
      const workArea = screen.getDisplayMatching(bounds).workArea;
      return Math.abs(bounds.x - workArea.x) <= 2;
    }), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('compact drag can clamp flush to the top work area edge', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-top-edge');
    await page.evaluate(() => {
      window.electronAPI.pillDragStart();
      window.electronAPI.pillDragMove(0, -4000);
      window.electronAPI.pillDragEnd();
    });

    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow, screen }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      if (!main) return false;
      const bounds = main.getBounds();
      const workArea = screen.getDisplayMatching(bounds).workArea;
      return Math.abs(bounds.y - workArea.y) <= 2;
    }), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('manual exit from compact restores a usable full window running shell', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'compact-full-shell');
    await exitCompactMode(page);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.getByText('compact-full-shell')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause Timer' })).toBeVisible();
    await expect.poll(async () => (await readMainWindowBounds(electronApp))?.width || 0, { timeout: 7000 })
      .toBeGreaterThanOrEqual(432);
    await expect.poll(async () => (await readMainWindowBounds(electronApp))?.height || 0, { timeout: 7000 })
      .toBeGreaterThanOrEqual(120);
  } finally {
    await cleanup();
  }
});

test('open parking lot shortcut exits compact mode before showing quick capture', async () => {
  const { electronApp, page, cleanup } = await launchApp();
  try {
    await triggerShortcutAction(electronApp, 'toggleCompact');
    await expect.poll(() => readWindowMode(page)).toBe('pill');

    await triggerShortcutAction(electronApp, 'openParkingLot');
    await expect(page.locator('[data-quick-capture-textarea]')).toBeVisible();
    await expect.poll(() => readWindowMode(page)).toBe('full');
  } finally {
    await cleanup();
  }
});

test('keep-for-later save restores the previous compact view and returns focus to the prior app', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });
  try {
    await triggerShortcutAction(electronApp, 'toggleCompact');
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');

    await setE2EFrontmostApp(page, {
      bundleId: 'com.example.Writer',
      name: 'Writer',
    });

    await triggerShortcutAction(electronApp, {
      action: 'openParkingLot',
      focusReturnSource: 'parkingLot',
    });

    await expect(page.locator('[data-quick-capture-textarea]')).toBeVisible();
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');

    await page.locator('[data-quick-capture-textarea]').fill('return me to compact');
    await page.getByRole('button', { name: 'Save to Parking Lot (Enter)' }).click();

    await expect(page.locator('[data-quick-capture-textarea]')).toHaveCount(0);
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => JSON.stringify(await readE2ELastActivatedApp(page)), { timeout: 7000 })
      .toBe(JSON.stringify({
        bundleId: 'com.example.Writer',
        name: 'Writer',
      }));
  } finally {
    await cleanup();
  }
});

test('freeflow check-in appears at the configured interval', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await expect.poll(async () => {
      const settings = await page.evaluate(() => window.electronAPI.storeGet('settings'));
      return settings?.checkInIntervalFreeflow ?? null;
    }).toBe(5);

    await startFreeflowSession(page, 'checkin-interval');
    await setTimeOffset(page, 301000);

    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('checkin-interval?')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('freeflow check-in stays on the compact prompt surface and returns to compact after responding', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'compact-checkin-return');

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect(page.locator('.checkin-popup-compact')).toBeVisible();
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('compact-checkin-return?')).toBeVisible();

    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator('.checkin-popup-compact')).toHaveCount(0);
    await expectCheckInToastMessage(page, FOCUSED_CHECKIN_MESSAGES);
    await expect(page.locator('.pill-success-cue--active')).toBeVisible();
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
  } finally {
    await cleanup();
  }
});

test('freeflow compact-origin check-in expands to the full detour flow after No and returns to compact on dismiss', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'compact-checkin-detour');

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect(page.locator('.checkin-popup-compact')).toBeVisible();
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('compact-checkin-detour?')).toBeVisible();

    await page.getByRole('button', { name: 'No', exact: true }).click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.locator('.checkin-popup-compact')).toHaveCount(0);
    await expect(page.getByText('What happened?')).toBeVisible();

    await page.getByRole('button', { name: 'Took a detour' }).click();
    await expect(page.getByRole('button', { name: 'Jot it down' })).toBeVisible();
    await page.locator('button[title="Dismiss"]').click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
  } finally {
    await cleanup();
  }
});

test('freeflow check-in still uses the full prompt surface when compact mode is not active', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'full-window-checkin');
    await exitCompactMode(page);

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.locator('.checkin-popup-compact')).toHaveCount(0);
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('full-window-checkin?')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('freeflow full-window check-in shows a positive message after Yes', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'full-window-checkin-focused');
    await exitCompactMode(page);

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('full-window-checkin-focused?')).toBeVisible();

    await page.getByRole('button', { name: 'Yes' }).click();

    await expectCheckInToastMessage(page, FOCUSED_CHECKIN_MESSAGES);
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
  } finally {
    await cleanup();
  }
});

test('freeflow full-window check-in opens and dismisses the detour flow after No', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'full-window-checkin-detour');
    await exitCompactMode(page);

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('full-window-checkin-detour?')).toBeVisible();

    await page.getByRole('button', { name: 'No', exact: true }).click();

    await expect(page.getByText('What happened?')).toBeVisible();
    await page.getByRole('button', { name: 'Took a detour' }).click();
    await expect(page.getByRole('button', { name: 'Jot it down' })).toBeVisible();
    await page.locator('button[title="Dismiss"]').click();

    await expect(page.getByText('What happened?')).toHaveCount(0);
    await expect(page.locator('.toast-checkin')).toHaveCount(0);
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
  } finally {
    await cleanup();
  }
});

test('freeflow full-window check-in hands off directly into Session Wrap after Finished', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'full-window-checkin-finished');
    await exitCompactMode(page);

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('full-window-checkin-finished?')).toBeVisible();

    await page.getByRole('button', { name: 'No', exact: true }).click();
    await expect(page.getByText('What happened?')).toBeVisible();
    await page.getByRole('button', { name: 'Finished' }).click();

    await expectPostSessionPrompt(page, 'full-window-checkin-finished');
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
  } finally {
    await cleanup();
  }
});

test('freeflow check-in restores from floating minimize and snaps back to the nearest corner after detour dismiss', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'floating-checkin-return');
    await exitCompactMode(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await expect.poll(() => electronApp.windows().filter((win) => win.url().includes('floating-icon.html')).length, { timeout: 7000 })
      .toBeGreaterThan(0);
    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();

    const baseFloatingBounds = await readFloatingWindowBounds(electronApp);
    expect(baseFloatingBounds).toBeTruthy();

    await floatingWindow.evaluate(() => {
      window.floatingAPI.dragStart();
      window.floatingAPI.dragMove(-150, 110);
      window.floatingAPI.dragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readFloatingWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }).not.toBe(JSON.stringify({
      x: baseFloatingBounds.x,
      y: baseFloatingBounds.y,
    }));

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.locator('.checkin-popup-compact')).toBeVisible();
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('floating-checkin-return?')).toBeVisible();

    await page.getByRole('button', { name: 'No', exact: true }).click();
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.getByText('What happened?')).toBeVisible();
    await page.getByRole('button', { name: 'Took a detour' }).click();
    await expect(page.getByRole('button', { name: 'Jot it down' })).toBeVisible();
    await page.locator('button[title="Dismiss"]').click();

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
    await expect.poll(() => floatingWindowMatchesNearestCorner(electronApp), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('freeflow check-in restores from floating minimize and snaps back to the nearest corner after confirming focus', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'floating-checkin-focused-return');
    await exitCompactMode(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await expect.poll(() => electronApp.windows().filter((win) => win.url().includes('floating-icon.html')).length, { timeout: 7000 })
      .toBeGreaterThan(0);
    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();

    const baseFloatingBounds = await readFloatingWindowBounds(electronApp);
    expect(baseFloatingBounds).toBeTruthy();

    await floatingWindow.evaluate(() => {
      window.floatingAPI.dragStart();
      window.floatingAPI.dragMove(-140, 100);
      window.floatingAPI.dragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readFloatingWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }).not.toBe(JSON.stringify({
      x: baseFloatingBounds.x,
      y: baseFloatingBounds.y,
    }));

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.locator('.checkin-popup-compact')).toBeVisible();
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('floating-checkin-focused-return?')).toBeVisible();

    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator('.checkin-popup-compact')).toHaveCount(0);
    await expectCheckInToastMessage(page, FOCUSED_CHECKIN_MESSAGES);
    await expect(page.locator('.pill-success-cue--active')).toBeVisible();
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
    await expect.poll(() => floatingWindowMatchesNearestCorner(electronApp), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('global check-in yes restores the floating view and returns focus to the prior app', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'floating-checkin-global-shortcut-return');
    await exitCompactMode(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await setE2EFrontmostApp(page, {
      bundleId: 'com.example.Writer',
      name: 'Writer',
    });

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.locator('.checkin-popup-compact')).toBeVisible();

    await triggerCheckInYesShortcut(electronApp, {
      action: 'focused',
      focusReturnSource: 'checkin',
    });

    await expect(page.locator('.checkin-popup-compact')).toHaveCount(0);
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
    await expect.poll(async () => JSON.stringify(await readE2ELastActivatedApp(page)), { timeout: 7000 })
      .toBe(JSON.stringify({
        bundleId: 'com.example.Writer',
        name: 'Writer',
      }));
  } finally {
    await cleanup();
  }
});

test('timed check-in stays on the compact prompt surface and returns to compact after responding', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'timed-compact-checkin', 5);

    await setTimeOffset(page, 121000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect(page.locator('.checkin-popup-compact')).toBeVisible();
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('timed-compact-checkin?')).toBeVisible();

    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator('.checkin-popup-compact')).toHaveCount(0);
    await expectCheckInToastMessage(page, FOCUSED_CHECKIN_MESSAGES);
    await expect(page.locator('.pill-success-cue--active')).toBeVisible();
    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
  } finally {
    await cleanup();
  }
});

test('timed check-in restores from floating minimize into the compact prompt and snaps back to the nearest corner after confirming focus', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      settings: {
        checkInEnabled: true,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'timed-floating-checkin', 5);
    await exitCompactMode(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    await expect.poll(() => electronApp.windows().filter((win) => win.url().includes('floating-icon.html')).length, { timeout: 7000 })
      .toBeGreaterThan(0);
    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();

    const baseFloatingBounds = await readFloatingWindowBounds(electronApp);
    expect(baseFloatingBounds).toBeTruthy();

    await floatingWindow.evaluate(() => {
      window.floatingAPI.dragStart();
      window.floatingAPI.dragMove(-135, 90);
      window.floatingAPI.dragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readFloatingWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }).not.toBe(JSON.stringify({
      x: baseFloatingBounds.x,
      y: baseFloatingBounds.y,
    }));

    await setTimeOffset(page, 121000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.locator('.checkin-popup-compact')).toBeVisible();
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('timed-floating-checkin?')).toBeVisible();

    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator('.checkin-popup-compact')).toHaveCount(0);
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
    await expect.poll(() => floatingWindowMatchesNearestCorner(electronApp), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('freeflow check-ins stay suppressed during DND and appear after DND is turned off', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
        doNotDisturbEnabled: true,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await expect.poll(async () => {
      const settings = await page.evaluate(() => window.electronAPI.storeGet('settings'));
      return JSON.stringify({
        interval: settings?.checkInIntervalFreeflow ?? null,
        dnd: settings?.doNotDisturbEnabled ?? null,
      });
    }).toBe(JSON.stringify({ interval: 5, dnd: true }));

    await startFreeflowSession(page, 'dnd-ui-checkin');
    await setTimeOffset(page, 301000);
    await page.waitForTimeout(1000);
    await expect(page.getByText('Still focused on')).toHaveCount(0);

    await setDndEnabled(electronApp, page, false);
    await expect.poll(async () => page.evaluate(() => window.electronAPI.storeGet('settings.doNotDisturbEnabled'))).toBe(false);

    await expect(page.getByText('Still focused on')).toBeVisible({ timeout: 7000 });
    await expect(page.getByText('dnd-ui-checkin?')).toBeVisible({ timeout: 7000 });
  } finally {
    await cleanup();
  }
});

test('reusing a task from history does not overwrite historical session id or leave the window oversized', async () => {
  const originalCreatedAt = new Date('2026-01-01T12:00:00.000Z').toISOString();
  const seedSession = {
    id: 'hist-1',
    task: 'History seed task',
    durationMinutes: 22,
    mode: 'freeflow',
    completed: false,
    kept: true,
    notes: 'seed note',
    createdAt: originalCreatedAt,
  };

  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await page.evaluate(async (session) => {
      await window.electronAPI.storeSet('sessions', [session]);
    }, seedSession);
    await page.reload();
    await page.waitForSelector(TASK_INPUT_SELECTOR);

    await page.getByRole('button', { name: 'Open Session History' }).click();
    await expect(page.getByText('History seed task')).toBeVisible();
    await page.getByRole('button', { name: 'Preview Session Notes' }).first().click();
    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      return main ? main.getBounds().height : null;
    })).toBeLessThanOrEqual(640);

    await page.getByRole('button', { name: 'Start This Task' }).click();
    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      return main ? main.getBounds().height : null;
    })).toBeLessThanOrEqual(420);

    let mainPage = page;
    const taskInput = mainPage.locator(TASK_INPUT_SELECTOR);
    await expect(taskInput).toHaveValue('History seed task');
    await taskInput.press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();

    await page.waitForTimeout(500);

    const sessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    const original = sessions.find((item) => item.id === 'hist-1');
    expect(original).toBeTruthy();
    expect(original.task).toBe('History seed task');
    expect(original.durationMinutes).toBe(22);
    expect(original.createdAt).toBe(originalCreatedAt);

    const spawned = sessions.filter((item) => item.id !== 'hist-1' && item.task === 'History seed task');
    expect(spawned.length).toBeGreaterThan(0);
  } finally {
    await cleanup();
  }
});

test('update errors are shown as concise user-facing copy', async () => {
  const { page, cleanup } = await launchApp({
    extraEnv: {
      FOCANA_E2E_UPDATER_SCENARIO: 'error',
      FOCANA_DISABLE_AUTO_UPDATES: '1',
    },
  });

  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('button', { name: 'Check for Updates' }).click();
    await expect(page.getByText('Could not check for updates.')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('automatic update check failures stay quiet until the user manually checks', async () => {
  const { page, cleanup } = await launchApp({
    extraEnv: {
      FOCANA_E2E_UPDATER_SCENARIO: 'error',
    },
  });

  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await expect(page.getByText('Automatic update checks run on app launch.')).toBeVisible();
    await expect(page.getByText('Could not check for updates.')).toHaveCount(0);

    await page.getByRole('button', { name: 'Check for Updates' }).click();
    await expect(page.getByText('Could not check for updates.')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('history renders safely when session createdAt is invalid', async () => {
  const badDateSession = {
    id: 'hist-bad-date',
    task: 'Bad date task',
    durationMinutes: 8,
    mode: 'freeflow',
    completed: false,
    notes: '',
    createdAt: 'not-a-real-date',
  };

  const { page, cleanup } = await launchApp();
  try {
    await page.evaluate(async (session) => {
      await window.electronAPI.storeSet('sessions', [session]);
    }, badDateSession);
    await page.reload();
    await page.waitForSelector(TASK_INPUT_SELECTOR);

    await page.getByRole('button', { name: 'Open Session History' }).click();
    await page.getByRole('tab', { name: 'Discarded' }).click();
    await expect(page.getByText('Bad date task')).toBeVisible();
    await expect(page.getByText('Unknown date')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('history delete requires explicit confirmation for single and bulk actions', async () => {
  const sessions = [
    {
      id: 'hist-delete-1',
      task: 'Delete me first',
      durationMinutes: 12,
      mode: 'freeflow',
      completed: false,
      notes: '',
      createdAt: new Date('2026-02-01T12:00:00.000Z').toISOString(),
    },
    {
      id: 'hist-delete-2',
      task: 'Delete me second',
      durationMinutes: 9,
      mode: 'freeflow',
      completed: false,
      notes: '',
      createdAt: new Date('2026-02-02T12:00:00.000Z').toISOString(),
    },
  ];

  const { page, cleanup } = await launchApp();

  try {
    await page.evaluate(async (nextSessions) => {
      await window.electronAPI.storeSet('sessions', nextSessions);
    }, sessions);
    await page.reload();

    await page.getByRole('button', { name: 'Open Session History' }).click();
    await page.getByRole('tab', { name: 'Discarded' }).click();
    await expect(page.getByText('Delete me first')).toBeVisible();

    await page.getByRole('button', { name: 'Delete Session' }).first().click();
    await expect(page.getByRole('heading', { name: 'Delete session?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Delete session?' })).toHaveCount(0);

    let storedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(storedSessions).toHaveLength(2);

    await page.getByLabel('Select session Delete me first').check();
    await page.getByLabel('Select session Delete me second').check();
    await page.getByRole('button', { name: 'Delete Selected (2)' }).click();
    await expect(page.getByRole('heading', { name: 'Delete session?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Sessions' }).click();

    await expect(page.getByText('No discarded sessions yet.')).toBeVisible();
    storedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(storedSessions).toHaveLength(0);
  } finally {
    await cleanup();
  }
});

test('history can restore completed and discarded sessions back to Resume', async () => {
  const sessions = [
    {
      id: 'hist-complete-1',
      task: 'Completed restore me',
      durationMinutes: 15,
      mode: 'freeflow',
      completed: true,
      kept: false,
      notes: 'completed note',
      createdAt: new Date('2026-02-10T12:00:00.000Z').toISOString(),
    },
    {
      id: 'hist-discard-1',
      task: 'Discarded restore me',
      durationMinutes: 9,
      mode: 'freeflow',
      completed: false,
      kept: false,
      notes: 'discarded note',
      createdAt: new Date('2026-02-11T12:00:00.000Z').toISOString(),
    },
  ];

  const { page, cleanup } = await launchApp();

  try {
    await page.evaluate(async (nextSessions) => {
      await window.electronAPI.storeSet('sessions', nextSessions);
    }, sessions);
    await page.reload();

    await page.getByRole('button', { name: 'Open Session History' }).click();
    await page.getByRole('tab', { name: 'Completed' }).click();
    await expect(page.getByText('Completed restore me')).toBeVisible();
    await page.getByRole('button', { name: 'Restore to Resume' }).click();
    await expect(page.getByText('No completed sessions yet.')).toBeVisible();

    await page.getByRole('tab', { name: 'Discarded' }).click();
    await expect(page.getByText('Discarded restore me')).toBeVisible();
    await page.getByRole('button', { name: 'Restore to Resume' }).click();
    await expect(page.getByText('No discarded sessions yet.')).toBeVisible();

    await page.getByRole('tab', { name: 'Resume' }).click();
    await expect(page.getByText('Completed restore me')).toBeVisible();
    await expect(page.getByText('Discarded restore me')).toBeVisible();

    const storedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    const restoredCompleted = storedSessions.find((item) => item.id === 'hist-complete-1');
    const restoredDiscarded = storedSessions.find((item) => item.id === 'hist-discard-1');
    expect(restoredCompleted.completed).toBe(false);
    expect(restoredCompleted.kept).toBe(true);
    expect(restoredDiscarded.completed).toBe(false);
    expect(restoredDiscarded.kept).toBe(true);
  } finally {
    await cleanup();
  }
});

test('shortcuts tab explains the keep-for-later global shortcut and temporary check-in shortcut', async () => {
  const { page, cleanup } = await launchApp();
  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('tab', { name: 'Shortcuts' }).click();

    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    await expect(page.getByText('Keep for Later', { exact: true })).toBeVisible();
    await expect(page.getByText('Global shortcut for quick Parking Lot capture from anywhere.')).toBeVisible();
    await expect(page.getByText('Check-in: Yes', { exact: true })).toBeVisible();
    await expect(page.getByText('Temporary global shortcut while the first check-in menu is visible.')).toBeVisible();
    await expect(page.getByText('Keep for Later is always global, and Check-in: Yes only goes global while a prompt is on screen.')).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('keep-for-later is the only registered global shortcut on launch', async () => {
  const { electronApp, cleanup } = await launchApp();
  try {
    const registrationState = await readGlobalShortcutRegistrationState(electronApp);

    expect(registrationState).toEqual({
      keepForLater: true,
      checkInYes: false,
      startPause: false,
      newTask: false,
      toggleCompact: false,
      completeTask: false,
      openParkingLotLegacy: false,
    });
  } finally {
    await cleanup();
  }
});

test('check-in yes becomes a temporary global shortcut only while a prompt is visible', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      settings: {
        checkInEnabled: true,
        checkInIntervalFreeflow: 5,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'global-checkin-yes');

    await expect.poll(async () => {
      const registrationState = await readGlobalShortcutRegistrationState(electronApp);
      return registrationState.checkInYes;
    }).toBe(false);

    await setTimeOffset(page, 301000);
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('global-checkin-yes?')).toBeVisible();

    await expect.poll(async () => {
      const registrationState = await readGlobalShortcutRegistrationState(electronApp);
      return registrationState.checkInYes;
    }, { timeout: 7000 }).toBe(true);

    await triggerCheckInYesShortcut(electronApp);

    await expect(page.getByText('Still focused on')).toHaveCount(0);
    await expectCheckInToastMessage(page, FOCUSED_CHECKIN_MESSAGES);
    await expect.poll(async () => {
      const registrationState = await readGlobalShortcutRegistrationState(electronApp);
      return registrationState.checkInYes;
    }, { timeout: 7000 }).toBe(false);
  } finally {
    await cleanup();
  }
});

test('closing settings from the shortcuts tab leaves the task input usable', async () => {
  const { page, cleanup } = await launchApp();
  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('tab', { name: 'Shortcuts' }).click();

    await page.locator('.dialog-content-lg .dialog-close-btn').click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);

    const taskInput = page.locator(TASK_INPUT_SELECTOR);
    await taskInput.click();
    await page.keyboard.type('keyboard cleanup check');
    await expect(taskInput).toHaveValue('keyboard cleanup check');
  } finally {
    await cleanup();
  }
});

test('escape closes only the top-most dialog', async () => {
  const { electronApp, page, cleanup } = await launchApp();
  try {
    const nestedThought = `nested-${Date.now()}`;

    await triggerShortcutAction(electronApp, 'openParkingLot');
    await expect(page.locator('[data-quick-capture-textarea]')).toBeVisible();
    await page.locator('[data-quick-capture-textarea]').fill(nestedThought);
    await page.getByRole('button', { name: 'Save to Parking Lot (Enter)' }).click();

    await page.getByRole('button', { name: 'Open Parking Lot' }).click();
    await page.getByText(nestedThought).click();
    await expect(page.getByRole('heading', { name: 'Edit Note' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Edit Note' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Parking Lot' })).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('timed start blocks values above 240 until a valid whole number is entered', async () => {
  const { page, cleanup } = await launchApp();

  try {
    const taskInput = page.locator(TASK_INPUT_SELECTOR);
    await taskInput.fill('Timed clamp task');
    await taskInput.press('Enter');

    const minutesInput = page.locator('.start-chooser__input').first();
    await minutesInput.fill('300');
    await minutesInput.press('Enter');

    await expect(page.getByRole('heading', { name: 'Timer input error' })).toBeVisible();
    await expect(page.getByText('240 minuntes max')).toBeVisible();

    const blockedState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
    expect(blockedState.isRunning).toBe(false);
    expect(blockedState.seconds).toBe(0);

    await page.getByRole('button', { name: 'OK' }).click();
    await minutesInput.fill('240');
    await minutesInput.press('Enter');

    await expect.poll(async () => {
      const timerState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
      return `${timerState.initialTime}:${timerState.isRunning}`;
    }).toBe(`${240 * 60}:true`);
  } finally {
    await cleanup();
  }
});

test('timed start only accepts whole numbers', async () => {
  const { page, cleanup } = await launchApp();

  try {
    const taskInput = page.locator(TASK_INPUT_SELECTOR);
    await taskInput.fill('Whole number validation task');
    await taskInput.press('Enter');

    const minutesInput = page.locator('.start-chooser__input').first();
    await minutesInput.fill('12.5');
    await minutesInput.press('Enter');

    await expect(page.getByRole('heading', { name: 'Timer input error' })).toBeVisible();
    await expect(page.getByText('Whole numbers only')).toBeVisible();

    const timerState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
    expect(timerState.isRunning).toBe(false);
    expect(timerState.seconds).toBe(0);
  } finally {
    await cleanup();
  }
});

test('window state with zero height is sanitized at startup', async () => {
  const { electronApp, cleanup } = await launchApp({
    seedConfig: {
      windowState: {
        x: 100,
        y: 100,
        width: 500,
        height: 0,
      },
    },
  });

  try {
    const height = await electronApp.evaluate(({ BrowserWindow }) => {
      const [win] = BrowserWindow.getAllWindows();
      return win ? win.getBounds().height : 0;
    });

    expect(height).toBeGreaterThanOrEqual(120);
  } finally {
    await cleanup();
  }
});

test('app starts with analytics disabled and emits no PostHog warnings', async () => {
  const consoleMessages = [];
  const { page, cleanup } = await launchApp({
    onPage: async (nextPage) => {
      nextPage.on('console', (message) => {
        consoleMessages.push(message.text());
      });
    },
  });

  try {
    await expect(page.locator(TASK_INPUT_SELECTOR)).toBeVisible();
    expect(consoleMessages.some((message) => message.includes('PostHog'))).toBe(false);
  } finally {
    await cleanup();
  }
});

test('stop flow save-for-later keeps split notes and lands in the post-session prompt', async () => {
  const { electronApp, page, cleanup } = await launchApp();

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('stop-flow-unified');
    await page.locator(TASK_INPUT_SELECTOR).press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();
    await expect.poll(() => readWindowMode(page)).toBe('pill');
    await page.waitForTimeout(6500);
    await page.locator('.pill').click();
    await page.locator('button[title="Stop & Save"]').click();
    await expectPostSessionPrompt(page, 'stop-flow-unified');

    await page.getByTestId('post-session-new-task').click();
    await expect(page.getByRole('heading', { name: 'Start a new task' })).toBeVisible();
    await page.getByRole('button', { name: 'Save for later' }).click();
    await expect(page.getByRole('heading', { name: 'Save “stop-flow-unified” for later' })).toBeVisible();
    await expect.poll(async () => {
      const buttonBox = await page.getByRole('button', { name: 'Save and continue' }).boundingBox();
      if (!buttonBox) return false;
      const bounds = await readMainWindowBounds(electronApp);
      if (!bounds) return false;
      return (buttonBox.y + buttonBox.height) <= (bounds.height - 8);
    }, { timeout: 7000 }).toBe(true);

    await fillSplitSessionNotes(page, {
      nextSteps: 'resume from here',
      recap: 'left the final section half-drafted',
    });
    await page.getByRole('button', { name: 'Save and continue' }).click();

    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('');

    const savedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(savedSessions[0].completed).toBe(false);
    expect(savedSessions[0].kept).toBe(true);
    expect(savedSessions[0].notes).toBe('left the final section half-drafted');
    expect(savedSessions[0].recap).toBe('left the final section half-drafted');
    expect(savedSessions[0].nextSteps).toBe('resume from here');
  } finally {
    await cleanup();
  }
});

test('keep working from the stop flow returns a compact-origin session to compact mode', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('stop-flow-resume-compact');
    await page.locator(TASK_INPUT_SELECTOR).press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();
    await expect.poll(() => readWindowMode(page)).toBe('pill');

    await page.waitForTimeout(6500);
    await page.locator('.pill').click();
    await page.locator('button[title="Stop & Save"]').click();

    await expectPostSessionPrompt(page, 'stop-flow-resume-compact');
    await page.getByTestId('post-session-primary').click();
    await expect(page.getByRole('heading', { name: 'Keep working on stop-flow-resume-compact.' })).toBeVisible();
    await page.getByRole('button', { name: 'Freeflow' }).click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
    const timerBefore = await page.locator('.pill-timer').textContent();
    await page.waitForTimeout(1200);
    const timerAfter = await page.locator('.pill-timer').textContent();
    expect(timerAfter).not.toBe(timerBefore);
  } finally {
    await cleanup();
  }
});

test('start-a-new-task mark-complete records completion and returns to the idle screen', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('stop-flow-complete-message');
    await page.locator(TASK_INPUT_SELECTOR).press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();
    await expect.poll(() => readWindowMode(page)).toBe('pill');

    await page.waitForTimeout(6500);
    await page.locator('.pill').click();
    await page.locator('button[title="Stop & Save"]').click();
    await expectPostSessionPrompt(page, 'stop-flow-complete-message');
    await page.getByTestId('post-session-new-task').click();
    await page.getByRole('button', { name: 'Mark complete' }).click();

    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('');
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveAttribute('placeholder', 'What are we focusing on next?');
    const savedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(savedSessions[0].task).toBe('stop-flow-complete-message');
    expect(savedSessions[0].completed).toBe(true);
  } finally {
    await cleanup();
  }
});

test('session-wrap CTA clicks dismiss feedback without recording sentiment', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await seedPreviousSession(page);
    await installTimeOffsetControl(page);
    await page.locator(TASK_INPUT_SELECTOR).fill('feedback-close');
    await page.locator(TASK_INPUT_SELECTOR).press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();
    await expect.poll(() => readWindowMode(page)).toBe('pill');

    await setTimeOffset(page, 7000);
    await page.locator('.pill').click();
    await page.locator('button[title="Stop & Save"]').click();
    await expectPostSessionPrompt(page, 'feedback-close');
    await expect(page.getByTestId('post-session-feedback-row')).toBeVisible({ timeout: 3000 });

    await page.getByTestId('post-session-new-task').click();
    await expect(page.getByRole('heading', { name: 'Start a new task' })).toBeVisible();
    await expect(page.getByTestId('post-session-feedback-row')).toHaveCount(0);

    await expect.poll(async () => {
      const queue = await page.evaluate(() => window.electronAPI.storeGet('feedbackQueue'));
      return Array.isArray(queue) ? queue.length : 0;
    }).toBe(0);

    await expect.poll(async () => {
      const settings = await page.evaluate(() => window.electronAPI.storeGet('settings'));
      return settings?.postSessionFeedbackSkippedStreak || 0;
    }).toBe(1);
  } finally {
    await cleanup();
  }
});

test('post-session break keeps the app quiet until the preset ends, then shows the floating resume prompt', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'post-session-break');
    await exitCompactMode(page);

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'post-session-break');

    await page.getByTestId('post-session-break').click();
    await expect(page.getByRole('heading', { name: 'You deserve a break.' })).toBeVisible();
    await page.getByRole('button', { name: 'BRB' }).click();

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'break-timer', stage: null }));

    await setTimeOffset(page, (5 * 60 * 1000) - 15000);
    await page.waitForTimeout(1200);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 3000 })
      .toBe(JSON.stringify({ mode: 'break-timer', stage: null }));

    await setTimeOffset(page, (5 * 60 * 1000) + 2000);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'resume-choice' }));
  } finally {
    await cleanup();
  }
});

test('post-session break can hide the timer and minimize to the quiet logo', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'post-session-break-hide-timer');
    await exitCompactMode(page);

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'post-session-break-hide-timer');

    await page.getByTestId('post-session-break').click();
    await expect(page.getByRole('heading', { name: 'You deserve a break.' })).toBeVisible();
    await page.getByRole('button', { name: 'Hide timer' }).click();
    await page.getByRole('button', { name: 'BRB' }).click();

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'icon', stage: null }));
  } finally {
    await cleanup();
  }
});

test('post-session hidden break icon single click peeks the timer temporarily, and double click opens the resume prompt', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'post-session-break-hidden-peek');
    await exitCompactMode(page);

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'post-session-break-hidden-peek');

    await page.getByTestId('post-session-break').click();
    await expect(page.getByRole('heading', { name: 'You deserve a break.' })).toBeVisible();
    await page.getByRole('button', { name: 'Hide timer' }).click();
    await page.getByRole('button', { name: 'BRB' }).click();

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'icon', stage: null }));

    await floatingWindow.locator('#icon-button').click();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 3000 })
      .toBe(JSON.stringify({ mode: 'break-timer', stage: null }));

    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'icon', stage: null }));

    await floatingWindow.locator('#icon-button').dblclick();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'resume-choice' }));
  } finally {
    await cleanup();
  }
});

test('post-session visible break timer single click opens the resume prompt', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'post-session-break-visible-click');
    await exitCompactMode(page);

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'post-session-break-visible-click');

    await page.getByTestId('post-session-break').click();
    await expect(page.getByRole('heading', { name: 'You deserve a break.' })).toBeVisible();
    await page.getByRole('button', { name: 'BRB' }).click();

    const floatingWindow = await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'break-timer', stage: null }));

    await floatingWindow.locator('#icon-button').click();
    await expect.poll(async () => JSON.stringify(await readFloatingPromptState(floatingWindow)), { timeout: 7000 })
      .toBe(JSON.stringify({ mode: 'prompt', stage: 'resume-choice' }));
  } finally {
    await cleanup();
  }
});

test('post-session flow does not auto-open the parking lot, and start-a-new-task leaves parking lot items intact', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'post-session-start-next');
    await exitCompactMode(page);
    await setTimeOffset(page, 6500);

    await page.getByRole('button', { name: 'Open Parking Lot' }).click();
    const thoughtInput = page.getByPlaceholder('Capture a thought... (Enter to add)');
    await thoughtInput.fill('turn this into the next task');
    await page.getByRole('button', { name: 'Add Note' }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('button', { name: 'End Session' }).click();
    await expectPostSessionPrompt(page, 'post-session-start-next');

    await expect(page.getByRole('heading', { name: 'These came up while you were in the zone' })).toHaveCount(0);
    await page.getByTestId('post-session-new-task').click();
    await page.getByRole('button', { name: 'Mark complete' }).click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('');

    await page.getByRole('button', { name: 'Open Parking Lot' }).click();
    await expect(page.locator('p.line-clamp-2.break-words').filter({ hasText: 'turn this into the next task' })).toBeVisible();

    const storedThoughts = await page.evaluate(() => window.electronAPI.storeGet('thoughts'));
    expect(storedThoughts.some((thought) => thought?.text === 'turn this into the next task')).toBe(true);
  } finally {
    await cleanup();
  }
});

test('timer catches up after renderer blocking instead of drifting by one tick', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('timer-catch-up');
    await page.locator(TASK_INPUT_SELECTOR).press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();

    await page.waitForTimeout(1100);
    const beforeSeconds = await readDisplayedTimerSeconds(page);
    expect(beforeSeconds).not.toBeNull();

    await page.evaluate(() => {
      const start = Date.now();
      while (Date.now() - start < 2400) {
        // Intentionally block the renderer thread to simulate throttling/stall.
      }
    });

    await page.waitForTimeout(400);
    const afterSeconds = await readDisplayedTimerSeconds(page);
    expect(afterSeconds).not.toBeNull();
    expect(afterSeconds).toBeGreaterThanOrEqual(beforeSeconds + 2);
  } finally {
    await cleanup();
  }
});

test('hour-plus timers stay visibly active in compact, full, and floating views', async () => {
  const { electronApp, page, cleanup } = await launchApp({
    background: false,
    seedConfig: {
      settings: {
        checkInEnabled: false,
      },
    },
  });

  try {
    await installTimeOffsetControl(page);
    await startFreeflowSession(page, 'hour-plus-display');

    await setTimeOffset(page, 3600000);
    await page.waitForTimeout(1200);

    const compactTimer = page.locator('.pill-timer').first();
    await expect(compactTimer).toHaveText(/\d+:\d{2}:\d{2}/);
    const compactBefore = parseTimerTextToSeconds((await compactTimer.textContent())?.trim() || '');
    await page.waitForTimeout(1100);
    const compactAfter = parseTimerTextToSeconds((await compactTimer.textContent())?.trim() || '');
    expect(compactBefore).not.toBeNull();
    expect(compactAfter).not.toBeNull();
    expect(compactAfter).toBeGreaterThan(compactBefore);

    await exitCompactMode(page);
    const fullTimer = page.locator('.focus-hero__clock').first();
    await expect(fullTimer).toHaveText(/\d+:\d{2}:\d{2}/);
    const fullBefore = parseTimerTextToSeconds((await fullTimer.textContent())?.trim() || '');
    await page.waitForTimeout(1100);
    const fullAfter = parseTimerTextToSeconds((await fullTimer.textContent())?.trim() || '');
    expect(fullBefore).not.toBeNull();
    expect(fullAfter).not.toBeNull();
    expect(fullAfter).toBeGreaterThan(fullBefore);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });
    const floatingWindow = await waitForFloatingWindow(electronApp);
    const floatingLabel = floatingWindow.locator('#timer-label');
    await expect(floatingLabel).toHaveText(/\d+:\d{2}:\d{2}/);
    const floatingBefore = parseTimerTextToSeconds((await floatingLabel.textContent())?.trim() || '');
    await floatingWindow.waitForTimeout(1100);
    const floatingAfter = parseTimerTextToSeconds((await floatingLabel.textContent())?.trim() || '');
    expect(floatingBefore).not.toBeNull();
    expect(floatingAfter).not.toBeNull();
    expect(floatingAfter).toBeGreaterThan(floatingBefore);
  } finally {
    await cleanup();
  }
});

test('editing a parking lot note preserves completion state', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await page.getByRole('button', { name: 'Open Parking Lot' }).click();

    const thoughtInput = page.getByPlaceholder('Capture a thought... (Enter to add)');
    await thoughtInput.fill('stateful thought');
    await page.getByRole('button', { name: 'Add Note' }).click();

    await page.locator('.checkbox').first().click();
    await expect(page.getByRole('button', { name: 'Copy Selected' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Edit Note' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start This Task' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Note' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Note' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Note' })).toBeVisible();
    await page.getByPlaceholder('Edit your note...').fill('updated thought');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('updated thought')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Selected' })).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('parking lot destructive actions require confirmation and Start This Task keeps the note', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await page.getByRole('button', { name: 'Open Parking Lot' }).click();

    const thoughtInput = page.getByPlaceholder('Capture a thought... (Enter to add)');
    await thoughtInput.fill('delete me');
    await page.getByRole('button', { name: 'Add Note' }).click();
    await thoughtInput.fill('clear me');
    await page.getByRole('button', { name: 'Add Note' }).click();
    await thoughtInput.fill('startable note');
    await page.getByRole('button', { name: 'Add Note' }).click();

    await page.getByText('delete me').click();
    await expect(page.getByRole('heading', { name: 'Edit Note' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Delete note?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).last().click();
    await expect(page.getByPlaceholder('Edit your note...')).toHaveValue('delete me');

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Delete note?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Note' }).last().click();
    await expect(page.getByText('delete me')).toHaveCount(0);

    await expect(page.locator('.checkbox')).toHaveCount(2);
    await page.locator('.checkbox').nth(1).click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByRole('heading', { name: 'Delete note?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Notes' }).click();
    await expect(page.getByText('clear me')).toHaveCount(0);

    await page.getByRole('button', { name: 'Start This Task' }).click();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('startable note');
    await expect(page.getByRole('button', { name: 'Freeflow' })).toBeVisible();

    await page.getByRole('button', { name: 'Open Parking Lot' }).click();
    await expect(page.locator('p.line-clamp-2.break-words').filter({ hasText: 'startable note' })).toBeVisible();

    const storedThoughts = await page.evaluate(() => window.electronAPI.storeGet('thoughts'));
    expect(storedThoughts.some((thought) => thought?.text === 'startable note')).toBe(true);
  } finally {
    await cleanup();
  }
});

test('system sleep pauses an active session without counting slept time', async () => {
  const { electronApp, page, cleanup } = await launchApp();

  try {
    await startFreeflowSession(page, 'sleep-pauses-session');
    await page.waitForTimeout(1400);

    const beforeSuspend = await readDisplayedTimerSeconds(page);
    expect(beforeSuspend).not.toBeNull();

    const staleRunningSnapshot = await page.evaluate(async () => {
      const [currentTask, timerState] = await Promise.all([
        window.electronAPI.storeGet('currentTask'),
        window.electronAPI.storeGet('timerState'),
      ]);
      return { currentTask, timerState };
    });

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('suspend');
    });

    await page.evaluate(async (snapshot) => {
      await window.electronAPI.storeSet('currentTask', snapshot.currentTask);
      await window.electronAPI.storeSet('timerState', snapshot.timerState);
    }, staleRunningSnapshot);

    await electronApp.evaluate(({ powerMonitor }) => {
      powerMonitor.emit('resume');
    });

    await expect(page.getByText('Session paused while your Mac slept')).toBeVisible();
    await expect.poll(async () => {
      const timerState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
      return JSON.stringify({
        isRunning: Boolean(timerState?.isRunning),
        hasSessionStartedAt: Boolean(timerState?.sessionStartedAt),
      });
    }).toBe(JSON.stringify({ isRunning: false, hasSessionStartedAt: false }));

    const afterSuspend = await readDisplayedTimerSeconds(page);
    expect(afterSuspend).not.toBeNull();
    expect(afterSuspend).toBeGreaterThanOrEqual(beforeSuspend);

    await page.waitForTimeout(1400);
    const afterWait = await readDisplayedTimerSeconds(page);
    expect(afterWait).toBe(afterSuspend);
  } finally {
    await cleanup();
  }
});

test('minimize to floating icon restores idle task text', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    let mainPage = page;
    const taskInput = mainPage.locator(TASK_INPUT_SELECTOR);
    const minimizeFloatingButton = mainPage.locator('button[aria-label="Minimize to Floating"]');
    await taskInput.fill('floating-state-test');
    await expect(taskInput).toHaveValue('floating-state-test');

    await expect(minimizeFloatingButton).toBeVisible();

    await mainPage.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await waitForFloatingWindow(electronApp);
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();
    await floatingWindow.evaluate(() => window.floatingAPI.expand());

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));

    const resolvedMainWindow = electronApp.windows().find((win) => isMainAppWindow(win));
    expect(resolvedMainWindow).toBeTruthy();
    mainPage = resolvedMainWindow;

    const restoredTask = await mainPage.evaluate(async () => {
      const taskState = await window.electronAPI.storeGet('currentTask');
      return taskState?.text || '';
    });
    expect(restoredTask).toBe('floating-state-test');
    await expect(mainPage.locator(TASK_INPUT_SELECTOR)).toHaveValue('floating-state-test');
  } finally {
    await cleanup();
  }
});

test('manual re-entry into floating minimize snaps back to the nearest corner', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'floating-manual-position');
    await exitCompactMode(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(
      () => electronApp.windows().filter((win) => win.url().includes('floating-icon.html')).length,
      { timeout: 7000 },
    ).toBeGreaterThan(0);

    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();

    const baseFloatingBounds = await readFloatingWindowBounds(electronApp);
    expect(baseFloatingBounds).toBeTruthy();

    await floatingWindow.evaluate(() => {
      window.floatingAPI.dragStart();
      window.floatingAPI.dragMove(-170, 120);
      window.floatingAPI.dragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readFloatingWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }).not.toBe(JSON.stringify({
      x: baseFloatingBounds.x,
      y: baseFloatingBounds.y,
    }));

    const movedFloatingBounds = await readFloatingWindowBounds(electronApp);
    expect(movedFloatingBounds).toBeTruthy();

    await floatingWindow.evaluate(() => window.floatingAPI.expand());
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));

    const mainPage = electronApp.windows().find((win) => isMainAppWindow(win));
    expect(mainPage).toBeTruthy();

    await mainPage.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(
      () => electronApp.windows().filter((win) => win.url().includes('floating-icon.html')).length,
      { timeout: 7000 },
    ).toBeGreaterThan(0);
    await expect.poll(() => floatingWindowMatchesNearestCorner(electronApp), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('floating drag can clamp flush to the left work area edge', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'floating-left-edge');
    await exitCompactMode(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    const floatingWindow = await waitForFloatingWindow(electronApp);

    await floatingWindow.evaluate(() => {
      window.floatingAPI.dragStart();
      window.floatingAPI.dragMove(-4000, 0);
      window.floatingAPI.dragEnd();
    });

    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow, screen }) => {
      const floating = BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes('floating-icon.html'));
      if (!floating) return false;
      const bounds = floating.getBounds();
      const workArea = screen.getDisplayMatching(bounds).workArea;
      return Math.abs(bounds.x - workArea.x) <= 2;
    }), { timeout: 7000 }).toBe(true);
  } finally {
    await cleanup();
  }
});

test('expanding from a moved floating minimize restores the main window at the floating position', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await startFreeflowSession(page, 'floating-expand-handoff');
    await exitCompactMode(page);

    await page.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));

    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();

    const baseFloatingBounds = await readFloatingWindowBounds(electronApp);
    expect(baseFloatingBounds).toBeTruthy();

    await floatingWindow.evaluate(() => {
      window.floatingAPI.dragStart();
      window.floatingAPI.dragMove(-160, 115);
      window.floatingAPI.dragEnd();
    });

    await expect.poll(async () => {
      const nextBounds = await readFloatingWindowBounds(electronApp);
      return JSON.stringify({
        x: nextBounds?.x || 0,
        y: nextBounds?.y || 0,
      });
    }).not.toBe(JSON.stringify({
      x: baseFloatingBounds.x,
      y: baseFloatingBounds.y,
    }));

    const movedFloatingBounds = await readFloatingWindowBounds(electronApp);
    expect(movedFloatingBounds).toBeTruthy();

    await floatingWindow.evaluate(() => window.floatingAPI.expand());

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect.poll(
      () => mainWindowMatchesFloatingRestorePosition(electronApp, movedFloatingBounds),
      { timeout: 7000 },
    ).toBe(true);
  } finally {
    await cleanup();
  }
});

test('exiting compact mode preserves the settled full-window height for multi-line tasks', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('First line\nSecond line that keeps the textarea tall');

    const getMainHeight = async () => electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => (
        !win.webContents.getURL().includes('floating-icon.html')
      ));
      return main ? main.getBounds().height : null;
    });

    await expect.poll(getMainHeight, { timeout: 7000 }).toBeLessThan(400);

    const initialHeight = await getMainHeight();
    expect(initialHeight).toBeGreaterThan(120);

    await page.locator('button[aria-label="Enter Compact Mode"]').click();
    await expect.poll(() => readWindowMode(page)).toBe('pill');
    await exitCompactMode(page);

    await expect.poll(getMainHeight, { timeout: 7000 }).toBeGreaterThanOrEqual(initialHeight);
  } finally {
    await cleanup();
  }
});
