const { app, BrowserWindow, ipcMain, Notification, screen, nativeImage, powerMonitor } = require('electron');
const fs = require('fs/promises');
const http = require('http');
const path = require('path');
const store = require('./store');
const { registerKeepForLaterShortcut, unregisterAll } = require('./shortcuts');
const { createTray, popupCompactContextMenu, popupFloatingContextMenu, popupMainContextMenu, refreshTrayMenu, setDndState } = require('./tray');
const { addCheckIn, getCheckInsBySession, updateCheckIn } = require('./checkInStore');
const { createFeedbackSyncService } = require('./feedbackSync');
const { createLicenseService } = require('./licenseService');
const { createUpdaterService } = require('./updater');

let mainWindow = null;
let isPillMode = false;
let lastFullBounds = null;
let isModalExpanded = false;
let preModalBounds = null;
let pillDragStart = null;
let pillDragPollTimer = null;
let compactTransientBaseBounds = null;
let compactTransientClearing = false;
let compactTransientSources = new Set();
let lastStablePillBounds = null;
let compactTransientClearTimer = null;
let pendingPillRestoreBounds = null;
let floatingIconWindow = null;
let isFloatingMinimized = false;
let floatingStateInterval = null;
let floatingIconDragStart = null;
let floatingIconDragPollTimer = null;
let floatingWindowDisplayState = { mode: 'icon', timeText: '00:00' };
let floatingReentryState = {
  open: false,
  promptKey: 0,
  promptKind: 'start',
  resumeTaskName: '',
  defaultTaskText: '',
  defaultMinutes: 25,
  strongActive: false,
};
let floatingBreakState = {
  open: false,
  endsAt: 0,
  showTimer: false,
};
let floatingBreakPeekUntil = 0;
let checkInShortcutState = {
  visible: false,
};
let floatingPromptStage = 'task-entry';
let dndExpiryTimer = null;
const updater = createUpdaterService({ app, Notification });
const licenseService = createLicenseService({ app, store });
const feedbackSyncService = createFeedbackSyncService({ store });
const RENDERER_DIST_DIR = path.join(__dirname, '../../dist/renderer');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};
let rendererServer = null;
let rendererServerUrl = null;
let rendererServerPromise = null;

const isDev = (process.env.FOCANA_DEV === '1' || !app.isPackaged) && process.env.FOCANA_E2E !== '1';
const isE2EBackground = process.env.FOCANA_E2E_BACKGROUND === '1';
const isE2E = process.env.FOCANA_E2E === '1';
const shouldCreateTray = !isE2E || process.env.FOCANA_ENABLE_TRAY_IN_E2E === '1';
const usePanelWindows = process.platform === 'darwin' && !isE2E;
const FULL_MIN_WIDTH = 432;
const FULL_MIN_HEIGHT = 120;
const STARTUP_SAFE_HEIGHT = 520;
const PILL_MIN_WIDTH = 100;
const PILL_BASE_WIDTH = 124;
const PILL_MIN_HEIGHT = 72;
const PILL_MAX_HEIGHT = 460;
const PILL_EDGE_EPSILON = 2;
const PILL_CLAMP_AREA = 'workArea';
const DRAG_POLL_INTERVAL_MS = 16;
const DRAG_OVERRIDE_TTL_MS = 120;
const FLOATING_ICON_SIZE = 64;
const FLOATING_TIMER_WIDTH = 116;
const FLOATING_TIMER_HEIGHT = 48;
const FLOATING_BREAK_PEEK_MS = 3200;
const FLOATING_PROMPT_WIDTH = 420;
const FLOATING_CORNER_MARGIN = 12;
const FLOATING_PROMPT_STAGE_HEIGHTS = {
  'task-entry': 372,
  'start-chooser': 340,
  'resume-choice': 276,
  'snooze-options': 378,
};
const DEFAULT_SHORTCUTS = {
  startPause: 'CommandOrControl+Shift+S',
  newTask: 'CommandOrControl+N',
  toggleCompact: 'CommandOrControl+Shift+I',
  completeTask: 'CommandOrControl+Enter',
  openParkingLot: 'CommandOrControl+Shift+P',
};
const LEGACY_DEFAULT_WINDOW_STATE = {
  x: 100,
  y: 100,
  width: 400,
  height: 220,
};
let pendingProgrammaticMainBounds = null;
let clearProgrammaticMainBoundsTimer = null;
let awaitingInitialMainWindowShow = false;
let startupRevealFallbackTimer = null;
let pendingSystemResumeSyncTimer = null;
let pendingSystemPausePayload = null;
let pendingStartupLaunchSource = null;
const ALLOWED_STORE_KEYS = new Set([
  'currentTask',
  'timerState',
  'thoughts',
  'sessions',
  'feedbackQueue',
  'userEmail',
  'preferredName',
  'emailPromptSkipped',
  'settings',
  'settings.theme',
  'settings.themeManual',
  'settings.shortcuts',
  'settings.shortcutsEnabled',
  'settings.alwaysOnTop',
  'settings.bringToFront',
  'settings.keepTextAfterCompletion',
  'settings.pinnedControls',
  'settings.mainScreenControlsEnabled',
  'settings.doNotDisturbEnabled',
  'settings.doNotDisturbUntil',
  'settings.checkInEnabled',
  'settings.checkInIntervalFreeflow',
  'settings.checkInIntervalTimed',
  'settings.postSessionFeedbackSkippedStreak',
  'settings.postSessionFeedbackSuppressedUntil',
  'windowState',
]);

function resolveRendererAssetPath(relativePath) {
  const safeRelativePath = typeof relativePath === 'string' ? relativePath : 'index.html';
  const absolutePath = path.resolve(RENDERER_DIST_DIR, safeRelativePath);
  if (!absolutePath.startsWith(RENDERER_DIST_DIR)) {
    return null;
  }
  return absolutePath;
}

function stopRendererServer() {
  if (rendererServer) {
    rendererServer.close();
  }
  rendererServer = null;
  rendererServerUrl = null;
  rendererServerPromise = null;
}

async function ensureRendererServer() {
  if (rendererServerUrl) return rendererServerUrl;
  if (rendererServerPromise) return rendererServerPromise;

  rendererServerPromise = new Promise((resolve, reject) => {
    const server = http.createServer(async (request, response) => {
      try {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        const requestPath = decodeURIComponent(requestUrl.pathname || '/').replace(/^\/+/, '') || 'index.html';
        const absolutePath = resolveRendererAssetPath(requestPath);

        if (!absolutePath) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('Not found');
          return;
        }

        const file = await fs.readFile(absolutePath);
        const extension = path.extname(absolutePath).toLowerCase();
        response.writeHead(200, {
          'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        response.end(file);
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Internal server error');
      }
    });

    server.once('error', (error) => {
      rendererServerPromise = null;
      reject(error);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        rendererServerPromise = null;
        reject(new Error('Renderer server failed to bind to a local port.'));
        return;
      }

      rendererServer = server;
      rendererServerUrl = `http://127.0.0.1:${address.port}/index.html`;
      resolve(rendererServerUrl);
    });
  });

  return rendererServerPromise;
}

function boundsEqual(a, b) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function getStoredAlwaysOnTop() {
  return store.get('settings.alwaysOnTop', true) !== false;
}

function getEffectiveAlwaysOnTop() {
  return getStoredAlwaysOnTop();
}

function applyWindowAlwaysOnTop(win, enabled) {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(enabled, enabled && process.platform === 'darwin' ? 'screen-saver' : undefined);
  if (process.platform === 'darwin') {
    if (enabled) {
      win.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true,
      });
    } else {
      win.setVisibleOnAllWorkspaces(false, {
        visibleOnFullScreen: false,
        skipTransformProcessType: true,
      });
    }
  }
}

function applyAlwaysOnTop(enabled, options = {}) {
  const persist = options.persist !== false;
  const next = Boolean(enabled);

  applyWindowAlwaysOnTop(mainWindow, next);
  applyWindowAlwaysOnTop(floatingIconWindow, next);
  if (persist) {
    store.set('settings.alwaysOnTop', next);
  }

  if (next) {
    startAlwaysOnTopReassert();
  } else {
    stopAlwaysOnTopReassert();
  }

  refreshTrayMenu();

  return next;
}

/* --- Always-on-top periodic re-assertion (macOS) ---
 * Workaround for Electron bug #36364: the window can vanish when another app
 * enters fullscreen because macOS deactivates the panel and never re-renders
 * it on the fullscreen Space.  Re-calling setAlwaysOnTop + setVisibleOnAll-
 * Workspaces every few seconds nudges macOS into showing the window again.
 * The calls are cheap no-ops when the state is already correct. */
let alwaysOnTopReassertInterval = null;

function startAlwaysOnTopReassert() {
  stopAlwaysOnTopReassert();
  if (process.platform !== 'darwin') return;
  alwaysOnTopReassertInterval = setInterval(() => {
    if (!getStoredAlwaysOnTop()) return;
    applyWindowAlwaysOnTop(mainWindow, true);
    applyWindowAlwaysOnTop(floatingIconWindow, true);
  }, 3000);
}

function stopAlwaysOnTopReassert() {
  if (alwaysOnTopReassertInterval) {
    clearInterval(alwaysOnTopReassertInterval);
    alwaysOnTopReassertInterval = null;
  }
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

function getBoundsEdgeAnchors(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const candidateAreas = [display.workArea, display.bounds];
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const leftArea = candidateAreas.find((area) => Math.abs(bounds.x - area.x) <= PILL_EDGE_EPSILON);
  const rightArea = candidateAreas.find((area) => Math.abs(right - (area.x + area.width)) <= PILL_EDGE_EPSILON);
  const topArea = candidateAreas.find((area) => Math.abs(bounds.y - area.y) <= PILL_EDGE_EPSILON);
  const bottomArea = candidateAreas.find((area) => Math.abs(bottom - (area.y + area.height)) <= PILL_EDGE_EPSILON);

  return {
    left: leftArea ? leftArea.x : null,
    right: rightArea ? rightArea.x + rightArea.width : null,
    top: topArea ? topArea.y : null,
    bottom: bottomArea ? bottomArea.y + bottomArea.height : null,
  };
}

function getAnchoredCompactBoundsFromFullBounds(bounds, width, height) {
  const edgeAnchors = getBoundsEdgeAnchors(bounds);
  return {
    x: edgeAnchors.right !== null && edgeAnchors.left === null
      ? Math.round(edgeAnchors.right - width)
      : edgeAnchors.left !== null && edgeAnchors.right === null
        ? Math.round(edgeAnchors.left)
        : bounds.x,
    y: edgeAnchors.bottom !== null && edgeAnchors.top === null
      ? Math.round(edgeAnchors.bottom - height)
      : edgeAnchors.top !== null && edgeAnchors.bottom === null
        ? Math.round(edgeAnchors.top)
        : bounds.y,
    width,
    height,
  };
}

function isLegacyDefaultWindowState(bounds) {
  if (!bounds || typeof bounds !== 'object') return false;
  return (
    Number(bounds.x) === LEGACY_DEFAULT_WINDOW_STATE.x
    && Number(bounds.y) === LEGACY_DEFAULT_WINDOW_STATE.y
    && Number(bounds.width) === LEGACY_DEFAULT_WINDOW_STATE.width
    && Number(bounds.height) === LEGACY_DEFAULT_WINDOW_STATE.height
  );
}

function getPersistedWindowState() {
  const rawWindowState = store.get('windowState');
  if (!rawWindowState || typeof rawWindowState !== 'object') return null;
  if (isLegacyDefaultWindowState(rawWindowState)) return null;
  return rawWindowState;
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

  const edgeAnchors = getBoundsEdgeAnchors(stableBounds);
  const centeredBounds = buildCenteredBounds(getBoundsCenter(stableBounds), targetWidth, targetHeight);

  return {
    x: edgeAnchors.right !== null && edgeAnchors.left === null
      ? Math.round(edgeAnchors.right - targetWidth)
      : edgeAnchors.left !== null && edgeAnchors.right === null
        ? Math.round(edgeAnchors.left)
        : centeredBounds.x,
    y: edgeAnchors.bottom !== null && edgeAnchors.top === null
      ? Math.round(edgeAnchors.bottom - targetHeight)
      : edgeAnchors.top !== null && edgeAnchors.bottom === null
        ? Math.round(edgeAnchors.top)
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

function getDragPoint(dragState) {
  if (
    dragState?.overridePoint
    && Number.isFinite(dragState.overridePoint.x)
    && Number.isFinite(dragState.overridePoint.y)
    && (Date.now() - dragState.overridePoint.updatedAt) <= DRAG_OVERRIDE_TTL_MS
  ) {
    return {
      x: dragState.overridePoint.x,
      y: dragState.overridePoint.y,
    };
  }

  return screen.getCursorScreenPoint();
}

function clearPillDragPolling() {
  if (pillDragPollTimer) {
    clearInterval(pillDragPollTimer);
    pillDragPollTimer = null;
  }
}

function syncPillDragToPoint(point) {
  if (!mainWindow || mainWindow.isDestroyed() || !isPillMode || !pillDragStart || !point) return;

  const deltaX = point.x - pillDragStart.startCursor.x;
  const deltaY = point.y - pillDragStart.startCursor.y;
  const nextBounds = clampBounds({
    x: Math.round(pillDragStart.startBounds.x + deltaX),
    y: Math.round(pillDragStart.startBounds.y + deltaY),
    width: pillDragStart.startBounds.width,
    height: pillDragStart.startBounds.height,
  }, PILL_CLAMP_AREA);

  if (pillDragStart.transientStartBounds) {
    compactTransientBaseBounds = clampBounds({
      x: Math.round(pillDragStart.transientStartBounds.x + deltaX),
      y: Math.round(pillDragStart.transientStartBounds.y + deltaY),
      width: pillDragStart.transientStartBounds.width,
      height: pillDragStart.transientStartBounds.height,
    }, PILL_CLAMP_AREA);
    rememberStablePillBounds(compactTransientBaseBounds);
  } else {
    rememberStablePillBounds(nextBounds);
  }

  setMainWindowBoundsClamped(nextBounds, { areaType: PILL_CLAMP_AREA });
}

function startPillDragPolling() {
  clearPillDragPolling();
  pillDragPollTimer = setInterval(() => {
    if (!pillDragStart) {
      clearPillDragPolling();
      return;
    }
    syncPillDragToPoint(getDragPoint(pillDragStart));
  }, DRAG_POLL_INTERVAL_MS);
}

function clearFloatingIconDragPolling() {
  if (floatingIconDragPollTimer) {
    clearInterval(floatingIconDragPollTimer);
    floatingIconDragPollTimer = null;
  }
}

function syncFloatingIconDragToPoint(point) {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed() || !floatingIconDragStart || !point) return;

  const deltaX = point.x - floatingIconDragStart.startCursor.x;
  const deltaY = point.y - floatingIconDragStart.startCursor.y;
  setFloatingIconBoundsClamped({
    x: Math.round(floatingIconDragStart.startBounds.x + deltaX),
    y: Math.round(floatingIconDragStart.startBounds.y + deltaY),
    width: floatingIconDragStart.startBounds.width,
    height: floatingIconDragStart.startBounds.height,
  });
}

function startFloatingIconDragPolling() {
  clearFloatingIconDragPolling();
  floatingIconDragPollTimer = setInterval(() => {
    if (!floatingIconDragStart) {
      clearFloatingIconDragPolling();
      return;
    }
    syncFloatingIconDragToPoint(getDragPoint(floatingIconDragStart));
  }, DRAG_POLL_INTERVAL_MS);
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

  const restoreBounds = clampBounds(compactTransientBaseBounds, PILL_CLAMP_AREA);
  if (mainWindow && isPillMode) {
    const currentBounds = mainWindow.getBounds();
    if (!boundsEqual(currentBounds, restoreBounds)) {
      setMainWindowBoundsClamped(restoreBounds, { areaType: PILL_CLAMP_AREA });
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
    compactTransientBaseBounds = clampBounds(lastStablePillBounds || mainWindow.getBounds(), PILL_CLAMP_AREA);
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

function sanitizePreferredName(value) {
  if (typeof value !== 'string') {
    throw new Error('preferredName must be a string');
  }
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function sanitizeStoreValue(key, value) {
  switch (key) {
    case 'currentTask':
      if (!ensurePlainObject(value)) throw new Error('currentTask must be an object');
      return {
        text: typeof value.text === 'string' ? value.text : '',
        contextNote: typeof value.contextNote === 'string' ? value.contextNote : '',
        recap: typeof value.recap === 'string'
          ? value.recap
          : (typeof value.contextNote === 'string' ? value.contextNote : ''),
        nextSteps: typeof value.nextSteps === 'string' ? value.nextSteps : '',
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
          timerVisible: Boolean(value.timerVisible),
          isRunning: Boolean(value.isRunning),
          initialTime: clampNumber(value.initialTime, 0, 24 * 60 * 60, 0),
          elapsedSeconds: clampNumber(value.elapsedSeconds, 0, 24 * 60 * 60, 0),
          sessionStartedAt: sanitizeOptionalIsoTimestamp(value.sessionStartedAt),
          timedSegmentStartElapsed: clampNumber(value.timedSegmentStartElapsed, 0, 24 * 60 * 60, 0),
          timedSegmentDuration: clampNumber(value.timedSegmentDuration, 0, 24 * 60 * 60, 0),
          checkInTimedIndex: timedIndex,
          checkInTimedPendingIndex: timedPendingIndex,
          compactPulseTimedIndex,
          currentSessionId: typeof value.currentSessionId === 'string' && value.currentSessionId.trim()
            ? value.currentSessionId.trim()
            : null,
        };
      }
    case 'thoughts':
    case 'sessions':
    case 'feedbackQueue':
      if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
      return value;
    case 'userEmail':
      if (typeof value !== 'string') throw new Error('userEmail must be a string');
      return value.trim().slice(0, 320);
    case 'preferredName':
      return sanitizePreferredName(value);
    case 'emailPromptSkipped':
    case 'settings.themeManual':
    case 'settings.shortcutsEnabled':
    case 'settings.alwaysOnTop':
    case 'settings.bringToFront':
    case 'settings.keepTextAfterCompletion':
    case 'settings.doNotDisturbEnabled':
    case 'settings.checkInEnabled':
      return Boolean(value);
    case 'settings.postSessionFeedbackSkippedStreak':
      return clampNumber(Number(value), 0, 999, 0);
    case 'settings.doNotDisturbUntil':
    case 'settings.postSessionFeedbackSuppressedUntil':
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
  return normalized;
}

function shouldUseLaunchAtLoginMock() {
  return isE2E || !app.isPackaged;
}

function getStoredLaunchAtLogin() {
  return store.get('settings.launchOnStartup', true) !== false;
}

function getLaunchAtLoginEnabled() {
  if (shouldUseLaunchAtLoginMock()) {
    return getStoredLaunchAtLogin();
  }

  try {
    const settings = app.getLoginItemSettings();
    if (typeof settings?.openAtLogin === 'boolean') {
      return settings.openAtLogin;
    }
  } catch (error) {
    console.warn('Could not read login item settings:', error);
  }

  return getStoredLaunchAtLogin();
}

function setLaunchAtLoginEnabled(enabled) {
  const nextEnabled = Boolean(enabled);
  store.set('settings.launchOnStartup', nextEnabled);

  if (shouldUseLaunchAtLoginMock()) {
    return nextEnabled;
  }

  try {
    app.setLoginItemSettings({ openAtLogin: nextEnabled });
  } catch (error) {
    console.warn('Could not update login item settings:', error);
  }

  return getLaunchAtLoginEnabled();
}

function getLaunchSourceFromRuntime() {
  const e2eLaunchSource = typeof process.env.FOCANA_E2E_LAUNCH_SOURCE === 'string'
    ? process.env.FOCANA_E2E_LAUNCH_SOURCE.trim().toLowerCase()
    : '';
  if (e2eLaunchSource === 'login') {
    return 'login';
  }

  if (shouldUseLaunchAtLoginMock()) {
    return null;
  }

  try {
    const settings = app.getLoginItemSettings();
    return settings?.wasOpenedAtLogin ? 'login' : null;
  } catch (error) {
    console.warn('Could not read launch source from login item settings:', error);
    return null;
  }
}

function revealMainWindow({ focusMain = true } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  if (isFloatingMinimized) {
    exitFloatingIconMode({ focusMain });
    return true;
  }

  if (typeof mainWindow.getOpacity === 'function' && mainWindow.getOpacity() < 1) {
    mainWindow.setOpacity(1);
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  if (focusMain) {
    mainWindow.focus();
  }

  return true;
}

function hideResidentApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
    floatingIconWindow.hide();
  }

  stopFloatingStateSync();
  floatingIconDragStart = null;
  clearFloatingIconDragPolling();
  isFloatingMinimized = false;

  if (typeof mainWindow.getOpacity === 'function' && mainWindow.getOpacity() < 1) {
    mainWindow.setOpacity(1);
  }

  mainWindow.hide();
  return true;
}

function requestQuitResidentInfo(source = 'unknown') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    app.quit();
    return;
  }

  revealMainWindow({ focusMain: true });
  mainWindow.webContents.send('quit-resident-info-requested', { source });
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

function getSizedMainWindowBounds(minWidth = FULL_MIN_WIDTH, minHeight = FULL_MIN_HEIGHT) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const targetWidth = clampNumber(minWidth, FULL_MIN_WIDTH, 2400, FULL_MIN_WIDTH);
  const targetHeight = clampNumber(minHeight, FULL_MIN_HEIGHT, 2400, FULL_MIN_HEIGHT);
  const bounds = mainWindow.getBounds();
  const edgeAnchors = getBoundsEdgeAnchors(bounds);

  return {
    x: edgeAnchors.right !== null ? Math.round(edgeAnchors.right - targetWidth) : bounds.x,
    y: edgeAnchors.bottom !== null ? Math.round(edgeAnchors.bottom - targetHeight) : bounds.y,
    width: targetWidth,
    height: targetHeight,
  };
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
  const workArea = screen.getPrimaryDisplay().workArea;
  return buildBottomRightBounds(workArea, FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
}

function isToggleFloatingShortcut(input) {
  if (!input || input.type !== 'keyDown' || typeof input.key !== 'string') return false;
  const key = input.key.toLowerCase();
  if (key !== 'm') return false;
  const hasPrimary = process.platform === 'darwin' ? input.meta : input.control;
  return !!hasPrimary && !input.alt;
}

function isCheckInYesShortcut(input) {
  if (!input || input.type !== 'keyDown') return false;
  const key = typeof input.key === 'string' ? input.key.toLowerCase() : '';
  const code = typeof input.code === 'string' ? input.code : '';
  const hasPrimary = process.platform === 'darwin' ? input.meta : input.control;
  return !!hasPrimary && !!input.shift && !input.alt && (key === 'y' || code === 'KeyY');
}

function wireToggleFloatingShortcut(window) {
  if (!window || window.isDestroyed()) return;
  window.webContents.on('before-input-event', (event, input) => {
    if (isToggleFloatingShortcut(input)) {
      event.preventDefault();
      toggleFloatingMinimize();
      return;
    }

    if (
      window === mainWindow
      && checkInShortcutState.visible
      && isCheckInYesShortcut(input)
      && mainWindow
      && !mainWindow.isDestroyed()
    ) {
      event.preventDefault();
      mainWindow.webContents.send('scoped-checkin-shortcut', 'focused');
    }
  });
}

function getFloatingBoundsNearMain(mainBounds, state = floatingWindowDisplayState) {
  const fallback = { x: 100, y: 100, width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT };
  const source = mainBounds && typeof mainBounds === 'object' ? mainBounds : fallback;
  const display = screen.getDisplayMatching(source);
  const workArea = display?.workArea || screen.getPrimaryDisplay().workArea;
  const size = getFloatingSizeForState(state);
  const sourceCenter = getBoundsCenter(source) || getBoundsCenter(workArea);
  const candidateBounds = [
    {
      x: Math.round(workArea.x + FLOATING_CORNER_MARGIN),
      y: Math.round(workArea.y + FLOATING_CORNER_MARGIN),
      width: size.width,
      height: size.height,
    },
    {
      x: Math.round(workArea.x + workArea.width - size.width - FLOATING_CORNER_MARGIN),
      y: Math.round(workArea.y + FLOATING_CORNER_MARGIN),
      width: size.width,
      height: size.height,
    },
    {
      x: Math.round(workArea.x + FLOATING_CORNER_MARGIN),
      y: Math.round(workArea.y + workArea.height - size.height - FLOATING_CORNER_MARGIN),
      width: size.width,
      height: size.height,
    },
    {
      x: Math.round(workArea.x + workArea.width - size.width - FLOATING_CORNER_MARGIN),
      y: Math.round(workArea.y + workArea.height - size.height - FLOATING_CORNER_MARGIN),
      width: size.width,
      height: size.height,
    },
  ];
  const target = candidateBounds.reduce((closest, candidate) => {
    if (!closest) return candidate;

    const candidateCenter = getBoundsCenter(candidate);
    const closestCenter = getBoundsCenter(closest);
    const candidateDistance = ((candidateCenter?.x || 0) - (sourceCenter?.x || 0)) ** 2
      + ((candidateCenter?.y || 0) - (sourceCenter?.y || 0)) ** 2;
    const closestDistance = ((closestCenter?.x || 0) - (sourceCenter?.x || 0)) ** 2
      + ((closestCenter?.y || 0) - (sourceCenter?.y || 0)) ** 2;

    return candidateDistance < closestDistance ? candidate : closest;
  }, null);
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

function formatFloatingTime(seconds) {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
  const hours = Math.floor(safeSeconds / 3600);
  if (hours > 0) {
    const remainder = safeSeconds % 3600;
    const minutes = Math.floor(remainder / 60);
    const secs = remainder % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}


function checkpointActiveSessionInStore(options = {}) {
  const pauseTimer = options?.pauseTimer === true;
  const timerState = store.get('timerState', {});
  const currentTask = store.get('currentTask', {});
  const activeSessionId = typeof timerState?.currentSessionId === 'string' && timerState.currentSessionId.trim()
    ? timerState.currentSessionId.trim()
    : null;
  const taskText = typeof currentTask?.text === 'string' ? currentTask.text.trim() : '';

  const mode = timerState?.mode === 'timed' ? 'timed' : 'freeflow';
  const initialTime = Math.max(0, Number(timerState?.initialTime) || 0);
  const baseElapsedSeconds = Math.max(0, Number(timerState?.elapsedSeconds) || 0);
  const sessionStartedAt = typeof timerState?.sessionStartedAt === 'string' ? timerState.sessionStartedAt : null;
  const hasRecoverableTimer = Boolean(timerState?.timerVisible)
    || Boolean(timerState?.isRunning)
    || baseElapsedSeconds > 0
    || initialTime > 0;
  const wasRunning = Boolean(timerState?.isRunning);

  let elapsedSeconds = baseElapsedSeconds;

  if (wasRunning && sessionStartedAt) {
    const startedAtMs = new Date(sessionStartedAt).getTime();
    if (Number.isFinite(startedAtMs)) {
      elapsedSeconds += Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    }
  }

  if (mode === 'timed' && initialTime > 0) {
    elapsedSeconds = Math.min(elapsedSeconds, initialTime);
  }

  let didPauseTimer = false;
  if (pauseTimer && hasRecoverableTimer && wasRunning) {
    const displaySeconds = mode === 'timed'
      ? Math.max(0, initialTime - elapsedSeconds)
      : elapsedSeconds;

    store.set('timerState', {
      ...timerState,
      seconds: displaySeconds,
      isRunning: false,
      elapsedSeconds,
      sessionStartedAt: null,
    });
    store.set('currentTask', {
      ...currentTask,
      startedAt: null,
    });
    didPauseTimer = true;
  }

  if (!hasRecoverableTimer) {
    return didPauseTimer;
  }

  const durationMinutes = Number((elapsedSeconds / 60).toFixed(2));

  if (!activeSessionId || !taskText) {
    return didPauseTimer;
  }

  const sessions = store.get('sessions', []);
  if (!Array.isArray(sessions)) {
    return didPauseTimer;
  }

  const sessionIndex = sessions.findIndex((session) => session?.id === activeSessionId);
  if (sessionIndex === -1) {
    return didPauseTimer;
  }

  const nextSessions = [...sessions];
  nextSessions[sessionIndex] = {
    ...nextSessions[sessionIndex],
    task: taskText,
    durationMinutes,
    mode,
    completed: false,
    notes: typeof currentTask?.contextNote === 'string' ? currentTask.contextNote : '',
  };
  store.set('sessions', nextSessions);
  return true;
}

function handleSystemSuspend() {
  const didPauseTimer = checkpointActiveSessionInStore({ pauseTimer: true });
  if (!didPauseTimer) {
    pendingSystemPausePayload = null;
    return;
  }

  pendingSystemPausePayload = {
    currentTask: store.get('currentTask', {}),
    timerState: store.get('timerState', {}),
  };

  syncFloatingWindowState({ preservePosition: true });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('system-suspend-paused', pendingSystemPausePayload);
  }
}

function syncPausedSessionAfterResume() {
  const snapshot = pendingSystemPausePayload;
  if (snapshot?.timerState && typeof snapshot.timerState === 'object') {
    store.set('currentTask', snapshot.currentTask || {});
    store.set('timerState', snapshot.timerState);
    syncFloatingWindowState({ preservePosition: true });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-suspend-paused', snapshot);
    }
    pendingSystemPausePayload = null;
    return;
  }

  const timerState = store.get('timerState', {});
  const hasPausedRecoverableTimer = (
    Boolean(timerState?.timerVisible)
    || Math.max(0, Number(timerState?.elapsedSeconds) || 0) > 0
    || Math.max(0, Number(timerState?.initialTime) || 0) > 0
  ) && !Boolean(timerState?.isRunning);

  if (!hasPausedRecoverableTimer) {
    pendingSystemPausePayload = null;
    return;
  }

  syncFloatingWindowState({ preservePosition: true });
  if (mainWindow && !mainWindow.isDestroyed()) {
    const payload = {
      currentTask: store.get('currentTask', {}),
      timerState,
    };
    mainWindow.webContents.send('system-suspend-paused', payload);
  }
  pendingSystemPausePayload = null;
}

function handleSystemResume() {
  if (pendingSystemResumeSyncTimer) {
    clearTimeout(pendingSystemResumeSyncTimer);
  }

  pendingSystemResumeSyncTimer = setTimeout(() => {
    pendingSystemResumeSyncTimer = null;
    syncPausedSessionAfterResume();
  }, 150);
}

function getFloatingWindowState() {
  const timerState = store.get('timerState', {});
  const isRunning = Boolean(timerState && typeof timerState === 'object' && timerState.isRunning);
  const timerVisible = Boolean(timerState && typeof timerState === 'object' && timerState.timerVisible);
  const totalSeconds = Number(timerState?.seconds) || 0;
  const theme = store.get('settings.theme', 'light') === 'dark' ? 'dark' : 'light';

  if (floatingReentryState.open) {
    return {
      mode: 'prompt',
      theme,
      promptKey: floatingReentryState.promptKey,
      promptKind: floatingReentryState.promptKind,
      promptStage: floatingPromptStage,
      resumeTaskName: floatingReentryState.resumeTaskName,
      defaultTaskText: floatingReentryState.defaultTaskText,
      defaultMinutes: floatingReentryState.defaultMinutes,
      strongActive: floatingReentryState.strongActive === true,
    };
  }

  const breakRemainingSeconds = getFloatingBreakRemainingSeconds();
  if (breakRemainingSeconds > 0) {
    const breakTimerVisible = floatingBreakState.showTimer === true || floatingBreakPeekUntil > Date.now();
    return {
      mode: breakTimerVisible ? 'break-timer' : 'icon',
      timeText: formatFloatingTime(breakRemainingSeconds),
      theme,
      running: false,
      breakActive: true,
      breakTimerVisible,
    };
  }

  return {
    mode: timerVisible ? 'timer' : 'icon',
    timeText: formatFloatingTime(totalSeconds),
    theme,
    running: isRunning,
    breakActive: false,
    breakTimerVisible: false,
  };
}

function getDefaultFloatingPromptStage(state = floatingReentryState) {
  return state?.promptKind === 'resume-choice' ? 'resume-choice' : 'task-entry';
}

function sanitizeFloatingPromptStage(stage, state = floatingReentryState) {
  const fallback = getDefaultFloatingPromptStage(state);
  if (typeof stage !== 'string' || !stage.trim()) return fallback;

  const normalized = stage.trim();
  if (!Object.prototype.hasOwnProperty.call(FLOATING_PROMPT_STAGE_HEIGHTS, normalized)) {
    return fallback;
  }

  if (state?.promptKind !== 'resume-choice' && normalized === 'resume-choice') {
    return fallback;
  }

  return normalized;
}

function sanitizeFloatingReentryState(nextState = {}) {
  const safeState = nextState && typeof nextState === 'object' ? nextState : {};
  return {
    open: safeState.open === true,
    promptKey: Math.max(0, Math.floor(Number(safeState.promptKey) || 0)),
    promptKind: safeState.promptKind === 'resume-choice' ? 'resume-choice' : 'start',
    resumeTaskName: typeof safeState.resumeTaskName === 'string'
      ? safeState.resumeTaskName.trim().slice(0, 120)
      : '',
    defaultTaskText: typeof safeState.defaultTaskText === 'string'
      ? safeState.defaultTaskText.slice(0, 160)
      : '',
    defaultMinutes: clampNumber(safeState.defaultMinutes, 1, 240, 25),
    strongActive: safeState.strongActive === true,
  };
}

function sanitizeFloatingBreakState(nextState = {}) {
  const safeState = nextState && typeof nextState === 'object' ? nextState : {};
  const endsAt = Math.max(0, Math.floor(Number(safeState.endsAt) || 0));
  return {
    open: safeState.open === true && endsAt > 0,
    endsAt,
    showTimer: safeState.showTimer === true,
  };
}

function getFloatingBreakRemainingSeconds(state = floatingBreakState) {
  if (!state?.open) return 0;
  return Math.max(0, Math.ceil((Math.max(0, Number(state.endsAt) || 0) - Date.now()) / 1000));
}

function getFloatingSizeForState(state = floatingWindowDisplayState) {
  if (state?.mode === 'prompt') {
    const promptStage = sanitizeFloatingPromptStage(state?.promptStage, {
      promptKind: state?.promptKind,
    });
    return {
      width: FLOATING_PROMPT_WIDTH,
      height: FLOATING_PROMPT_STAGE_HEIGHTS[promptStage] || FLOATING_PROMPT_STAGE_HEIGHTS['task-entry'],
    };
  }
  if (state?.mode === 'timer' || state?.mode === 'break-timer') {
    return { width: FLOATING_TIMER_WIDTH, height: FLOATING_TIMER_HEIGHT };
  }
  return { width: FLOATING_ICON_SIZE, height: FLOATING_ICON_SIZE };
}

function stopFloatingStateSync() {
  if (floatingStateInterval) {
    clearInterval(floatingStateInterval);
    floatingStateInterval = null;
  }
}

function syncFloatingWindowState({ preservePosition = true, anchorBounds = null } = {}) {
  const previousState = floatingWindowDisplayState;
  const nextState = getFloatingWindowState();
  floatingWindowDisplayState = nextState;

  if (!floatingIconWindow || floatingIconWindow.isDestroyed()) return nextState;

  const size = getFloatingSizeForState(nextState);
  const nextBounds = preservePosition
    ? (() => {
      const currentBounds = floatingIconWindow.getBounds();
      const shouldAnchorBottomRight = previousState?.mode === 'prompt' || nextState?.mode === 'prompt';
      return clampBounds({
        x: shouldAnchorBottomRight
          ? currentBounds.x + currentBounds.width - size.width
          : currentBounds.x,
        y: shouldAnchorBottomRight
          ? currentBounds.y + currentBounds.height - size.height
          : currentBounds.y,
        width: size.width,
        height: size.height,
      }, 'workArea');
    })()
    : getFloatingBoundsNearMain(anchorBounds || mainWindow?.getBounds(), nextState);

  setFloatingIconBoundsClamped(nextBounds);
  floatingIconWindow.webContents.send('floating-state', nextState);

  return nextState;
}

function startFloatingStateSync({ preservePosition = false, anchorBounds = null } = {}) {
  stopFloatingStateSync();
  syncFloatingWindowState({ preservePosition, anchorBounds });
  floatingStateInterval = setInterval(() => {
    syncFloatingWindowState({ preservePosition: true });
  }, 1000);
}

function sendFloatingPulse() {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed() || !floatingIconWindow.isVisible()) return;
  if (readStoredDndState().enabled) return;
  floatingIconWindow.webContents.send('floating-icon-pulse');
}


function createFloatingIconWindow() {
  if (floatingIconWindow && !floatingIconWindow.isDestroyed()) return;

  const mainBounds = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.getBounds()
    : { x: 100, y: 100, width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT };
  const initialBounds = getFloatingBoundsNearMain(mainBounds, floatingWindowDisplayState);

  floatingIconWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    ...(usePanelWindows ? { type: 'panel' } : {}),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    movable: true,
    skipTaskbar: true,
    show: isE2E,
    webPreferences: {
      preload: path.join(__dirname, 'floatingPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  applyAlwaysOnTop(isE2EBackground ? false : getEffectiveAlwaysOnTop(), { persist: false });

  floatingIconWindow.loadFile(path.join(__dirname, 'floating-icon.html'));
  wireToggleFloatingShortcut(floatingIconWindow);
  floatingIconWindow.webContents.on('did-finish-load', () => {
    if (!floatingIconWindow || floatingIconWindow.isDestroyed()) return;
    floatingIconWindow.webContents.send('floating-state', floatingWindowDisplayState);
  });

  floatingIconWindow.on('show', () => {
    if (getStoredAlwaysOnTop() && !isE2EBackground) {
      applyWindowAlwaysOnTop(floatingIconWindow, true);
    }
  });

  floatingIconWindow.on('closed', () => {
    floatingIconWindow = null;
    floatingIconDragStart = null;
    clearFloatingIconDragPolling();
    stopFloatingStateSync();
    isFloatingMinimized = false;
  });
}

function enterFloatingIconMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  createFloatingIconWindow();
  if (!floatingIconWindow || floatingIconWindow.isDestroyed()) return;

  startFloatingStateSync({ preservePosition: false, anchorBounds: mainWindow.getBounds() });
  mainWindow.hide();
  floatingIconWindow.show();
  floatingIconWindow.focus();
  isFloatingMinimized = true;
}

function exitFloatingIconMode({ focusMain = true } = {}) {
  stopFloatingStateSync();
  floatingIconDragStart = null;
  clearFloatingIconDragPolling();
  isFloatingMinimized = false;
  const floatingBounds = floatingIconWindow && !floatingIconWindow.isDestroyed()
    ? floatingIconWindow.getBounds()
    : null;

  if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
    floatingIconWindow.hide();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    const currentMainBounds = mainWindow.getBounds();
    const nextBounds = floatingBounds
      ? clampBounds({
        x: floatingBounds.x,
        y: floatingBounds.y,
        width: Math.max(currentMainBounds.width || FULL_MIN_WIDTH, FULL_MIN_WIDTH),
        height: Math.max(currentMainBounds.height || FULL_MIN_HEIGHT, FULL_MIN_HEIGHT),
      }, 'display')
      : currentMainBounds;
    setMainWindowBoundsClamped(nextBounds, { persist: true, areaType: 'display' });
    mainWindow.show();
    if (focusMain) mainWindow.focus();
  }
}

function toggleFloatingMinimize() {
  if (isFloatingMinimized) {
    exitFloatingIconMode();
    return;
  }
  enterFloatingIconMode();
}

function createWindow() {
  setDockIcon();

  const fallbackBounds = getDefaultMainWindowBounds();
  const rawWindowState = getPersistedWindowState() || fallbackBounds;
  const storedWindowState = sanitizeStoredWindowState(
    rawWindowState && typeof rawWindowState === 'object'
      ? { ...fallbackBounds, ...rawWindowState }
      : fallbackBounds
  );
  const initialBounds = clampBounds({
    x: storedWindowState.x,
    y: storedWindowState.y,
    width: Math.max(storedWindowState.width || FULL_MIN_WIDTH, FULL_MIN_WIDTH),
    // Startup gates need more than the timer-height shell; keep the hidden
    // launch window large enough to show onboarding/loading if it is revealed
    // before the renderer finishes its explicit startup resize handshake.
    height: Math.max(storedWindowState.height || STARTUP_SAFE_HEIGHT, STARTUP_SAFE_HEIGHT),
  }, 'workArea');

  mainWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    ...(usePanelWindows ? { type: 'panel' } : {}),
    frame: false,
    transparent: true,
    roundedCorners: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    fullscreenable: false,
    resizable: true,
    minWidth: FULL_MIN_WIDTH,
    minHeight: FULL_MIN_HEIGHT,
    skipTaskbar: isE2EBackground ? true : false,
    show: false,
    /* titleBarStyle removed — frame:false already hides the title bar;
       'hidden' caused macOS to draw a native window border. */
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  applyAlwaysOnTop(isE2EBackground ? false : getEffectiveAlwaysOnTop(), { persist: false });
  awaitingInitialMainWindowShow = !isE2EBackground && !isE2E;
  wireToggleFloatingShortcut(mainWindow);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    ensureRendererServer()
      .then((url) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.loadURL(url);
      })
      .catch((error) => {
        console.error('Failed to start packaged renderer server:', error);
      });
  }
  mainWindow.webContents.on('context-menu', () => {
    popupMainContextMenu(mainWindow);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    if (
      isDev
      && awaitingInitialMainWindowShow
      && mainWindow
      && !mainWindow.isDestroyed()
      && !mainWindow.isVisible()
      && !isPillMode
      && !isModalExpanded
    ) {
      const nextBounds = getSizedMainWindowBounds(FULL_MIN_WIDTH, STARTUP_SAFE_HEIGHT);
      if (nextBounds && !boundsEqual(mainWindow.getBounds(), nextBounds)) {
        mainWindow.setResizable(true);
        mainWindow.setMinimumSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
        setMainWindowBoundsClamped(nextBounds, { areaType: 'display' });
      }
      awaitingInitialMainWindowShow = false;
      mainWindow.show();
      mainWindow.focus();
      return;
    }

    if (startupRevealFallbackTimer) {
      clearTimeout(startupRevealFallbackTimer);
      startupRevealFallbackTimer = null;
    }
    startupRevealFallbackTimer = setTimeout(() => {
      if (
        !mainWindow
        || mainWindow.isDestroyed()
        || !awaitingInitialMainWindowShow
        || mainWindow.isVisible()
        || isPillMode
        || isModalExpanded
      ) {
        return;
      }

      const nextBounds = getSizedMainWindowBounds(FULL_MIN_WIDTH, STARTUP_SAFE_HEIGHT);
      if (nextBounds && !boundsEqual(mainWindow.getBounds(), nextBounds)) {
        mainWindow.setResizable(true);
        mainWindow.setMinimumSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
        setMainWindowBoundsClamped(nextBounds, { areaType: 'display' });
      }
      awaitingInitialMainWindowShow = false;
      mainWindow.show();
      mainWindow.focus();
    }, 1200);
  });
  updater.attachWindow(mainWindow);

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

  mainWindow.on('closed', () => {
    if (startupRevealFallbackTimer) {
      clearTimeout(startupRevealFallbackTimer);
      startupRevealFallbackTimer = null;
    }
    if (clearProgrammaticMainBoundsTimer) {
      clearTimeout(clearProgrammaticMainBoundsTimer);
      clearProgrammaticMainBoundsTimer = null;
    }
    pendingProgrammaticMainBounds = null;
    awaitingInitialMainWindowShow = false;
    pillDragStart = null;
    clearPillDragPolling();
    if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
      floatingIconWindow.close();
    }
    mainWindow = null;
  });

  mainWindow.on('show', () => {
    if (getStoredAlwaysOnTop() && !isE2EBackground) {
      applyWindowAlwaysOnTop(mainWindow, true);
    }
    if (isFloatingMinimized) {
      isFloatingMinimized = false;
      if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
        floatingIconWindow.hide();
      }
    }
    feedbackSyncService.requestSync('main-window-show');
  });

  mainWindow.on('focus', () => {
    feedbackSyncService.requestSync('main-window-focus');
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
      onAlwaysOnTopChange: (nextState) => {
        applyAlwaysOnTop(nextState?.enabled);
      },
      onRevealApp: () => {
        revealMainWindow({ focusMain: true });
      },
      onQuitApp: (source) => {
        requestQuitResidentInfo(source);
      },
    });
  }

  // Register shortcuts from stored settings
  const settings = store.get('settings', {});
  const normalizedShortcuts = normalizeShortcuts(settings.shortcuts);
  if (shortcutsNeedRepair(settings.shortcuts, normalizedShortcuts)) {
    store.set('settings.shortcuts', normalizedShortcuts);
  }
  registerKeepForLaterShortcut(mainWindow);
}

// IPC Handlers

// Window control
ipcMain.on('quit-app', () => {
  requestQuitResidentInfo('settings');
});

ipcMain.on('force-quit-app', () => {
  app.quit();
});

ipcMain.on('hide-app', () => {
  hideResidentApp();
});

ipcMain.handle('launch-at-login:get', () => {
  return getLaunchAtLoginEnabled();
});

ipcMain.handle('launch-at-login:set', (_event, enabled) => {
  return setLaunchAtLoginEnabled(enabled);
});

ipcMain.handle('startup:get-launch-source', () => {
  const source = pendingStartupLaunchSource;
  pendingStartupLaunchSource = null;
  return source;
});

ipcMain.on('restart-app', () => {
  checkpointActiveSessionInStore({ pauseTimer: true });
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('updates:get-state', () => {
  return updater.getState();
});

ipcMain.handle('updates:check', () => {
  return updater.checkForUpdates({ userInitiated: true });
});

ipcMain.handle('updates:install', () => {
  return updater.quitAndInstall();
});

ipcMain.handle('app:get-runtime-info', () => {
  return licenseService.getRuntimeInfo();
});

ipcMain.handle('license:get-status', () => {
  return licenseService.getStatus();
});

ipcMain.handle('license:activate', (_event, licenseKey) => {
  return licenseService.activateLicense(licenseKey);
});

ipcMain.handle('license:validate', (_event, options) => {
  return licenseService.validateLicense(options);
});

ipcMain.handle('license:deactivate', () => {
  return licenseService.deactivateLicense();
});

ipcMain.handle('profile:save-preferred-name', (_event, preferredName) => {
  return licenseService.savePreferredName(preferredName);
});

ipcMain.handle('feedback:enqueue', (_event, item) => {
  return feedbackSyncService.enqueueFeedback(item, 'renderer-enqueue');
});

ipcMain.handle('feedback:sync', () => {
  return feedbackSyncService.syncNow({ reason: 'renderer-request' });
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
  if (typeof mainWindow.getOpacity === 'function' && mainWindow.getOpacity() < 1) {
    mainWindow.setOpacity(1);
  }
  setMainWindowBoundsClamped(mainWindow.getBounds(), { areaType: 'display' });
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.on('toggle-floating-minimize', () => {
  toggleFloatingMinimize();
});

ipcMain.handle('get-floating-minimized', () => isFloatingMinimized);

ipcMain.handle('restore-from-floating-for-time-up', () => {
  const wasFloating = isFloatingMinimized;
  if (wasFloating) {
    exitFloatingIconMode();
  }
  return wasFloating;
});

ipcMain.handle('enter-floating-minimize', () => {
  if (!isFloatingMinimized) {
    enterFloatingIconMode();
  }
  return true;
});

// Exit floating mode but keep mainWindow hidden (opacity 0) so the renderer
// can enter compact/pill mode before revealing.  The floating icon is hidden
// and mainWindow is positioned at the icon's location with its current size
// but NOT shown — the renderer must call enterPillMode and then show the
// window itself via bringToFront or similar after the compact bounds are set.
ipcMain.handle('exit-floating-for-compact', () => {
  if (!isFloatingMinimized) return false;

  stopFloatingStateSync();
  floatingIconDragStart = null;
  clearFloatingIconDragPolling();
  isFloatingMinimized = false;

  const floatingBounds = floatingIconWindow && !floatingIconWindow.isDestroyed()
    ? floatingIconWindow.getBounds()
    : null;

  if (floatingIconWindow && !floatingIconWindow.isDestroyed()) {
    floatingIconWindow.hide();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    // Position mainWindow at the floating icon location.  Hide it visually
    // with opacity 0 so the renderer can enter pill mode and resize to compact
    // bounds before anything is visible — avoiding a flash of the full window.
    mainWindow.setOpacity(0);
    const currentMainBounds = mainWindow.getBounds();
    const nextBounds = floatingBounds
      ? clampBounds({
        x: floatingBounds.x,
        y: floatingBounds.y,
        width: Math.max(currentMainBounds.width || FULL_MIN_WIDTH, FULL_MIN_WIDTH),
        height: Math.max(currentMainBounds.height || FULL_MIN_HEIGHT, FULL_MIN_HEIGHT),
      }, 'display')
      : currentMainBounds;
    setMainWindowBoundsClamped(nextBounds, { persist: false, areaType: 'display' });
    mainWindow.show();
  }

  return true;
});

ipcMain.handle('show-main-window-after-startup', (_, width = FULL_MIN_WIDTH, height = FULL_MIN_HEIGHT) => {
  if (!mainWindow || mainWindow.isDestroyed() || isE2EBackground) return false;

  if (startupRevealFallbackTimer) {
    clearTimeout(startupRevealFallbackTimer);
    startupRevealFallbackTimer = null;
  }

  // If the user already minimized into the floating shell during startup,
  // treat the reveal handshake as complete without yanking focus back to the
  // main window.
  if (isFloatingMinimized) {
    awaitingInitialMainWindowShow = false;
    return true;
  }

  if (awaitingInitialMainWindowShow && !mainWindow.isVisible() && !isPillMode && !isModalExpanded) {
    const nextBounds = getSizedMainWindowBounds(width, height);
    if (nextBounds && !boundsEqual(mainWindow.getBounds(), nextBounds)) {
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
      setMainWindowBoundsClamped(nextBounds, { persist: true, areaType: 'display' });
    }
  }

  awaitingInitialMainWindowShow = false;
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
  return true;
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

ipcMain.on('compact-context-menu', () => {
  if (!mainWindow || mainWindow.isDestroyed() || isFloatingMinimized) return;
  popupCompactContextMenu(mainWindow, {
    onMinimize: () => {
      enterFloatingIconMode();
    },
  });
});

ipcMain.on('floating-timer-action', (_event, action) => {
  if (!mainWindow || mainWindow.isDestroyed() || !isFloatingMinimized) return;
  if (action !== 'startPause' && action !== 'stop') return;
  if (action === 'stop') {
    exitFloatingIconMode();
  }
  mainWindow.webContents.send('floating-timer-action', action);
});

ipcMain.on('floating-icon-drag-start', () => {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed() || !isFloatingMinimized) return;
  const bounds = floatingIconWindow.getBounds();
  floatingIconDragStart = {
    startBounds: { ...bounds },
    startCursor: screen.getCursorScreenPoint(),
    overridePoint: null,
  };
  startFloatingIconDragPolling();
});

ipcMain.on('floating-icon-drag-move', (_, payload) => {
  if (!floatingIconWindow || floatingIconWindow.isDestroyed() || !floatingIconDragStart) return;

  const safeDx = Number.isFinite(payload?.dx) ? payload.dx : 0;
  const safeDy = Number.isFinite(payload?.dy) ? payload.dy : 0;
  const point = {
    x: floatingIconDragStart.startCursor.x + safeDx,
    y: floatingIconDragStart.startCursor.y + safeDy,
    updatedAt: Date.now(),
  };
  floatingIconDragStart.overridePoint = point;
  syncFloatingIconDragToPoint(point);
});

ipcMain.on('floating-icon-drag-end', () => {
  floatingIconDragStart = null;
  clearFloatingIconDragPolling();
});

// Shortcuts
ipcMain.on('register-shortcuts', (_event, shortcuts) => {
  sanitizeShortcutsPayload(shortcuts);
  unregisterAll();
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

// Floating pulse — renderer drives timing, main sends to floating window
ipcMain.on('trigger-floating-pulse', () => {
  sendFloatingPulse();
});

ipcMain.on('set-floating-reentry-state', (_event, payload = {}) => {
  const previousState = floatingReentryState;
  floatingReentryState = sanitizeFloatingReentryState(payload);
  const shouldResetStage = (
    !previousState?.open
    || !floatingReentryState.open
    || previousState?.promptKind !== floatingReentryState.promptKind
    || previousState?.promptKey !== floatingReentryState.promptKey
  );
  floatingPromptStage = shouldResetStage
    ? getDefaultFloatingPromptStage(floatingReentryState)
    : sanitizeFloatingPromptStage(floatingPromptStage, floatingReentryState);
  syncFloatingWindowState({ preservePosition: true });
});

ipcMain.on('set-floating-break-state', (_event, payload = {}) => {
  floatingBreakState = sanitizeFloatingBreakState(payload);
  floatingBreakPeekUntil = 0;
  syncFloatingWindowState({ preservePosition: true });
});

ipcMain.on('floating-break-action', (_event, action) => {
  const normalizedAction = typeof action === 'string' ? action.trim() : '';
  const breakRemainingSeconds = getFloatingBreakRemainingSeconds();
  if (breakRemainingSeconds <= 0) return;

  if (normalizedAction === 'peek-timer') {
    if (floatingBreakState.showTimer === true) return;
    floatingBreakPeekUntil = Date.now() + FLOATING_BREAK_PEEK_MS;
    syncFloatingWindowState({ preservePosition: true });
    return;
  }

  if (normalizedAction === 'resume-now') {
    floatingBreakPeekUntil = 0;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('floating-break-action', { action: 'resume-now' });
  }
});

ipcMain.on('set-checkin-shortcut-state', (_event, payload = {}) => {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  checkInShortcutState = {
    visible: safePayload.visible === true,
  };
});

ipcMain.on('floating-reentry-stage', (_event, stage) => {
  if (!floatingReentryState.open) return;
  const nextStage = sanitizeFloatingPromptStage(stage, floatingReentryState);
  if (nextStage === floatingPromptStage) return;
  floatingPromptStage = nextStage;
  syncFloatingWindowState({ preservePosition: true });
});

ipcMain.on('floating-reentry-action', (_event, payload = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('floating-reentry-action', payload);
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
    const targetWidth = PILL_BASE_WIDTH;
    const targetHeight = PILL_MIN_HEIGHT;
    const rememberedCompactBounds = lastStablePillBounds
      ? clampBounds(lastStablePillBounds, PILL_CLAMP_AREA)
      : null;
    const currentAnchoredCompactBounds = clampBounds(
      getAnchoredCompactBoundsFromFullBounds(
        current,
        rememberedCompactBounds?.width || targetWidth,
        rememberedCompactBounds?.height || targetHeight,
      ),
      PILL_CLAMP_AREA,
    );
    const nextBounds = restorePreviousBounds && pendingPillRestoreBounds
      ? clampBounds(pendingPillRestoreBounds, PILL_CLAMP_AREA)
      : currentAnchoredCompactBounds;
    pendingPillRestoreBounds = null;
    setMainWindowBoundsClamped(nextBounds, { areaType: PILL_CLAMP_AREA });
    rememberStablePillBounds(clampBounds(nextBounds, PILL_CLAMP_AREA));
    mainWindow.setResizable(false);
    // Restore opacity in case it was set to 0 during a floating → compact
    // transition (exit-floating-for-compact hides the window visually while
    // keeping it technically shown so the renderer can process events).
    if (mainWindow.getOpacity() < 1) {
      mainWindow.setOpacity(1);
    }
  }
});

ipcMain.handle('capture-pill-restore-bounds', () => {
  if (!mainWindow || !isPillMode) return;
  pendingPillRestoreBounds = clampBounds(
    compactTransientBaseBounds || mainWindow.getBounds() || lastStablePillBounds,
    PILL_CLAMP_AREA,
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
    setMainWindowBoundsClamped(nextBounds, { areaType: PILL_CLAMP_AREA });
    if (!hasActiveCompactTransient()) {
      rememberStablePillBounds(clampBounds(nextBounds, PILL_CLAMP_AREA));
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
    setMainWindowBoundsClamped(nextBounds, { areaType: PILL_CLAMP_AREA });
    if (!hasActiveCompactTransient()) {
      rememberStablePillBounds(clampBounds(nextBounds, PILL_CLAMP_AREA));
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
    const bounds = mainWindow.getBounds();
    pillDragStart = {
      startBounds: { ...bounds },
      startCursor: screen.getCursorScreenPoint(),
      transientStartBounds: compactTransientBaseBounds
        ? clampBounds(compactTransientBaseBounds, PILL_CLAMP_AREA)
        : null,
      overridePoint: null,
    };
    startPillDragPolling();
  }
});

ipcMain.on('pill-drag-move', (_, payload) => {
  if (mainWindow && isPillMode && pillDragStart) {
    const safeDx = Number.isFinite(payload?.dx) ? payload.dx : 0;
    const safeDy = Number.isFinite(payload?.dy) ? payload.dy : 0;
    const point = {
      x: pillDragStart.startCursor.x + safeDx,
      y: pillDragStart.startCursor.y + safeDy,
      updatedAt: Date.now(),
    };
    pillDragStart.overridePoint = point;
    syncPillDragToPoint(point);
  }
});

ipcMain.on('pill-drag-end', () => {
  pillDragStart = null;
  clearPillDragPolling();
  if (mainWindow && isPillMode) {
    rememberStablePillBounds(clampBounds(compactTransientBaseBounds || mainWindow.getBounds(), PILL_CLAMP_AREA));
  }
});

ipcMain.handle('exit-pill-mode', (_event, options = {}) => {
  if (mainWindow) {
    clearCompactTransientState();
    isPillMode = false;
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
    let restoreBounds;
    if (lastFullBounds) {
      restoreBounds = lastFullBounds;
      lastFullBounds = null;
    } else {
      restoreBounds = getPersistedWindowState() || { width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT };
    }

    if (!restoreBounds || typeof restoreBounds !== 'object') {
      restoreBounds = { width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT };
    }

    const requestedWidth = Number.isFinite(options?.width) ? options.width : restoreBounds.width;
    const requestedHeight = Number.isFinite(options?.height) ? options.height : restoreBounds.height;
    const restoreWidth = Math.max(Math.round(requestedWidth || FULL_MIN_WIDTH), FULL_MIN_WIDTH);
    const restoreHeight = Math.max(Math.round(requestedHeight || FULL_MIN_HEIGHT), FULL_MIN_HEIGHT);
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
  if (!mainWindow || isPillMode || isModalExpanded) return false;

  const nextBounds = getSizedMainWindowBounds(minWidth, minHeight);
  if (!nextBounds) return false;
  if (boundsEqual(mainWindow.getBounds(), nextBounds)) return false;

  mainWindow.setResizable(true);
  mainWindow.setMinimumSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
  setMainWindowBoundsClamped(
    nextBounds,
    { persist: true, areaType: 'display' }
  );
  return true;
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
  setLaunchAtLoginEnabled(getStoredLaunchAtLogin());
  pendingStartupLaunchSource = getLaunchSourceFromRuntime();
  powerMonitor.on('suspend', handleSystemSuspend);
  powerMonitor.on('resume', handleSystemResume);
  createWindow();
  updater.start();
  feedbackSyncService.start();
});

app.on('window-all-closed', () => {
  stopRendererServer();
  updater.stop();
  feedbackSyncService.stop();
  clearDndExpiryTimer();
  unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  stopRendererServer();
  powerMonitor.removeListener('suspend', handleSystemSuspend);
  powerMonitor.removeListener('resume', handleSystemResume);
  if (pendingSystemResumeSyncTimer) {
    clearTimeout(pendingSystemResumeSyncTimer);
    pendingSystemResumeSyncTimer = null;
  }
  checkpointActiveSessionInStore({ pauseTimer: true });
  updater.stop();
  feedbackSyncService.stop();
  stopAlwaysOnTopReassert();
  clearDndExpiryTimer();
  unregisterAll();
});

app.on('activate', () => {
  feedbackSyncService.requestSync('app-activate');
  if (mainWindow === null) {
    createWindow();
    return;
  }
  if (awaitingInitialMainWindowShow) {
    return;
  }
  revealMainWindow({ focusMain: true });
});
