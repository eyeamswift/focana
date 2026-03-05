const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const TASK_INPUT_SELECTOR = 'textarea[placeholder*="Type your task here"]';

async function launchApp({ seedConfig = null } = {}) {
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
      FOCANA_E2E_BACKGROUND: '1',
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

    const taskInput = page.locator(TASK_INPUT_SELECTOR);
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
