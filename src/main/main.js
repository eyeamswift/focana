const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const store = require('./store');
const { registerShortcuts, unregisterAll } = require('./shortcuts');
const { createTray } = require('./tray');

let mainWindow = null;

const isDev = !app.isPackaged;

function createWindow() {
  const windowState = store.get('windowState', { x: 100, y: 100, width: 400, height: 220 });

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    backgroundColor: '#FFFEF8',
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

  // Save window position on move
  mainWindow.on('moved', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      store.set('windowState', bounds);
    }
  });

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
