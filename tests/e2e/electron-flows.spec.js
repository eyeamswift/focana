const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const APP_VERSION = JSON.parse(
  fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')
).version;
const TASK_INPUT_SELECTOR = 'textarea[placeholder*="Type your task here"]';

function buildSeedConfig(seedConfig = null) {
  return {
    userEmail: 'justin.franklin90@gmail.com',
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

function parseTimerTextToSeconds(timerText) {
  if (typeof timerText !== 'string') return null;
  const hourMatch = timerText.match(/^(\d+)h (\d{2})m$/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    const minutes = Number(hourMatch[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 3600) + (minutes * 60);
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
      .filter((text) => /^\d{2}:\d{2}$/.test(text) || /^\d+h \d{2}m$/.test(text));
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

async function readWindowVisibilityState(electronApp) {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows();
    const main = windows.find((win) => !win.webContents.getURL().includes('floating-icon.html'));
    const floating = windows.find((win) => win.webContents.getURL().includes('floating-icon.html'));
    return {
      mainVisible: Boolean(main && main.isVisible()),
      floatingVisible: Boolean(floating && floating.isVisible()),
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

async function readWindowMode(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-window-mode'));
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
  const minutesInput = page.locator('input[type="number"]').first();
  await minutesInput.fill(String(minutes));
  await minutesInput.press('Enter');
  await expect.poll(() => readWindowMode(page)).toBe('pill');
}

async function exitCompactMode(page) {
  await page.locator('.pill').dblclick();
  await expect.poll(() => readWindowMode(page)).toBe('full');
}

test('first launch shows one-time email capture gate before app UI', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      userEmail: '',
      emailPromptSkipped: false,
    },
    waitForTaskInput: false,
  });

  try {
    await expect(page.getByText('Welcome to Focana 🎯')).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveCount(0);
    await expect(page.locator('button[aria-label="Open Settings"]')).toHaveCount(0);

    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeDisabled();

    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.fill('not-an-email');
    await expect(continueBtn).toBeDisabled();

    await emailInput.fill('person@example.com');
    await expect(continueBtn).toBeEnabled();
    await emailInput.press('Enter');

    await expect(page.getByText('Welcome to Focana 🎯')).toHaveCount(0);
    await page.waitForSelector(TASK_INPUT_SELECTOR);

    const savedEmail = await page.evaluate(() => window.electronAPI.storeGet('userEmail'));
    const skipped = await page.evaluate(() => window.electronAPI.storeGet('emailPromptSkipped'));
    expect(savedEmail).toBe('person@example.com');
    expect(skipped).toBe(false);
  } finally {
    await cleanup();
  }
});

test('email capture gate cannot be skipped and remains until email is provided', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      userEmail: '',
      emailPromptSkipped: false,
    },
    waitForTaskInput: false,
  });

  try {
    await expect(page.getByText('Welcome to Focana 🎯')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('Welcome to Focana 🎯')).toBeVisible();
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('saved user email bypasses capture gate on launch', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      userEmail: 'existing@example.com',
      emailPromptSkipped: false,
    },
  });

  try {
    await expect(page.getByText('Welcome to Focana 🎯')).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('theme is restored from electron-store and theme changes persist back to the store', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        theme: 'dark',
        themeManual: true,
      },
    },
  });

  try {
    await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

    await page.getByRole('button', { name: 'Toggle Theme' }).click();

    await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    await expect.poll(async () => page.evaluate(() => window.electronAPI.storeGet('settings.theme'))).toBe('light');
    await expect.poll(async () => page.evaluate(() => window.electronAPI.storeGet('settings.themeManual'))).toBe(true);
  } finally {
    await cleanup();
  }
});

test('theme and always-on-top survive relaunch', async () => {
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

    await firstLaunch.page.getByRole('button', { name: 'Toggle Theme' }).click();
    await firstLaunch.page.getByRole('button', { name: 'Disable Always on Top' }).click();

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

test('timed time-up flows keep going and resume later without losing task state', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'timeup-audit', 1);

    await setTimeOffset(page, 65000);
    await expect(page.getByRole('heading', { name: 'Time is up' })).toBeVisible();

    await page.getByRole('button', { name: 'Keep Going' }).click();

    await expect.poll(() => readWindowMode(page)).toBe('pill');
    const keepGoingState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
    expect(keepGoingState.initialTime).toBe(360);
    expect(keepGoingState.isRunning).toBe(true);
    expect(keepGoingState.seconds).toBeGreaterThanOrEqual(299);
    expect(keepGoingState.seconds).toBeLessThanOrEqual(300);

    await setTimeOffset(page, 365000);
    await expect(page.getByRole('heading', { name: 'Time is up' })).toBeVisible();

    await page.getByRole('button', { name: 'Resume Later' }).click();
    await expect(page.getByRole('heading', { name: 'Where did you leave off?' })).toBeVisible();
    await page.getByPlaceholder('Quick note about where to pick up next time...').fill('resume later note');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('timeup-audit');
    const finalTimerState = await page.evaluate(() => window.electronAPI.storeGet('timerState'));
    expect(finalTimerState.isRunning).toBe(false);
    expect(finalTimerState.seconds).toBe(0);
    expect(finalTimerState.initialTime).toBe(0);

    const savedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(savedSessions[0].task).toBe('timeup-audit');
    expect(savedSessions[0].durationMinutes).toBe(6);
    expect(savedSessions[0].completed).toBe(false);
    expect(savedSessions[0].notes).toBe('resume later note');
  } finally {
    await cleanup();
  }
});

test('time-up end session opens the completion decision before showing the feedback prompt', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'feedback-auto-advance', 1);

    await setTimeOffset(page, 65000);
    await expect(page.getByRole('heading', { name: 'Time is up' })).toBeVisible();

    await page.getByRole('button', { name: 'End Session' }).click();

    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toBeVisible();
    await expect(page.getByText('How was Focana this session?')).toHaveCount(0);

    await page.getByRole('button', { name: 'Yes, Complete' }).click();

    const feedbackPrompt = page.getByText('How was Focana this session?');
    await expect(feedbackPrompt).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close feedback prompt' })).toBeVisible();

    await page.waitForTimeout(2200);
    await expect(feedbackPrompt).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toBeVisible();

    await page.waitForTimeout(1400);
    await expect(feedbackPrompt).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('selecting session feedback saves it and continues after the short post-click delay', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await installTimeOffsetControl(page);
    await startTimedSession(page, 'feedback-select', 1);

    await setTimeOffset(page, 65000);
    await expect(page.getByRole('heading', { name: 'Time is up' })).toBeVisible();

    await page.getByRole('button', { name: 'End Session' }).click();
    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Complete' }).click();

    const feedbackPrompt = page.getByText('How was Focana this session?');
    await expect(feedbackPrompt).toBeVisible();

    await page.getByRole('button', { name: 'Thumbs up' }).click();

    await expect.poll(async () => {
      const queue = await page.evaluate(() => window.electronAPI.storeGet('feedbackQueue'));
      return Array.isArray(queue) ? queue.length : 0;
    }).toBe(1);

    const queue = await page.evaluate(() => window.electronAPI.storeGet('feedbackQueue'));
    expect(queue[0].feedback).toBe('up');
    expect(queue[0].surface).toBe('stop_yes_complete');
    expect(queue[0].completionType).toBe('completed');

    await expect.poll(async () => {
      const sessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
      return sessions?.[0]?.sessionFeedback || null;
    }).toBe('up');

    await page.waitForTimeout(100);
    await expect(feedbackPrompt).toBeVisible();

    await expect(feedbackPrompt).toHaveCount(0, { timeout: 1500 });
    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toHaveCount(0);
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
    await startFreeflowSession(page, 'feedback-sync-attempt');
    await page.waitForTimeout(1200);
    await page.locator('.pill').click();
    await page.locator('button[title="Stop & Save"]').click();

    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toBeVisible();
    await page.getByRole('button', { name: 'No, Keep Task' }).click();

    const feedbackPrompt = page.getByText('How was Focana this session?');
    await expect(feedbackPrompt).toBeVisible();
    await page.getByRole('button', { name: 'Thumbs down' }).click();

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

    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();

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

    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();

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
    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('compact controls auto-hide restore the pill width and drag anchor', async () => {
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
    }).toBeGreaterThan(baseBounds.width);

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

test('always-on-top toggle persists and applies to floating icon mode', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'));
      return main ? main.isAlwaysOnTop() : null;
    })).toBe(true);

    await page.getByRole('button', { name: 'Disable Always on Top' }).click();

    await expect(page.getByRole('button', { name: 'Enable Always on Top' })).toBeVisible();
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

test('freeflow check-in exits compact mode and returns to compact after responding', async () => {
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

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('compact-checkin-return?')).toBeVisible();

    await page.getByRole('button', { name: 'Yes' }).click();

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('pill');
  } finally {
    await cleanup();
  }
});

test('freeflow check-in restores from floating minimize and returns there after detour dismiss', async () => {
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

    await setTimeOffset(page, 301000);

    await expect.poll(() => readWindowMode(page), { timeout: 7000 }).toBe('full');
    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: true, floatingVisible: false }));
    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('floating-checkin-return?')).toBeVisible();

    await page.getByRole('button', { name: 'No', exact: true }).click();
    await expect(page.getByText('What happened?')).toBeVisible();
    await page.getByRole('button', { name: 'Took a detour' }).click();
    await expect(page.getByRole('button', { name: 'Jot it down' })).toBeVisible();
    await page.locator('button[title="Dismiss"]').click();

    await expect.poll(async () => JSON.stringify(await readWindowVisibilityState(electronApp)), { timeout: 7000 })
      .toBe(JSON.stringify({ mainVisible: false, floatingVisible: true }));
  } finally {
    await cleanup();
  }
});

test('freeflow check-ins stay suppressed during DND and appear after DND is turned off', async () => {
  const { page, cleanup } = await launchApp({
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

    await exitCompactMode(page);
    await page.getByRole('button', { name: 'Turn Off Do Not Disturb' }).click();

    await expect(page.getByText('Still focused on')).toBeVisible();
    await expect(page.getByText('dnd-ui-checkin?')).toBeVisible();
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
    })).toBeLessThanOrEqual(580);

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

test('shortcut recorder handles modifier and escape without lockup', async () => {
  const { page, cleanup } = await launchApp();
  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('tab', { name: 'Shortcuts' }).click();

    const row = page.getByRole('button', { name: /Start\/Pause Timer/i }).first();
    await row.click();
    await expect(page.getByText('Press keys...')).toBeVisible();

    await page.keyboard.press('Shift');
    await expect(page.getByText('Press keys...')).toBeVisible();

    await page.keyboard.press('A');
    await expect(page.getByText('Use Cmd/Ctrl or Alt with another key')).toBeVisible();
    await expect(page.getByText('Press keys...')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText('Press keys...')).toHaveCount(0);

    const conflictCombo = await page.evaluate(() => (/Mac/i.test(navigator.platform) ? 'Meta+N' : 'Control+N'));
    await row.click();
    await expect(page.getByText('Press keys...')).toBeVisible();
    await page.keyboard.press(conflictCombo);
    await expect(page.getByText('Conflicts with New/Edit Task')).toBeVisible();
    const recordingStillActive = await page.getByText('Press keys...').count();
    if (recordingStillActive > 0) {
      await page.keyboard.press('Escape');
      await expect(page.getByText('Press keys...')).toHaveCount(0);
    }

    await row.click();
    await page.keyboard.press('Control+Shift+Y');
    await expect(page.getByText('Press keys...')).toHaveCount(0);

    await page.getByRole('button', { name: 'Save Settings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

test('missing toggle compact shortcut is auto-restored to default', async () => {
  const { page, cleanup } = await launchApp({
    seedConfig: {
      settings: {
        shortcutsEnabled: true,
        shortcuts: {
          startPause: 'CommandOrControl+Shift+S',
          newTask: 'CommandOrControl+N',
          completeTask: 'CommandOrControl+Enter',
          openParkingLot: 'CommandOrControl+Shift+P',
        },
      },
    },
  });

  try {
    await expect.poll(async () => {
      const saved = await page.evaluate(() => window.electronAPI.storeGet('settings.shortcuts'));
      return saved?.toggleCompact || '';
    }).toBe('CommandOrControl+Shift+I');

    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('tab', { name: 'Shortcuts' }).click();
    const toggleCompactRow = page.getByRole('button', { name: /Toggle Compact Mode/i }).first();
    await expect(toggleCompactRow).toContainText('⌘+⇧+I');
  } finally {
    await cleanup();
  }
});

test('closing settings while recording shortcuts does not leave keyboard lock', async () => {
  const { page, cleanup } = await launchApp();
  try {
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await page.getByRole('tab', { name: 'Shortcuts' }).click();

    const row = page.getByRole('button', { name: /Start\/Pause Timer/i }).first();
    await row.click();
    await expect(page.getByText('Press keys...')).toBeVisible();

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

    const minutesInput = page.locator('input[type="number"]').first();
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

    const minutesInput = page.locator('input[type="number"]').first();
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

test('stop flow is handled inside session notes without a second completion modal', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('stop-flow-unified');
    await page.locator(TASK_INPUT_SELECTOR).press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();
    await expect.poll(() => readWindowMode(page)).toBe('pill');
    await page.waitForTimeout(6500);
    await page.locator('.pill').click();
    await page.locator('button[title="Stop & Save"]').click();
    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yes, Complete' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'No, Keep Task' })).toBeVisible();

    await page.getByPlaceholder('Quick note about where to pick up next time...').fill('resume from here');
    await page.getByRole('button', { name: 'No, Keep Task' }).click();
    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('stop-flow-unified');

    const savedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(savedSessions[0].completed).toBe(false);
    expect(savedSessions[0].notes).toBe('resume from here');
  } finally {
    await cleanup();
  }
});

test('feedback prompt close button skips feedback and continues the stop flow action', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('feedback-close');
    await page.locator(TASK_INPUT_SELECTOR).press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();
    await expect.poll(() => readWindowMode(page)).toBe('pill');

    await page.waitForTimeout(6500);
    await page.locator('.pill').click();
    await page.locator('button[title="Stop & Save"]').click();

    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toBeVisible();
    await page.getByPlaceholder('Quick note about where to pick up next time...').fill('carry note');
    await page.getByRole('button', { name: 'No, Keep Task' }).click();

    const feedbackPrompt = page.getByText('How was Focana this session?');
    await expect(feedbackPrompt).toBeVisible();

    await page.getByRole('button', { name: 'Close feedback prompt' }).click();

    await expect(feedbackPrompt).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Did you finish?' })).toHaveCount(0);
    await expect(page.locator(TASK_INPUT_SELECTOR)).toHaveValue('feedback-close');

    await expect.poll(async () => {
      const sessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
      return Array.isArray(sessions) ? sessions.length : 0;
    }).toBe(1);

    const savedSessions = await page.evaluate(() => window.electronAPI.storeGet('sessions'));
    expect(savedSessions[0].completed).toBe(false);
    expect(savedSessions[0].notes).toBe('carry note');
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

test('minimize to floating icon restores idle task text', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    let mainPage = page;
    const taskInput = mainPage.locator(TASK_INPUT_SELECTOR);
    const minimizeFloatingButton = mainPage.locator('button[aria-label="Minimize to Floating Icon"]');
    await taskInput.fill('floating-state-test');

    await expect(minimizeFloatingButton).toBeVisible();

    await mainPage.evaluate(() => {
      window.electronAPI.toggleFloatingMinimize();
    });

    await expect.poll(() => {
      const windows = electronApp.windows();
      return windows.some((win) => win.url().includes('floating-icon.html'));
    }, { timeout: 7000 }).toBe(true);

    const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'));
    expect(floatingWindow).toBeTruthy();
    await floatingWindow.evaluate(() => window.floatingAPI.expand());

    await expect.poll(async () => electronApp.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows().map((win) => ({
        url: win.webContents.getURL(),
        visible: win.isVisible(),
      }));
      const main = windows.find((win) => (
        win.url.includes('localhost:5173')
        || (win.url.includes('/index.html') && !win.url.includes('floating-icon.html'))
      ));
      return main ? main.visible : false;
    }), { timeout: 7000 }).toBe(true);

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

test('exiting compact mode preserves full-window height for multi-line tasks', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    await page.locator(TASK_INPUT_SELECTOR).fill('First line\nSecond line that keeps the textarea tall');

    const getMainHeight = async () => electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => (
        !win.webContents.getURL().includes('floating-icon.html')
      ));
      return main ? main.getBounds().height : null;
    });

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
