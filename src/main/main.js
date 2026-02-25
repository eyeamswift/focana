const { app, BrowserWindow, ipcMain, Notification, screen } = require('electron');
const path = require('path');
const store = require('./store');
const { registerShortcuts, unregisterAll } = require('./shortcuts');
const { createTray } = require('./tray');

let mainWindow = null;
let isPillMode = false;
let lastFullBounds = null;
let isModalExpanded = false;
let preModalBounds = null;
let pillDragStart = null;

const isDev = !app.isPackaged;

function createWindow() {
  const windowState = store.get('windowState', { x: 100, y: 100, width: 400, height: 220 });

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    minWidth: 340,
    minHeight: 200,
    skipTaskbar: false,
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

  // Save window bounds on move or resize (skip during pill mode or modal expansion)
  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !isPillMode && !isModalExpanded) {
      store.set('windowState', mainWindow.getBounds());
    }
  };
  mainWindow.on('moved', saveBounds);
  mainWindow.on('resize', saveBounds);

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
    mainWindow.show();
    mainWindow.focus();
  }
});

// Shortcuts
ipcMain.on('register-shortcuts', (_event, shortcuts) => {
  if (mainWindow) {
    registerShortcuts(shortcuts, mainWindow);
  }
});

// Store
ipcMain.handle('store-get', (_event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (_event, key, value) => {
  store.set(key, value);
  return true;
});

// Notifications
ipcMain.on('show-notification', (_event, { title, body }) => {
  new Notification({ title, body }).show();
});

// Modal window expansion
ipcMain.handle('modal-opened', (_, minWidth, minHeight) => {
  if (mainWindow && !isPillMode) {
    if (!isModalExpanded) {
      preModalBounds = mainWindow.getBounds();
    }
    isModalExpanded = true;

    const newW = Math.max(preModalBounds.width, minWidth);
    const newH = Math.max(preModalBounds.height, minHeight);

    // Clamp position so the expanded window stays within the work area
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
    const clampedX = Math.min(preModalBounds.x, screenW - newW);
    const clampedY = Math.min(preModalBounds.y, screenH - newH);

    mainWindow.setBounds({
      x: Math.max(0, clampedX),
      y: Math.max(0, clampedY),
      width: newW,
      height: newH,
    });
  }
});

ipcMain.handle('modal-closed', () => {
  if (mainWindow && isModalExpanded && preModalBounds) {
    isModalExpanded = false;
    mainWindow.setBounds(preModalBounds);
    preModalBounds = null;
  }
});

// Pill mode resize
ipcMain.handle('enter-pill-mode', () => {
  if (mainWindow) {
    lastFullBounds = mainWindow.getBounds();
    isPillMode = true;
    mainWindow.setResizable(false);
    // Initial default size (brain + timer only, 44px pill + 8px vertical margins for drag)
    mainWindow.setSize(124, 52);
  }
});

// Dynamic pill width — called by renderer as content expands/contracts
ipcMain.handle('set-pill-width', (_, width) => {
  if (mainWindow && isPillMode) {
    mainWindow.setSize(Math.max(100, Math.round(width)), 52);
  }
});

// JS-based pill drag — renderer tracks mouse delta, main moves the window
ipcMain.on('pill-drag-start', () => {
  if (mainWindow && isPillMode) {
    const pos = mainWindow.getPosition();
    pillDragStart = { x: pos[0], y: pos[1] };
  }
});

ipcMain.on('pill-drag-move', (_, { dx, dy }) => {
  if (mainWindow && isPillMode && pillDragStart) {
    mainWindow.setPosition(
      Math.round(pillDragStart.x + dx),
      Math.round(pillDragStart.y + dy),
    );
  }
});

ipcMain.on('pill-drag-end', () => {
  pillDragStart = null;
});

ipcMain.handle('exit-pill-mode', () => {
  if (mainWindow) {
    isPillMode = false;
    mainWindow.setResizable(true);
    if (lastFullBounds) {
      mainWindow.setSize(lastFullBounds.width, lastFullBounds.height);
      lastFullBounds = null;
    } else {
      const saved = store.get('windowState', { width: 400, height: 220 });
      mainWindow.setSize(saved.width, saved.height);
    }
  }
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
