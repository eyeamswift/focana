const { app, BrowserWindow, ipcMain, Notification, screen, nativeImage } = require('electron');
const path = require('path');
const store = require('./store');
const { registerShortcuts, unregisterAll } = require('./shortcuts');
const { createTray, setDndState } = require('./tray');
const { addCheckIn, getCheckInsBySession, updateCheckIn } = require('./checkInStore');

let mainWindow = null;
let isPillMode = false;
let lastFullBounds = null;
let isModalExpanded = false;
let preModalBounds = null;
let pillDragStart = null;

const isDev = !app.isPackaged && process.env.FOCANA_E2E !== '1';
const isE2EBackground = process.env.FOCANA_E2E_BACKGROUND === '1';
const FULL_MIN_WIDTH = 500;
const FULL_MIN_HEIGHT = 120;
const PILL_MIN_WIDTH = 100;
const PILL_MIN_HEIGHT = 72;
const PILL_MAX_HEIGHT = 260;
let isApplyingBounds = false;

// Ensure the runtime app name is Focana in dev and packaged modes.
app.setName('Focana');

function setDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;

  const candidatePaths = [
    // Dev: generated high-resolution app icon.
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
    // Fallback: packaged/runtime asset icon.
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
    isApplyingBounds = true;
    mainWindow.setBounds(clamped);
    isApplyingBounds = false;
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

function createWindow() {
  setDockIcon();

  const windowState = sanitizeStoredWindowState(
    store.get('windowState', { x: 100, y: 100, width: FULL_MIN_WIDTH, height: FULL_MIN_HEIGHT })
  );
  const initialBounds = clampBounds(windowState, 'display');

  mainWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: isE2EBackground ? false : true,
    resizable: true,
    minWidth: FULL_MIN_WIDTH,
    minHeight: FULL_MIN_HEIGHT,
    skipTaskbar: isE2EBackground ? true : false,
    show: isE2EBackground ? false : true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -20, y: -20 }, // Hide native traffic lights
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Keep window fully on-screen after any user move/resize and persist full-mode bounds.
  const handleBoundsChange = () => {
    if (!mainWindow || mainWindow.isDestroyed() || isApplyingBounds) return;
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
    mainWindow = null;
  });

  // Create tray
  createTray(mainWindow);

  // Register shortcuts from stored settings
  const settings = store.get('settings', {});
  const shortcuts = settings.shortcuts || {};
  if (settings.shortcutsEnabled !== false && Object.keys(shortcuts).length > 0) {
    registerShortcuts(shortcuts, mainWindow);
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
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    const current = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!current);
    return !current;
  }
  return false;
});

ipcMain.on('bring-to-front', () => {
  if (mainWindow) {
    setMainWindowBoundsClamped(mainWindow.getBounds(), { areaType: 'display' });
    mainWindow.show();
    mainWindow.focus();
  }
});

// Shortcuts
ipcMain.on('register-shortcuts', (_event, shortcuts) => {
  if (!mainWindow) return;

  const settings = store.get('settings', {});
  if (settings.shortcutsEnabled === false) {
    unregisterAll();
    return;
  }

  registerShortcuts(shortcuts, mainWindow);
});

ipcMain.on('unregister-shortcuts', () => {
  unregisterAll();
});

// Store
ipcMain.handle('store-get', (_event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (_event, key, value) => {
  store.set(key, value);

  if (key === 'settings' && value && value.shortcutsEnabled === false) {
    unregisterAll();
  }

  return true;
});

// Check-ins
ipcMain.handle('checkin:add', (_event, data) => {
  return addCheckIn(data);
});

ipcMain.handle('checkin:getBySession', (_event, sessionId) => {
  return getCheckInsBySession(sessionId);
});

ipcMain.handle('checkin:update', (_event, id, updates) => {
  return updateCheckIn(id, updates);
});

// Do Not Disturb — renderer → tray sync
ipcMain.on('set-dnd', (_event, enabled) => {
  setDndState(!!enabled);
});

// Notifications
ipcMain.on('show-notification', (_event, { title, body }) => {
  try {
    new Notification({ title, body }).show();
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
    const targetWidth = Math.max(
      Number.isFinite(minWidth) ? minWidth : 0,
      FULL_MIN_WIDTH
    );
    const targetHeight = Math.max(
      Number.isFinite(minHeight) ? minHeight : 0,
      FULL_MIN_HEIGHT
    );

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
ipcMain.handle('enter-pill-mode', () => {
  if (mainWindow) {
    const current = mainWindow.getBounds();
    lastFullBounds = current;
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
    const nextX = Math.round(current.x + (current.width - targetWidth) / 2);
    const nextY = Math.round(current.y + (current.height - targetHeight) / 2);
    setMainWindowBoundsClamped({
      x: nextX,
      y: nextY,
      width: targetWidth,
      height: targetHeight,
    }, { areaType: 'display' });
    mainWindow.setResizable(false);
  }
});

// Dynamic pill width — called by renderer as content expands/contracts
ipcMain.handle('set-pill-width', (_, width) => {
  if (mainWindow && isPillMode) {
    const current = mainWindow.getBounds();
    const targetWidth = Math.max(PILL_MIN_WIDTH, Math.round(width));
    const targetHeight = Math.max(PILL_MIN_HEIGHT, Math.min(PILL_MAX_HEIGHT, current.height || PILL_MIN_HEIGHT));
    const nextX = Math.round(current.x + (current.width - targetWidth) / 2);
    const nextY = Math.round(current.y + (current.height - targetHeight) / 2);

    setMainWindowBoundsClamped({
      x: nextX,
      y: nextY,
      width: targetWidth,
      height: targetHeight,
    }, { areaType: 'display' });
  }
});

// Dynamic pill size — preferred API for compact mode (width + height)
ipcMain.handle('set-pill-size', (_, size) => {
  if (mainWindow && isPillMode && size && typeof size === 'object') {
    const current = mainWindow.getBounds();
    const requestedWidth = Number.isFinite(size.width) ? size.width : current.width;
    const requestedHeight = Number.isFinite(size.height) ? size.height : current.height;
    const targetWidth = Math.max(PILL_MIN_WIDTH, Math.round(requestedWidth));
    const targetHeight = Math.max(PILL_MIN_HEIGHT, Math.min(PILL_MAX_HEIGHT, Math.round(requestedHeight)));
    const nextX = Math.round(current.x + (current.width - targetWidth) / 2);
    const nextY = Math.round(current.y + (current.height - targetHeight) / 2);

    setMainWindowBoundsClamped({
      x: nextX,
      y: nextY,
      width: targetWidth,
      height: targetHeight,
    }, { areaType: 'display' });
  }
});

// JS-based pill drag — renderer tracks mouse delta, main moves the window
ipcMain.on('pill-drag-start', () => {
  if (mainWindow && isPillMode) {
    const pos = mainWindow.getPosition();
    pillDragStart = { x: pos[0], y: pos[1], lastDx: 0, lastDy: 0 };
  }
});

ipcMain.on('pill-drag-move', (_, { dx, dy }) => {
  if (mainWindow && isPillMode && pillDragStart) {
    const safeDx = Number.isFinite(dx) ? dx : 0;
    const safeDy = Number.isFinite(dy) ? dy : 0;
    const stepX = safeDx - (pillDragStart.lastDx || 0);
    const stepY = safeDy - (pillDragStart.lastDy || 0);
    pillDragStart.lastDx = safeDx;
    pillDragStart.lastDy = safeDy;

    if (stepX === 0 && stepY === 0) return;

    const current = mainWindow.getBounds();
    setMainWindowBoundsClamped({
      x: Math.round(current.x + stepX),
      y: Math.round(current.y + stepY),
      width: current.width,
      height: current.height,
    }, { areaType: 'display' });
  }
});

ipcMain.on('pill-drag-end', () => {
  pillDragStart = null;
});

ipcMain.handle('exit-pill-mode', () => {
  if (mainWindow) {
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
  if (!mainWindow || isPillMode) return;

  const targetWidth = Math.max(Number.isFinite(minWidth) ? minWidth : 0, FULL_MIN_WIDTH);
  const targetHeight = Math.max(Number.isFinite(minHeight) ? minHeight : 0, FULL_MIN_HEIGHT);
  const bounds = mainWindow.getBounds();

  mainWindow.setResizable(true);
  mainWindow.setMinimumSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT);
  setMainWindowBoundsClamped(
    {
      x: bounds.x,
      y: bounds.y,
      width: targetWidth,
      height: targetHeight,
    },
    { persist: true, areaType: 'display' }
  );
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  unregisterAll();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
