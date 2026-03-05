const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const TASK_INPUT_SELECTOR = 'textarea[placeholder*="Type your task here"]';

async function launchApp({ seedConfig = null, background = true } = {}) {
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focana-e2e-'));
  if (seedConfig) {
    fs.writeFileSync(
      path.join(storeDir, 'config.json'),
      JSON.stringify(seedConfig, null, 2),
      'utf8'
    );
  }

  const electronApp = await electron.launch({
    cwd: APP_ROOT,
    args: ['.'],
    env: {
      ...process.env,
      FOCANA_E2E: '1',
      FOCANA_E2E_BACKGROUND: background ? '1' : '0',
      FOCANA_STORE_CWD: storeDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
  });

  const page = await electronApp.firstWindow();
  await page.waitForSelector(TASK_INPUT_SELECTOR);

  return {
    electronApp,
    page,
    async cleanup() {
      try {
        await electronApp.close();
      } finally {
        fs.rmSync(storeDir, { recursive: true, force: true });
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
  const match = timerText.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return (minutes * 60) + seconds;
}

async function readDisplayedTimerSeconds(page) {
  const timerText = await page.evaluate(() => {
    const allText = Array.from(document.querySelectorAll('div, span'))
      .map((el) => (el.textContent || '').trim())
      .filter((text) => /^\d{2}:\d{2}$/.test(text));
    return allText.length > 0 ? allText[0] : null;
  });

  return parseTimerTextToSeconds(timerText);
}

function isMainAppWindow(win) {
  const url = win.url();
  return url.includes('localhost:5173') || (url.includes('/index.html') && !url.includes('floating-icon.html'));
}

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

test('reusing a task from history does not overwrite historical session id', async () => {
  const originalCreatedAt = new Date('2026-01-01T12:00:00.000Z').toISOString();
  const seedSession = {
    id: 'hist-1',
    task: 'History seed task',
    durationMinutes: 22,
    mode: 'freeflow',
    completed: true,
    notes: 'seed note',
    createdAt: originalCreatedAt,
  };

  const { page, cleanup } = await launchApp();

  try {
    await page.evaluate(async (session) => {
      await window.electronAPI.storeSet('sessions', [session]);
    }, seedSession);
    await page.reload();
    await page.waitForSelector(TASK_INPUT_SELECTOR);

    await page.getByRole('button', { name: 'Open Session History' }).click();
    await page.getByRole('button', { name: 'Completed' }).click();
    await expect(page.getByText('History seed task')).toBeVisible();
    await page.getByRole('button', { name: 'Use This Task' }).first().click();

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

    await page.keyboard.press('Escape');
    await expect(page.getByText('Press keys...')).toHaveCount(0);

    await row.click();
    await page.keyboard.press('Control+Shift+Y');
    await expect(page.getByText('Press keys...')).toHaveCount(0);

    await page.getByRole('button', { name: 'Save Settings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);
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

test('timed start clamps invalid minute input to safe range', async () => {
  const { page, cleanup } = await launchApp();

  try {
    const taskInput = page.locator(TASK_INPUT_SELECTOR);
    await taskInput.fill('Timed clamp task');
    await taskInput.press('Enter');

    const minutesInput = page.locator('input[type="number"]').first();
    await minutesInput.fill('-5');
    await page.getByRole('button', { name: 'Set Timer' }).click();

    await expect(page.getByText(/0[01]:[0-5][0-9]/)).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: 'Time is up' })).toHaveCount(0);
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

test('editing a parking lot note preserves completion state', async () => {
  const { page, cleanup } = await launchApp();

  try {
    await page.getByRole('button', { name: 'Open Parking Lot' }).click();

    const thoughtInput = page.getByPlaceholder('Capture a thought... (Enter to add)');
    await thoughtInput.fill('stateful thought');
    await page.getByRole('button', { name: 'Add Note' }).click();

    await page.locator('.checkbox').first().click();
    await expect(page.getByRole('button', { name: 'Copy Selected' })).toBeVisible();

    await page.getByText('stateful thought').click();
    await expect(page.getByRole('heading', { name: 'Edit Note' })).toBeVisible();
    await page.getByPlaceholder('Edit your note...').fill('updated thought');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('updated thought')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Selected' })).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('minimize to floating icon restores task and keeps timer progressing', async () => {
  const { electronApp, page, cleanup } = await launchApp({ background: false });

  try {
    let mainPage = page;
    const taskInput = mainPage.locator(TASK_INPUT_SELECTOR);
    const minimizeFloatingButton = mainPage.locator('button[aria-label="Minimize to Floating Icon"]');
    await taskInput.fill('floating-state-test');
    await taskInput.press('Enter');
    await page.getByRole('button', { name: 'Freeflow' }).click();

    await expect(minimizeFloatingButton).toBeVisible();
    await mainPage.waitForTimeout(2200);

    const beforeSeconds = await readDisplayedTimerSeconds(mainPage);
    expect(beforeSeconds).not.toBeNull();

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
    await mainPage.waitForTimeout(1200);

    const afterSeconds = await readDisplayedTimerSeconds(mainPage);
    expect(afterSeconds).not.toBeNull();
    expect(afterSeconds).toBeGreaterThan(beforeSeconds);
  } finally {
    await cleanup();
  }
});
