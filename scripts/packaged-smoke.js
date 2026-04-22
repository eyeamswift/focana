#!/usr/bin/env node
const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('@playwright/test')

const TASK_INPUT_SELECTOR = '[data-testid="task-input"]'
const RUNNING_TASK_SELECTOR = '.focus-hero__task'
const PILL_TASK_SELECTOR = '.pill-content > .pill-task .pill-task-text'
const ACTIVATION_HEADING = 'Activate Focana on this Mac'
const NAME_GATE_HEADING = 'One more thing. What should we call you?'
const DEFAULT_LICENSE_KEY = process.env.FOCANA_SMOKE_LICENSE_KEY || 'password'
const STOP_BUTTON_SELECTOR = [
  'button[aria-label="End Session"]',
  'button[aria-label="Stop and Save Session"]',
  'button[title="Stop & Save Session"]',
  'button[title="Stop & Save"]',
].join(', ')

function parseArgs(argv) {
  const parsed = {}
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      parsed[key] = true
      continue
    }
    parsed[key] = value
    index += 1
  }
  return parsed
}

function fail(message) {
  throw new Error(message)
}

function info(message) {
  process.stdout.write(`[packaged-smoke] ${message}\n`)
}

function createStoreDir() {
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focana-packaged-smoke-'))
  fs.writeFileSync(path.join(storeDir, 'config.json'), JSON.stringify({
    userEmail: 'packaged-smoke@focana.local',
    preferredName: '',
    emailPromptSkipped: true,
    settings: {
      checkInEnabled: false,
    },
  }, null, 2))
  return storeDir
}

function getExecutablePath(appBundlePath) {
  if (!appBundlePath.endsWith('.app')) {
    fail(`Expected an .app bundle path, received: ${appBundlePath}`)
  }
  const appName = path.basename(appBundlePath, '.app')
  return path.join(appBundlePath, 'Contents', 'MacOS', appName)
}

async function poll(check, {
  timeoutMs = 15000,
  intervalMs = 250,
  description = 'condition',
} = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await check()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  fail(`Timed out waiting for ${description}`)
}

async function readWindowMode(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-window-mode'))
}

async function readDisplayedTaskText(page) {
  const runningTask = page.locator(RUNNING_TASK_SELECTOR).first()
  if (await runningTask.isVisible().catch(() => false)) {
    return ((await runningTask.textContent().catch(() => '')) || '').trim()
  }

  const pillTask = page.locator(PILL_TASK_SELECTOR).first()
  if (await pillTask.isVisible().catch(() => false)) {
    return ((await pillTask.textContent().catch(() => '')) || '').trim()
  }

  const taskInput = page.locator(TASK_INPUT_SELECTOR).first()
  if (await taskInput.isVisible().catch(() => false)) {
    return ((await taskInput.inputValue().catch(() => '')) || '').trim()
  }

  return ''
}

async function readFloatingWindowBounds(electronApp) {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const floating = BrowserWindow.getAllWindows().find((win) => win.webContents.getURL().includes('floating-icon.html'))
    return floating ? floating.getBounds() : null
  })
}

async function expectPostSessionPrompt(page, taskName = null) {
  await page.getByRole('region', { name: 'Session Wrap' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('post-session-eyebrow').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('post-session-heading').filter({ hasText: 'Nice work.' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('post-session-primary').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('post-session-break').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('post-session-new-task').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('post-session-done').waitFor({ state: 'visible', timeout: 10000 })
  if (taskName) {
    await page.getByTestId('post-session-body').filter({ hasText: taskName }).waitFor({ state: 'visible', timeout: 10000 })
  }
}

async function installTimeOffsetControl(page) {
  await page.evaluate(() => {
    if (!window.__focanaSmokeOriginalDateNow) {
      window.__focanaSmokeOriginalDateNow = Date.now.bind(Date)
    }
    window.__focanaSmokeOffsetMs = 0
    Date.now = () => window.__focanaSmokeOriginalDateNow() + (window.__focanaSmokeOffsetMs || 0)
  })
}

async function setTimeOffset(page, offsetMs) {
  await page.evaluate((nextOffsetMs) => {
    window.__focanaSmokeOffsetMs = Number(nextOffsetMs) || 0
  }, offsetMs)
}

async function ensureStartupReady(page, licenseKey) {
  const taskInput = page.locator(TASK_INPUT_SELECTOR).first()

  await poll(async () => {
    if (await taskInput.isVisible().catch(() => false)) {
      return true
    }

    const activationHeading = page.getByRole('heading', { name: ACTIVATION_HEADING })
    if (await activationHeading.isVisible().catch(() => false)) {
      info('Activation gate visible, using packaged smoke license flow')
      await page.getByPlaceholder('Paste your Focana license key').fill(licenseKey)
      await page.getByRole('button', { name: 'Submit' }).click()
      return false
    }

    const nameHeading = page.getByRole('heading', { name: NAME_GATE_HEADING })
    if (await nameHeading.isVisible().catch(() => false)) {
      info('Name gate visible, completing first-run identity step')
      await page.getByPlaceholder('Your name').fill('Packaged Smoke')
      await page.getByRole('button', { name: 'Continue' }).click()
      return false
    }

    return false
  }, {
    timeoutMs: 45000,
    description: 'packaged app startup gates to complete',
  })
}

async function runFreeflowSmoke(page, electronApp) {
  const taskName = 'Packaged smoke task'
  const taskInput = page.locator(TASK_INPUT_SELECTOR).first()

  info('Starting freeflow session')
  await taskInput.fill(taskName)
  await taskInput.press('Enter')
  await page.getByRole('button', { name: 'Freeflow' }).click()

  await poll(async () => (await readWindowMode(page)) === 'pill', {
    timeoutMs: 10000,
    description: 'compact mode after freeflow start',
  })

  await poll(async () => (await readDisplayedTaskText(page)).includes(taskName), {
    timeoutMs: 10000,
    description: 'task to appear in the compact running view',
  })

  info('Returning from compact to full window')
  await page.locator('.pill').dblclick()
  await poll(async () => (await readWindowMode(page)) === 'full', {
    timeoutMs: 10000,
    description: 'full mode after compact exit',
  })

  info('Checking floating minimize and expand')
  await page.locator('button[aria-label="Minimize to Floating"]').click()
  await poll(async () => {
    const windows = electronApp.windows().filter((win) => win.url().includes('floating-icon.html'))
    return windows.length > 0 ? windows[0] : null
  }, {
    timeoutMs: 10000,
    description: 'floating window to appear',
  })

  const floatingWindow = electronApp.windows().find((win) => win.url().includes('floating-icon.html'))
  if (!floatingWindow) fail('Floating window did not open')

  const baseBounds = await readFloatingWindowBounds(electronApp)
  if (!baseBounds) fail('Could not read initial floating bounds')

  await floatingWindow.evaluate(() => {
    window.floatingAPI.dragStart()
    window.floatingAPI.dragMove(-90, 70)
    window.floatingAPI.dragEnd()
  })

  await poll(async () => {
    const nextBounds = await readFloatingWindowBounds(electronApp)
    return nextBounds && (nextBounds.x !== baseBounds.x || nextBounds.y !== baseBounds.y)
  }, {
    timeoutMs: 10000,
    description: 'floating window position to change',
  })

  await floatingWindow.evaluate(() => window.floatingAPI.expand())

  await poll(async () => {
    const mainVisible = await electronApp.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((win) => !win.webContents.getURL().includes('floating-icon.html'))
      return Boolean(main && main.isVisible())
    })
    return mainVisible
  }, {
    timeoutMs: 10000,
    description: 'main window to reappear after floating expand',
  })

  await poll(async () => {
    const currentTask = await readDisplayedTaskText(page)
    return currentTask.includes(taskName)
  }, {
    timeoutMs: 10000,
    description: 'task text to survive floating round-trip',
  })

  info('Stopping session and verifying Session Wrap plus save-for-later notes handoff')
  await page.locator(STOP_BUTTON_SELECTOR).first().click()
  await expectPostSessionPrompt(page, taskName)

  await page.getByTestId('post-session-new-task').click()
  await page.getByRole('heading', { name: 'Start a new task' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: 'Save for later' }).click()
  await page.getByRole('heading', { name: `Save “${taskName}” for later` }).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('textarea[name="next-steps"]').fill('Restart with the packaging follow-up')
  await page.locator('textarea[name="recap"]').fill('Dragged floating bubble, returned to full view, and saved for later')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await taskInput.waitFor({ state: 'visible', timeout: 10000 })
  await poll(async () => (await taskInput.inputValue().catch(() => '')) === '', {
    timeoutMs: 10000,
    description: 'clean composer after save-for-later handoff',
  })
  await page.getByRole('button', { name: 'Open Parking Lot' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: 'Open Session History' }).waitFor({ state: 'visible', timeout: 10000 })

  await page.locator('button[aria-label="Open Session History"]').click()
  const historyDialog = page.locator('.dialog-content').filter({ hasText: 'Session History' }).first()
  await historyDialog.waitFor({ state: 'visible', timeout: 10000 })
  await historyDialog.getByText(taskName, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.dialog-close-btn').first().click()
}

async function runTimedSmoke(page) {
  info('Starting timed session and forcing Session Wrap expiry handoff')
  const taskInput = page.locator(TASK_INPUT_SELECTOR).first()
  const taskName = 'Packaged timed smoke task'
  await taskInput.fill(taskName)
  await taskInput.press('Enter')

  const minutesInput = page.locator('input[type="number"]').first()
  await minutesInput.fill('1')
  await minutesInput.press('Enter')

  await poll(async () => {
    const mode = await readWindowMode(page)
    return mode === 'pill' || mode === 'full'
  }, {
    timeoutMs: 10000,
    description: 'running shell after timed start',
  })

  await setTimeOffset(page, 65000)
  await expectPostSessionPrompt(page, taskName)
  await page.getByTestId('post-session-primary').click()
  await page.getByRole('heading', { name: `Keep working on ${taskName}.` }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('post-session-keep-working-minutes').fill('6')
  await page.getByTestId('post-session-keep-working-minutes').press('Enter')

  await poll(async () => {
    const mode = await readWindowMode(page)
    const timerState = await page.evaluate(() => window.electronAPI.storeGet('timerState'))
    return (mode === 'pill' || mode === 'full')
      && Boolean(timerState?.isRunning)
      && timerState?.mode === 'timed'
      && Number(timerState?.initialTime) >= 360
  }, {
    timeoutMs: 10000,
    description: 'timed session to restart from Session Wrap keep working',
  })
}

async function relaunchSmoke(appBundlePath, storeDir, version, licenseKey) {
  info('Relaunching packaged app to verify clean reopen')
  const electronApp = await electron.launch({
    executablePath: getExecutablePath(appBundlePath),
    env: {
      ...process.env,
      FOCANA_STORE_CWD: storeDir,
      FOCANA_ALLOW_DEV_TEST_LICENSE: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
  })

  try {
    const page = await electronApp.firstWindow()
    page.setDefaultTimeout(15000)
    await ensureStartupReady(page, licenseKey)

    const runtimeInfo = await page.evaluate(() => window.electronAPI.getRuntimeInfo?.())
    if (!runtimeInfo || runtimeInfo.version !== version) {
      fail(`Packaged relaunch reported version ${runtimeInfo?.version || 'unknown'} instead of ${version}`)
    }

    await page.locator(TASK_INPUT_SELECTOR).waitFor({ state: 'visible', timeout: 10000 })
  } finally {
    await electronApp.close()
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const appBundlePath = path.resolve(String(args['app-bundle'] || ''))
  const version = String(args.version || '').trim()
  const licenseKey = String(args['license-key'] || DEFAULT_LICENSE_KEY).trim()

  if (!appBundlePath) fail('Missing required --app-bundle argument')
  if (!version) fail('Missing required --version argument')
  if (!fs.existsSync(appBundlePath)) fail(`Missing app bundle: ${appBundlePath}`)
  if (!licenseKey) fail('Missing smoke license key. Set FOCANA_SMOKE_LICENSE_KEY or pass --license-key.')

  const storeDir = createStoreDir()
  let electronApp = null

  try {
    const executablePath = getExecutablePath(appBundlePath)
    if (!fs.existsSync(executablePath)) {
      fail(`Missing packaged executable: ${executablePath}`)
    }

    info(`Launching packaged app from ${appBundlePath}`)
    electronApp = await electron.launch({
      executablePath,
      env: {
        ...process.env,
        FOCANA_STORE_CWD: storeDir,
        FOCANA_ALLOW_DEV_TEST_LICENSE: '1',
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      },
    })

    const page = await electronApp.firstWindow()
    page.setDefaultTimeout(15000)
    await ensureStartupReady(page, licenseKey)
    await installTimeOffsetControl(page)

    const runtimeInfo = await page.evaluate(() => window.electronAPI.getRuntimeInfo?.())
    if (!runtimeInfo || runtimeInfo.version !== version) {
      fail(`Packaged app reported version ${runtimeInfo?.version || 'unknown'} instead of ${version}`)
    }

    await runFreeflowSmoke(page, electronApp)
    await runTimedSmoke(page)

    await electronApp.close()
    electronApp = null

    await relaunchSmoke(appBundlePath, storeDir, version, licenseKey)
    info('Packaged smoke checks passed')
  } finally {
    if (electronApp) {
      await electronApp.close().catch(() => {})
    }
    fs.rmSync(storeDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  process.stderr.write(`[packaged-smoke] ${error.message}\n`)
  process.exit(1)
})
