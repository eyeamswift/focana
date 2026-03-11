const { app, BrowserWindow, ipcMain, Notification, screen, nativeImage } = require('electron');
const path = require('path');
const store = require('./store');
const { registerShortcuts, unregisterAll } = require('./shortcuts');
const { createTray, popupFloatingContextMenu, setDndState } = require('./tray');
const { addCheckIn, getCheckInsBySession, updateCheckIn } = require('./checkInStore');

let mainWindow = null;
let isPillMode = false;
let lastFullBounds = null;
let isModalExpanded = false;
let preModalBounds = null;
let pillDragStart = null;
let compactTransientBaseBounds = null;
let compactTransientClearing = false;
let compactTransientSources = new Set();
let lastStablePillBounds = null;
let compactTransientClearTimer = null;
let pendingPillRestoreBounds = null;
let floatingIconWindow = null;
let isFloatingMinimized = false;
let floatingPulseTimeout = null;
let floatingPulseInterval = null;
let floatingIconDragStart = null;
let dndExpiryTimer = null;

const isDev = !app.isPackaged && process.env.FOCANA_E2E !== '1';
const isE2EBackground = process.env.FOCANA_E2E_BACKGROUND === '1';
const shouldCreateTray = process.env.FOCANA_E2E !== '1' || process.env.FOCANA_ENABLE_TRAY_IN_E2E === '1';
const FULL_MIN_WIDTH = 500;
const FULL_MIN_HEIGHT = 120;
const PILL_MIN_WIDTH = 100;
const PILL_MIN_HEIGHT = 72;
const PILL_MAX_HEIGHT = 260;
const PILL_EDGE_EPSILON = 2;
const FLOATING_ICON_SIZE = 64;
const FLOATING_ICON_PULSE_INITIAL_MS = 10 * 60 * 1000;
const FLOATING_ICON_PULSE_REPEAT_MS = 15 * 60 * 1000;
const DEFAULT_SHORTCUTS = {
  startPause: 'CommandOrControl+Shift+S',
  newTask: 'CommandOrControl+N',
  toggleCompact: 'CommandOrControl+Shift+I',
  completeTask: 'CommandOrControl+Enter',
  openParkingLot: 'CommandOrControl+Shift+P',
};
let pendingProgrammaticMainBounds = null;
let clearProgrammaticMainBoundsTimer = null;
const MAX_NOTIFICATION_TEXT_LENGTH = 160;
const ALLOWED_STORE_KEYS = new Set([
  'currentTask',
  'timerState',
  'thoughts',
  'sessions',
  'userEmail',
  'emailPromptSkipped',
  'settings',
  'settings.theme',
  'settings.themeManual',
  'settings.shortcuts',
  'settings.shortcutsEnabled',
  'settings.alwaysOnTop',
  'settings.bringToFront',
  'settings.keepTextAfterCompletion',
  'settings.showTaskInCompactDefault',
  'settings.showTaskInCompactCustomized',
  'settings.pinnedControls',
  'settings.mainScreenControlsEnabled',
  'settings.doNotDisturbEnabled',
  'settings.doNotDisturbUntil',
  'settings.checkInEnabled',
  'settings.checkInIntervalFreeflow',
  'settings.checkInIntervalTimed',
  'windowState',
]);

function boundsEqual(a, b) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function getStoredAlwaysOnTop() {
  return store.get('settings.alwaysOnTop', true) !== false;
}

function getEffectiveAlwaysOnTop() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isAlwaysOnTop();
  }
  return getStoredAlwaysOnTop();
}

function applyAlwaysOnTop(enabled, options = {}) {
  const persist = options.persist !== false;
  const next = Boolean(enabled);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(next);
  }
  if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
    floatingIconWindow.setAlwaysOnTop(next);
  }
  if (persist) {
    store.set('settings.alwaysOnTop', next);
  }

  return next;
}

function getBoundsCenter(bounds) {
  if (!bounds) return null;
  return {
    x: bounds.x + (bounds.width / 2),
    y: bounds.y + (bounds.height / 2),
  };
}

function buildCenteredBounds(center, width, height) {
  return {
    x: Math.round(center.x - (width / 2)),
    y: Math.round(center.y - (height / 2)),
    width,
    height,
  };
}

function buildBottomRightBounds(area, width, height) {
  return {
    x: Math.round(area.x + area.width - width),
    y: Math.round(area.y + area.height - height),
    width,
    height,
  };
}

function getPillTargetBounds(currentBounds, targetWidth, targetHeight, pulseActive = false) {
  const transientBounds = (pulseActive || compactTransientSources.size > 0 || compactTransientClearing)
    ? compactTransientBaseBounds
    : null;
  const stableBounds = transientBounds || lastStablePillBounds || currentBounds;
  if (!stableBounds) {
    return {
      x: currentBounds.x,
      y: currentBounds.y,
      width: targetWidth,
      height: targetHeight,
    };
  }

  const display = screen.getDisplayMatching(stableBounds);
  const area = display.bounds;
  const rightEdge = area.x + area.width;
  const bottomEdge = area.y + area.height;
  const stableRight = stableBounds.x + stableBounds.width;
  const stableBottom = stableBounds.y + stableBounds.height;
  const touchesLeft = Math.abs(stableBounds.x - area.x) <= PILL_EDGE_EPSILON;
  const touchesRight = Math.abs(stableRight - rightEdge) <= PILL_EDGE_EPSILON;
  const touchesTop = Math.abs(stableBounds.y - area.y) <= PILL_EDGE_EPSILON;
  const touchesBottom = Math.abs(stableBottom - bottomEdge) <= PILL_EDGE_EPSILON;

  const centeredBounds = buildCenteredBounds(getBoundsCenter(stableBounds), targetWidth, targetHeight);

  return {
    x: touchesRight && !touchesLeft
      ? Math.round(stableRight - targetWidth)
      : touchesLeft && !touchesRight
        ? Math.round(stableBounds.x)
        : centeredBounds.x,
    y: touchesBottom && !touchesTop
      ? Math.round(stableBottom - targetHeight)
      : touchesTop && !touchesBottom
        ? Math.round(stableBounds.y)
        : centeredBounds.y,
    width: targetWidth,
    height: targetHeight,
  };
}

function rememberStablePillBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') return;
  lastStablePillBounds = {
    x: Math.round(Number(bounds.x) || 0),
    y: Math.round(Number(bounds.y) || 0),
    width: Math.round(Number(bounds.width) || PILL_MIN_WIDTH),
    height: Math.round(Number(bounds.height) || PILL_MIN_HEIGHT),
  };
}

function clearCompactTransientClearTimer() {
  if (compactTransientClearTimer) {
    clearTimeout(compactTransientClearTimer);
    compactTransientClearTimer = null;
  }
}

function hasActiveCompactTransient() {
  return compactTransientSources.size > 0 || compactTransientClearing;
}

function clearCompactTransientState() {
  clearCompactTransientClearTimer();
  compactTransientBaseBounds = null;
  compactTransientClearing = false;
  compactTransientSources.clear();
}

function restoreAndClearCompactTransient() {
  if (!compactTransientBaseBounds) {
    clearCompactTransientState();
    return;
  }

  const restoreBounds = clampBounds(compactTransientBaseBounds, 'display');
  if (mainWindow && isPillMode) {
    const currentBounds = mainWindow.getBounds();
    if (!boundsEqual(currentBounds, restoreBounds)) {
      setMainWindowBoundsClamped(restoreBounds, { areaType: 'display' });
    }
  }
  rememberStablePillBounds(restoreBounds);
  clearCompactTransientState();
}

function beginCompactTransient(source) {
  if (!mainWindow || !isPillMode) return;
  clearCompactTransientClearTimer();
  compactTransientClearing = false;
  if (!compactTransientBaseBounds) {
    compactTransientBaseBounds = clampBounds(lastStablePillBounds || mainWindow.getBounds(), 'display');
  }
  if (source) {
    compactTransientSources.add(String(source));
  }
}

function endCompactTransient(source, delayMs = 0) {
  if (source) {
    compactTransientSources.delete(String(source));
  }
  if (compactTransientSources.size > 0) return;

  clearCompactTransientClearTimer();

  if (!compactTransientBaseBounds) {
    compactTransientClearing = false;
    return;
  }

  const safeDelay = Math.max(0, Math.floor(Number(delayMs) || 0));
  if (safeDelay === 0) {
    restoreAndClearCompactTransient();
    return;
  }

  compactTransientClearing = true;
  compactTransientClearTimer = setTimeout(() => {
    restoreAndClearCompactTransient();
  }, safeDelay);
}

function normalizeShortcuts(rawShortcuts) {
  const merged = { ...DEFAULT_SHORTCUTS };
  if (!rawShortcuts || typeof rawShortcuts !== 'object') return merged;
  for (const key of Object.keys(DEFAULT_SHORTCUTS)) {
    const value = rawShortcuts[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      merged[key] = value;
    }
  }
  return merged;
}

function shortcutsNeedRepair(rawShortcuts, mergedShortcuts) {
  return Object.keys(DEFAULT_SHORTCUTS).some((key) => mergedShortcuts[key] !== rawShortcuts?.[key]);
}

function ensurePlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeOptionalIsoTimestamp(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input !== 'string') {
    throw new Error('Expected timestamp to be a string');
  }
  const parsed = new Date(input);
  const ms = parsed.getTime();
  if (!Number.isFinite(ms)) {
    throw new Error('Expected a valid ISO timestamp');
  }
  return parsed.toISOString();
}

function clampNumber(value, min, max, fallback = min) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function validateStoreKey(key) {
  if (typeof key !== 'string' || !ALLOWED_STORE_KEYS.has(key)) {
    throw new Error(`Unsupported store key: ${String(key)}`);
  }
  return key;
}

function sanitizeBooleanMap(value) {
  if (!ensurePlainObject(value)) {
    throw new Error('Expected an object of boolean flags');
  }
  const normalized = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    normalized[entryKey] = Boolean(entryValue);
  }
  return normalized;
}

function sanitizeStoreValue(key, value) {
  switch (key) {
    case 'currentTask':
      if (!ensurePlainObject(value)) throw new Error('currentTask must be an object');
      return {
        text: typeof value.text === 'string' ? value.text : '',
        contextNote: typeof value.contextNote === 'string' ? value.contextNote : '',
        startedAt: sanitizeOptionalIsoTimestamp(value.startedAt),
      };
    case 'timerState':
      if (!ensurePlainObject(value)) throw new Error('timerState must be an object');
      {
        const timedIndex = Math.floor(clampNumber(value.checkInTimedIndex, 0, 4, 0));
        const pendingRaw = value.checkInTimedPendingIndex;
        const timedPendingIndex = Number.isFinite(pendingRaw)
          ? Math.floor(clampNumber(pendingRaw, 0, 4, 0))
          : null;
        const compactPulseTimedIndex = Math.floor(clampNumber(value.compactPulseTimedIndex, 0, 7, 0));

        return {
          mode: value.mode === 'timed' ? 'timed' : 'freeflow',
          seconds: clampNumber(value.seconds, 0, 24 * 60 * 60, 0),
          isRunning: Boolean(value.isRunning),
          initialTime: clampNumber(value.initialTime, 0, 24 * 60 * 60, 0),
          elapsedSeconds: clampNumber(value.elapsedSeconds, 0, 24 * 60 * 60, 0),
          sessionStartedAt: sanitizeOptionalIsoTimestamp(value.sessionStartedAt),
          checkInTimedIndex: timedIndex,
          checkInTimedPendingIndex: timedPendingIndex,
          compactPulseTimedIndex,
        };
      }
    case 'thoughts':
    case 'sessions':
      if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
      return value;
    case 'userEmail':
      if (typeof value !== 'string') throw new Error('userEmail must be a string');
      return value.trim().slice(0, 320);
    case 'emailPromptSkipped':
    case 'settings.themeManual':
    case 'settings.shortcutsEnabled':
    case 'settings.alwaysOnTop':
    case 'settings.bringToFront':
    case 'settings.keepTextAfterCompletion':
    case 'settings.showTaskInCompactDefault':
    case 'settings.showTaskInCompactCustomized':
    case 'settings.doNotDisturbEnabled':
    case 'settings.checkInEnabled':
      return Boolean(value);
    case 'settings.doNotDisturbUntil':
      return sanitizeOptionalIsoTimestamp(value);
    case 'settings.theme':
      return value === 'dark' ? 'dark' : 'light';
    case 'settings.checkInIntervalFreeflow':
      return clampNumber(value, 1, 240, 15);
    case 'settings.checkInIntervalTimed':
      if (!Array.isArray(value)) throw new Error('settings.checkInIntervalTimed must be an array');
      return value
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0 && item < 1)
        .slice(0, 4);
    case 'settings.shortcuts':
      return normalizeShortcuts(value);
    case 'settings.pinnedControls':
    case 'settings.mainScreenControlsEnabled':
      return sanitizeBooleanMap(value);
    case 'settings':
      if (!ensurePlainObject(value)) throw new Error('settings must be an object');
      return value;
    case 'windowState':
      if (!ensurePlainObject(value)) throw new Error('windowState must be an object');
      return sanitizeStoredWindowState(value);
    default:
      return value;
  }
}

function sanitizeNotificationPayload(payload) {
  if (!ensurePlainObject(payload)) {
    throw new Error('Notification payload must be an object');
  }

  return {
    title: typeof payload.title === 'string' ? payload.title.slice(0, MAX_NOTIFICATION_TEXT_LENGTH) : 'Focana',
    body: typeof payload.body === 'string' ? payload.body.slice(0, MAX_NOTIFICATION_TEXT_LENGTH) : '',
  };
}

function sanitizeShortcutsPayload(shortcuts) {
  if (!ensurePlainObject(shortcuts)) {
    throw new Error('Shortcuts payload must be an object');
  }
  return normalizeShortcuts(shortcuts);
}

function sanitizeDndStateInput(input) {
  if (typeof input === 'boolean') {
    return { enabled: input, until: null };
  }
  if (!ensurePlainObject(input)) {
    throw new Error('Do Not Disturb payload must be a boolean or object');
  }

  const enabled = Boolean(input.enabled);
  const until = enabled ? sanitizeOptionalIsoTimestamp(input.until) : null;
  return { enabled, until };
}

function clearDndExpiryTimer() {
  if (dndExpiryTimer) {
    clearTimeout(dndExpiryTimer);
    dndExpiryTimer = null;
  }
}

function scheduleDndExpiry(state) {
  clearDndExpiryTimer();
  if (!state.enabled || !state.until) return;

  const delayMs = new Date(state.until).getTime() - Date.now();
  if (delayMs <= 0) {
    applyDndState({ enabled: false, until: null });
    return;
  }

  dndExpiryTimer = setTimeout(() => {
    applyDndState({ enabled: false, until: null });
  }, delayMs);
}

function readStoredDndState() {
  const settings = store.get('settings', {});
  const enabled = Boolean(settings?.doNotDisturbEnabled);
  const until = enabled ? sanitizeOptionalIsoTimestamp(settings?.doNotDisturbUntil) : null;
  if (until && new Date(until).getTime() <= Date.now()) {
    return { enabled: false, until: null };
  }
  return { enabled, until };
}

function applyDndState(nextState) {
  const normalized = sanitizeDndStateInput(nextState);
  store.set('settings.doNotDisturbEnabled', normalized.enabled);
  store.set('settings.doNotDisturbUntil', normalized.until);
  setDndState(normalized);
  scheduleDndExpiry(normalized);
  if (isFloatingMinimized) {
    if (normalized.enabled) {
      stopFloatingPulseSchedule();
    } else {
      startFloatingPulseSchedule();
    }
  }
  return normalized;
}

// Ensure the runtime app name is Focana in dev and packaged modes.
app.setName('Focana');

function setDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;

  const candidatePaths = [
    // Preferred dock/app artwork shared by dev and packaged runtime.
    path.join(__dirname, '..', 'assets', 'focana-logo-MacDock.png'),
    // Fallbacks for older local builds.
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
  ];

  for (const iconPath of candidatePaths) {
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
        return;
      }
    } catch (_) {
      // Try next candidate path.
    }
  }
}

function clampBounds(bounds, areaType = 'workArea') {
  const display = screen.getDisplayMatching(bounds);
  const area = areaType === 'display' ? display.bounds : display.workArea;

  const width = Math.min(bounds.width, area.width);
  const height = Math.min(bounds.height, area.height);

  let x = bounds.x;
  let y = bounds.y;

  if (x < area.x) x = area.x;
  if (y < area.y) y = area.y;
  if (x + width > area.x + area.width) x = area.x + area.width - width;
  if (y + height > area.y + area.height) y = area.y + area.height - height;

  return { x, y, width, height };
}

function setMainWindowBoundsClamped(bounds, { persist = false, areaType = 'workArea' } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const clamped = clampBounds(bounds, areaType);
  const current = mainWindow.getBounds();
  const changed =
    current.x !== clamped.x ||
    current.y !== clamped.y ||
    current.width !== clamped.width ||
    current.height !== clamped.height;

  if (changed) {
    pendingProgrammaticMainBounds = clamped;
    if (clearProgrammaticMainBoundsTimer) {
      clearTimeout(clearProgrammaticMainBoundsTimer);
    }
    mainWindow.setBounds(clamped);
    clearProgrammaticMainBoundsTimer = setTimeout(() => {
      pendingProgrammaticMainBounds = null;
      clearProgrammaticMainBoundsTimer = null;
    }, 300);
  }

  if (persist && !isPillMode && !isModalExpanded) {
    store.set('windowState', clamped);
  }
}

function sanitizeStoredWindowState(rawState) {
  const fallback = { x: 100, y: 100, width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT };
  if (!rawState || typeof rawState !== 'object') return fallback;

  const width = Number.isFinite(rawState.width) ? Math.max(rawState.width, FULL_MIN_WIDTH) : FULL_MIN_WIDTH;
  const height = Number.isFinite(rawState.height) ? Math.max(rawState.height, FULL_MIN_HEIGHT) : FULL_MIN_HEIGHT;
  const x = Number.isFinite(rawState.x) ? rawState.x : fallback.x;
  const y = Number.isFinite(rawState.y) ? rawState.y : fallback.y;
  return { x, y, width, height };
}

function getDefaultMainWindowBounds() {
  const displayBounds = screen.getPrimaryDisplay().bounds;
  return buildBottomRightBounds(displayBounds, FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
}

function isToggleFloatingShortcut(input) {
  if (!input || input.type !== 'keyDown' || typeof input.key !== 'string') return false;
  const key = input.key.toLowerCase();
  if (key !== 'm') return false;
  const hasPrimary = process.platform === 'darwin' ? input.meta : input.control;
  return !!hasPrimary && !input.alt;
}

function wireToggleFloatingShortcut(window) {
  if (!window || window.isDestroyed()) return;
  window.webContents.on('before-input-event', (event, input) => {
    if (!isToggleFloatingShortcut(input)) return;
    event.preventDefault();
    toggleFloatingMinimize();
  });
}

function getFloatingBoundsNearMain(mainBounds) {
  const fallback = { x: 100, y: 100, width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT };
  const source = mainBounds && typeof mainBounds === 'object' ? mainBounds : fallback;
  const target = {
    x: Math.round(source.x + source.width - FLOATING_ICON_SIZE - 8),
    y: Math.round(source.y + 8),
    width: FLOATING_ICON_SIZE,
    height: FLOATING_ICON_SIZE,
  };
  return clampBounds(target, 'workArea');
}

function setFloatingIconBoundsClamped(bounds) {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed()) return;
  const clamped = clampBounds(bounds, 'workArea');
  const current = floatingIconWindow.getBounds();
  const changed =
    current.x !== clamped.x ||
    current.y !== clamped.y ||
    current.width !== clamped.width ||
    current.height !== clamped.height;
  if (changed) {
    floatingIconWindow.setBounds(clamped);
  }
}

function stopFloatingPulseSchedule() {
  if (floatingPulseTimeout) {
    clearTimeout(floatingPulseTimeout);
    floatingPulseTimeout = null;
  }
  if (floatingPulseInterval) {
    clearInterval(floatingPulseInterval);
    floatingPulseInterval = null;
  }
}

function sendFloatingPulse() {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed() || !floatingIconWindow.isVisible()) return;
  if (readStoredDndState().enabled) return;
  floatingIconWindow.webContents.send('floating-icon-pulse');
}

function startFloatingPulseSchedule() {
  stopFloatingPulseSchedule();
  floatingPulseTimeout = setTimeout(() => {
    sendFloatingPulse();
    floatingPulseInterval = setInterval(sendFloatingPulse, FLOATING_ICON_PULSE_REPEAT_MS);
  }, FLOATING_ICON_PULSE_INITIAL_MS);
}

function createFloatingIconWindow() {
  if (floatingIconWindow && !floatingIconWindow.isDestroyed()) return;

  const mainBounds = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.getBounds()
    : { x: 100, y: 100, width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT };
  const initialBounds = getFloatingBoundsNearMain(mainBounds);

  floatingIconWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: isE2EBackground ? false : getStoredAlwaysOnTop(),
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    movable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'floatingPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  floatingIconWindow.loadFile(path.join(__dirname, 'floating-icon.html'));
  wireToggleFloatingShortcut(floatingIconWindow);

  floatingIconWindow.on('closed', () => {
    floatingIconWindow = null;
    floatingIconDragStart = null;
    stopFloatingPulseSchedule();
    isFloatingMinimized = false;
  });
}

function enterFloatingIconMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  createFloatingIconWindow();
  if (!floatingIconWindow || floatingIconWindow.isDestroyed()) return;

  setFloatingIconBoundsClamped(getFloatingBoundsNearMain(mainWindow.getBounds()));
  mainWindow.hide();
  floatingIconWindow.show();
  floatingIconWindow.focus();
  isFloatingMinimized = true;
  startFloatingPulseSchedule();
}

function exitFloatingIconMode({ focusMain = true } = {}) {
  stopFloatingPulseSchedule();
  floatingIconDragStart = null;
  isFloatingMinimized = false;

  if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
    floatingIconWindow.hide();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    setMainWindowBoundsClamped(mainWindow.getBounds(), { areaType: 'display' });
    mainWindow.show();
    if (focusMain) mainWindow.focus();
  }
}

function hasVisibleTimerState() {
  const timerState = store.get('timerState', {});
  if (!timerState || typeof timerState !== 'object') return false;

  return Boolean(
    timerState.isRunning
    || (Number(timerState.seconds) || 0) > 0
    || (Number(timerState.initialTime) || 0) > 0
    || (Number(timerState.elapsedSeconds) || 0) > 0
    || timerState.mode === 'timed'
  );
}

function toggleFloatingMinimize() {
  if (isFloatingMinimized) {
    exitFloatingIconMode();
    return;
  }
  if (hasVisibleTimerState()) {
    return;
  }
  enterFloatingIconMode();
}

function createWindow() {
  setDockIcon();

  const initialBounds = clampBounds(getDefaultMainWindowBounds(), 'display');

  mainWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    frame: false,
    transparent: true,
    roundedCorners: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: isE2EBackground ? false : getStoredAlwaysOnTop(),
    resizable: true,
    minWidth: FULL_MIN_WIDTH,
    minHeight: FULL_MIN_HEIGHT,
    skipTaskbar: isE2EBackground ? true : false,
    show: isE2EBackground ? false : true,
    /* titleBarStyle removed — frame:false already hides the title bar;
       'hidden' caused macOS to draw a native window border. */
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  wireToggleFloatingShortcut(mainWindow);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Keep window fully on-screen after any user move/resize and persist full-mode bounds.
  const handleBoundsChange = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const currentBounds = mainWindow.getBounds();
    if (pendingProgrammaticMainBounds && boundsEqual(currentBounds, pendingProgrammaticMainBounds)) {
      pendingProgrammaticMainBounds = null;
      if (clearProgrammaticMainBoundsTimer) {
        clearTimeout(clearProgrammaticMainBoundsTimer);
        clearProgrammaticMainBoundsTimer = null;
      }
      return;
    }
    setMainWindowBoundsClamped(mainWindow.getBounds(), {
      persist: true,
      areaType: isModalExpanded ? 'workArea' : 'display',
    });
  };
  mainWindow.on('moved', handleBoundsChange);
  mainWindow.on('resize', handleBoundsChange);

  // Persist sanitized startup bounds.
  store.set('windowState', initialBounds);

  mainWindow.on('closed', () => {
    if (clearProgrammaticMainBoundsTimer) {
      clearTimeout(clearProgrammaticMainBoundsTimer);
      clearProgrammaticMainBoundsTimer = null;
    }
    pendingProgrammaticMainBounds = null;
    if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
      floatingIconWindow.close();
    }
    mainWindow = null;
  });

  mainWindow.on('show', () => {
    if (isFloatingMinimized) {
      stopFloatingPulseSchedule();
      isFloatingMinimized = false;
      if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
        floatingIconWindow.hide();
      }
    }
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    enterFloatingIconMode();
  });

  // Create tray
  if (shouldCreateTray) {
    createTray(mainWindow, {
      onDndChange: (nextState) => {
        applyDndState(nextState);
      },
    });
  }

  // Register shortcuts from stored settings
  const settings = store.get('settings', {});
  const normalizedShortcuts = normalizeShortcuts(settings.shortcuts);
  if (settings.shortcutsEnabled !== false) {
    registerShortcuts(normalizedShortcuts, mainWindow);
  }
  if (shortcutsNeedRepair(settings.shortcuts, normalizedShortcuts)) {
    store.set('settings.shortcuts', normalizedShortcuts);
  }
}

// IPC Handlers

// Window control
ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.on('minimize-to-tray', () => {
  enterFloatingIconMode();
});

ipcMain.handle('toggle-always-on-top', () => {
  return applyAlwaysOnTop(!getEffectiveAlwaysOnTop());
});

ipcMain.handle('set-always-on-top', (_event, enabled) => {
  return applyAlwaysOnTop(Boolean(enabled));
});

ipcMain.handle('get-always-on-top', () => {
  return getEffectiveAlwaysOnTop();
});

ipcMain.on('bring-to-front', () => {
  if (!mainWindow) return;
  if (isFloatingMinimized) {
    exitFloatingIconMode();
    return;
  }
  setMainWindowBoundsClamped(mainWindow.getBounds(), { areaType: 'display' });
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.on('toggle-floating-minimize', () => {
  toggleFloatingMinimize();
});

ipcMain.on('expand-from-floating', () => {
  if (!isFloatingMinimized) return;
  exitFloatingIconMode();
});

ipcMain.on('floating-context-menu', () => {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed() || !isFloatingMinimized) return;
  popupFloatingContextMenu(floatingIconWindow, {
    onExpand: () => {
      exitFloatingIconMode();
    },
  });
});

ipcMain.on('floating-icon-drag-start', () => {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed() || !isFloatingMinimized) return;
  const bounds = floatingIconWindow.getBounds();
  floatingIconDragStart = {
    x: bounds.x,
    y: bounds.y,
    lastDx: 0,
    lastDy: 0,
  };
});

ipcMain.on('floating-icon-drag-move', (_, payload) => {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed() || !floatingIconDragStart) return;

  const safeDx = Number.isFinite(payload?.dx) ? payload.dx : 0;
  const safeDy = Number.isFinite(payload?.dy) ? payload.dy : 0;
  const stepX = safeDx - (floatingIconDragStart.lastDx || 0);
  const stepY = safeDy - (floatingIconDragStart.lastDy || 0);
  floatingIconDragStart.lastDx = safeDx;
  floatingIconDragStart.lastDy = safeDy;

  if (stepX === 0 && stepY === 0) return;

  const current = floatingIconWindow.getBounds();
  setFloatingIconBoundsClamped({
    x: Math.round(current.x + stepX),
    y: Math.round(current.y + stepY),
    width: current.width,
    height: current.height,
  });
});

ipcMain.on('floating-icon-drag-end', () => {
  floatingIconDragStart = null;
});

// Shortcuts
ipcMain.on('register-shortcuts', (_event, shortcuts) => {
  if (!mainWindow) return;

  const settings = store.get('settings', {});
  if (settings.shortcutsEnabled === false) {
    unregisterAll();
    return;
  }

  registerShortcuts(sanitizeShortcutsPayload(shortcuts), mainWindow);
});

ipcMain.on('unregister-shortcuts', () => {
  unregisterAll();
});

// Store
ipcMain.handle('store-get', (_event, key) => {
  return store.get(validateStoreKey(key));
});

ipcMain.handle('store-set', (_event, key, value) => {
  const safeKey = validateStoreKey(key);
  const safeValue = sanitizeStoreValue(safeKey, value);
  store.set(safeKey, safeValue);

  if (safeKey === 'settings' && safeValue && safeValue.shortcutsEnabled === false) {
    unregisterAll();
  }

  return true;
});

// Check-ins
ipcMain.handle('checkin:add', (_event, data) => {
  return addCheckIn(data);
});

ipcMain.handle('checkin:getBySession', (_event, sessionId) => {
  if (typeof sessionId !== 'string') {
    throw new Error('Session id must be a string');
  }
  return getCheckInsBySession(sessionId);
});

ipcMain.handle('checkin:update', (_event, id, updates) => {
  return updateCheckIn(id, updates);
});

// Do Not Disturb — renderer → tray sync
ipcMain.on('set-dnd', (_event, enabled) => {
  applyDndState(enabled);
});

// Notifications
ipcMain.on('show-notification', (_event, payload) => {
  try {
    new Notification(sanitizeNotificationPayload(payload)).show();
  } catch (e) {
    console.error('Failed to show notification:', e);
  }
});

// Modal window expansion
ipcMain.handle('modal-opened', (_, minWidth, minHeight) => {
  if (mainWindow && !isPillMode) {
    if (!isModalExpanded) {
      preModalBounds = mainWindow.getBounds();
    }
    isModalExpanded = true;

    const current = mainWindow.getBounds();
    const targetWidth = clampNumber(minWidth, FULL_MIN_WIDTH, 2000, FULL_MIN_WIDTH);
    const targetHeight = clampNumber(minHeight, FULL_MIN_HEIGHT, 2000, FULL_MIN_HEIGHT);

    // Expand from the current center so expanded views stay interactable
    // without requiring the user to drag the window into place.
    const nextX = Math.round(current.x + (current.width - targetWidth) / 2);
    const nextY = Math.round(current.y + (current.height - targetHeight) / 2);

    setMainWindowBoundsClamped({
      x: nextX,
      y: nextY,
      width: targetWidth,
      height: targetHeight,
    });
  }
});

ipcMain.handle('modal-closed', () => {
  if (mainWindow && isModalExpanded && preModalBounds) {
    isModalExpanded = false;
    setMainWindowBoundsClamped(preModalBounds, { areaType: 'display' });
    preModalBounds = null;
  }
});

// Pill mode resize
ipcMain.handle('enter-pill-mode', (_, options = {}) => {
  if (mainWindow) {
    const current = mainWindow.getBounds();
    const displayBounds = screen.getDisplayMatching(current).bounds;
    const restorePreviousBounds = options?.restorePreviousBounds === true;
    lastFullBounds = current;
    clearCompactTransientState();
    isPillMode = true;
    mainWindow.setBackgroundColor('#00000000');
    mainWindow.setHasShadow(false);
    // Allow a true compact window in pill mode; otherwise FULL_MIN_HEIGHT keeps
    // an invisible tall window that blocks moving the visible pill higher.
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(PILL_MIN_WIDTH, PILL_MIN_HEIGHT);
    // Initial default size for compact mode before renderer computes exact width.
    const targetWidth = 182;
    const targetHeight = PILL_MIN_HEIGHT;
    const nextBounds = restorePreviousBounds && pendingPillRestoreBounds
      ? clampBounds(pendingPillRestoreBounds, 'display')
      : buildBottomRightBounds(displayBounds, targetWidth, targetHeight);
    pendingPillRestoreBounds = null;
    setMainWindowBoundsClamped(nextBounds, { areaType: 'display' });
    rememberStablePillBounds(clampBounds(nextBounds, 'display'));
    mainWindow.setResizable(false);
  }
});

ipcMain.handle('capture-pill-restore-bounds', () => {
  if (!mainWindow || !isPillMode) return;
  pendingPillRestoreBounds = clampBounds(
    compactTransientBaseBounds || lastStablePillBounds || mainWindow.getBounds(),
    'display',
  );
});

ipcMain.handle('begin-compact-transient', (_, payload = {}) => {
  if (!mainWindow || !isPillMode) return;
  beginCompactTransient(payload?.source || null);
});

ipcMain.handle('end-compact-transient', (_, payload = {}) => {
  endCompactTransient(payload?.source || null, payload?.delayMs || 0);
});

// Dynamic pill width — called by renderer as content expands/contracts
ipcMain.handle('set-pill-width', (_, width) => {
  if (mainWindow && isPillMode) {
    const current = mainWindow.getBounds();
    const targetWidth = Math.round(clampNumber(width, PILL_MIN_WIDTH, 1200, PILL_MIN_WIDTH));
    const targetHeight = Math.max(PILL_MIN_HEIGHT, Math.min(PILL_MAX_HEIGHT, current.height || PILL_MIN_HEIGHT));
    const nextBounds = getPillTargetBounds(current, targetWidth, targetHeight, false);
    setMainWindowBoundsClamped(nextBounds, { areaType: 'display' });
    if (!hasActiveCompactTransient()) {
      rememberStablePillBounds(clampBounds(nextBounds, 'display'));
    }
  }
});

// Dynamic pill size — preferred API for compact mode (width + height)
ipcMain.handle('set-pill-size', (_, size) => {
  if (mainWindow && isPillMode && size && typeof size === 'object') {
    const current = mainWindow.getBounds();
    const requestedWidth = Number.isFinite(size.width) ? size.width : current.width;
    const requestedHeight = Number.isFinite(size.height) ? size.height : current.height;
    const pulseActive = size.pulseActive === true;
    const targetWidth = Math.round(clampNumber(requestedWidth, PILL_MIN_WIDTH, 1200, current.width));
    const targetHeight = Math.round(clampNumber(requestedHeight, PILL_MIN_HEIGHT, PILL_MAX_HEIGHT, current.height));
    const nextBounds = getPillTargetBounds(current, targetWidth, targetHeight, pulseActive);
    setMainWindowBoundsClamped(nextBounds, { areaType: 'display' });
    if (!hasActiveCompactTransient()) {
      rememberStablePillBounds(clampBounds(nextBounds, 'display'));
    }
  }
});

ipcMain.handle('start-pill-pulse-resize', () => {
  if (mainWindow && isPillMode) {
    beginCompactTransient('pulse');
  }
});

ipcMain.handle('end-pill-pulse-resize', () => {
  endCompactTransient('pulse', 400);
});

// JS-based pill drag — renderer tracks mouse delta, main moves the window
ipcMain.on('pill-drag-start', () => {
  if (mainWindow && isPillMode) {
    const pos = mainWindow.getPosition();
    pillDragStart = { x: pos[0], y: pos[1], lastDx: 0, lastDy: 0 };
  }
});

ipcMain.on('pill-drag-move', (_, payload) => {
  if (mainWindow && isPillMode && pillDragStart) {
    const safeDx = Number.isFinite(payload?.dx) ? payload.dx : 0;
    const safeDy = Number.isFinite(payload?.dy) ? payload.dy : 0;
    const stepX = safeDx - (pillDragStart.lastDx || 0);
    const stepY = safeDy - (pillDragStart.lastDy || 0);
    pillDragStart.lastDx = safeDx;
    pillDragStart.lastDy = safeDy;

    const current = mainWindow.getBounds();
    const nextBounds = clampBounds({
      x: Math.round(current.x + stepX),
      y: Math.round(current.y + stepY),
      width: current.width,
      height: current.height,
    }, 'display');
    const actualStepX = nextBounds.x - current.x;
    const actualStepY = nextBounds.y - current.y;
    if (actualStepX === 0 && actualStepY === 0) return;
    if (compactTransientBaseBounds) {
      compactTransientBaseBounds = clampBounds({
        x: Math.round(compactTransientBaseBounds.x + actualStepX),
        y: Math.round(compactTransientBaseBounds.y + actualStepY),
        width: compactTransientBaseBounds.width,
        height: compactTransientBaseBounds.height,
      }, 'display');
    }
    if (compactTransientBaseBounds) {
      rememberStablePillBounds(compactTransientBaseBounds);
    } else {
      rememberStablePillBounds(nextBounds);
    }
    setMainWindowBoundsClamped(nextBounds, { areaType: 'display' });
  }
});

ipcMain.on('pill-drag-end', () => {
  pillDragStart = null;
  if (mainWindow && isPillMode) {
    rememberStablePillBounds(compactTransientBaseBounds || mainWindow.getBounds());
  }
});

ipcMain.handle('exit-pill-mode', () => {
  if (mainWindow) {
    clearCompactTransientState();
    lastStablePillBounds = null;
    isPillMode = false;
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
    let restoreBounds;
    if (lastFullBounds) {
      restoreBounds = lastFullBounds;
      lastFullBounds = null;
    } else {
      restoreBounds = store.get('windowState', { width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT });
    }

    if (!restoreBounds || typeof restoreBounds !== 'object') {
      restoreBounds = { width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT };
    }

    const restoreWidth = Math.max(restoreBounds.width || FULL_MIN_WIDTH, FULL_MIN_WIDTH);
    const restoreHeight = Math.max(restoreBounds.height || FULL_MIN_HEIGHT, FULL_MIN_HEIGHT);
    const current = mainWindow.getBounds();
    setMainWindowBoundsClamped(
      {
        x: current.x,
        y: current.y,
        width: restoreWidth,
        height: restoreHeight,
      },
      { persist: true, areaType: 'display' }
    );
  }
});

ipcMain.handle('ensure-main-window-size', (_, minWidth = FULL_MIN_WIDTH, minHeight = FULL_MIN_HEIGHT) => {
  if (!mainWindow || isPillMode || isModalExpanded) return;

  const targetWidth = clampNumber(minWidth, FULL_MIN_WIDTH, 2400, FULL_MIN_WIDTH);
  const targetHeight = clampNumber(minHeight, FULL_MIN_HEIGHT, 2400, FULL_MIN_HEIGHT);
  const bounds = mainWindow.getBounds();
  const displayBounds = screen.getDisplayMatching(bounds).bounds;
  const rightEdge = displayBounds.x + displayBounds.width;
  const bottomEdge = displayBounds.y + displayBounds.height;
  const touchesRight = Math.abs((bounds.x + bounds.width) - rightEdge) <= PILL_EDGE_EPSILON;
  const touchesBottom = Math.abs((bounds.y + bounds.height) - bottomEdge) <= PILL_EDGE_EPSILON;
  const nextBounds = {
    x: touchesRight ? Math.round(rightEdge - targetWidth) : bounds.x,
    y: touchesBottom ? Math.round(bottomEdge - targetHeight) : bounds.y,
    width: targetWidth,
    height: targetHeight,
  };

  mainWindow.setResizable(true);
  mainWindow.setMinimumSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
  setMainWindowBoundsClamped(
    nextBounds,
    { persist: true, areaType: 'display' }
  );
});

// App lifecycle
app.whenReady().then(() => {
  if (process.env.FOCANA_E2E !== '1') {
    try {
      applyDndState(readStoredDndState());
    } catch (error) {
      console.error('Failed to hydrate Do Not Disturb state:', error);
      applyDndState({ enabled: false, until: null });
    }
  }
  createWindow();
});

app.on('window-all-closed', () => {
  stopFloatingPulseSchedule();
  clearDndExpiryTimer();
  unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  stopFloatingPulseSchedule();
  clearDndExpiryTimer();
  unregisterAll();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
    return;
  }
  if (isFloatingMinimized) {
    exitFloatingIconMode();
    return;
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
});
