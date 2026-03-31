const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;
let dndEnabled = false;
let dndUntil = null;
let cachedMainWindow = null;
let onDndChange = null;
let onAlwaysOnTopChange = null;

function normalizeUntil(input) {
  if (!input) return null;
  const date = new Date(input);
  const ms = date.getTime();
  if (!Number.isFinite(ms) || ms <= Date.now()) return null;
  return date.toISOString();
}

function formatDndLabel() {
  if (!dndEnabled) return 'Do Not Disturb';
  if (!dndUntil) return 'Do Not Disturb On';

  const untilDate = new Date(dndUntil);
  if (Number.isNaN(untilDate.getTime())) return 'Do Not Disturb On';
  const label = untilDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Do Not Disturb Until ${label}`;
}

function notifyRenderer() {
  if (!cachedMainWindow || cachedMainWindow.isDestroyed()) return;
  cachedMainWindow.webContents.send('dnd-toggled', dndEnabled);
}

function requestDndChange(nextState, source) {
  if (typeof onDndChange === 'function') {
    onDndChange({ ...nextState, source });
  }
}

function requestAlwaysOnTopChange(enabled, source) {
  if (typeof onAlwaysOnTopChange === 'function') {
    onAlwaysOnTopChange({ enabled: Boolean(enabled), source });
  }
}

function buildDndMenuTemplate(source = 'tray') {
  return [
    {
      label: 'Turn DND Off',
      enabled: dndEnabled,
      click: () => requestDndChange({ enabled: false, until: null }, source),
    },
    {
      label: 'DND for 30 Minutes',
      click: () => requestDndChange({ enabled: true, until: new Date(Date.now() + (30 * 60 * 1000)).toISOString() }, source),
    },
    {
      label: 'DND for 1 Hour',
      click: () => requestDndChange({ enabled: true, until: new Date(Date.now() + (60 * 60 * 1000)).toISOString() }, source),
    },
    {
      label: 'DND Until Turned Off',
      click: () => requestDndChange({ enabled: true, until: null }, source),
    },
  ];
}

function buildTrayTemplate(mainWindow) {
  const alwaysOnTopEnabled = Boolean(
    mainWindow
      && !mainWindow.isDestroyed()
      && typeof mainWindow.isAlwaysOnTop === 'function'
      && mainWindow.isAlwaysOnTop()
  );

  return [
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Session History',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('tray-open-history');
      },
    },
    {
      label: 'Parking Lot',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('tray-open-parking-lot');
      },
    },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('tray-open-settings');
      },
    },
    {
      label: alwaysOnTopEnabled ? 'Disable Always on Top' : 'Enable Always on Top',
      click: () => {
        requestAlwaysOnTopChange(!alwaysOnTopEnabled, 'tray');
      },
    },
    {
      label: 'Light Mode',
      click: () => {
        mainWindow.webContents.send('tray-theme-select', 'light');
      },
    },
    {
      label: 'Dark Mode',
      click: () => {
        mainWindow.webContents.send('tray-theme-select', 'dark');
      },
    },
    { type: 'separator' },
    {
      label: formatDndLabel(),
      enabled: false,
    },
    ...buildDndMenuTemplate('tray'),
    { type: 'separator' },
    {
      label: 'Restart App',
      click: () => {
        app.relaunch();
        app.exit(0);
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ];
}

function rebuildMenu() {
  if (!tray || !cachedMainWindow) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayTemplate(cachedMainWindow)));
}

function createTray(mainWindow, options = {}) {
  cachedMainWindow = mainWindow;
  onDndChange = typeof options.onDndChange === 'function' ? options.onDndChange : null;
  onAlwaysOnTopChange = typeof options.onAlwaysOnTopChange === 'function' ? options.onAlwaysOnTopChange : null;

  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = createFallbackIcon();
    }
  } catch (e) {
    icon = createFallbackIcon();
  }

  icon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('Focana');

  rebuildMenu();

  tray.on('click', () => {
    tray.popUpContextMenu();
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu();
  });

  return tray;
}

function createFallbackIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        canvas[offset] = 245;
        canvas[offset + 1] = 158;
        canvas[offset + 2] = 11;
        canvas[offset + 3] = 255;
      } else {
        canvas[offset] = 0;
        canvas[offset + 1] = 0;
        canvas[offset + 2] = 0;
        canvas[offset + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function setDndState(nextState, nextUntil = null) {
  if (typeof nextState === 'object' && nextState !== null) {
    dndEnabled = Boolean(nextState.enabled);
    dndUntil = dndEnabled ? normalizeUntil(nextState.until) : null;
  } else {
    dndEnabled = Boolean(nextState);
    dndUntil = dndEnabled ? normalizeUntil(nextUntil) : null;
  }

  rebuildMenu();
  notifyRenderer();
}

function popupFloatingContextMenu(window, options = {}) {
  if (!window || window.isDestroyed()) return;
  const onExpand = typeof options.onExpand === 'function' ? options.onExpand : null;

  const menu = Menu.buildFromTemplate([
    {
      label: 'Expand',
      click: () => {
        onExpand?.();
      },
    },
    { type: 'separator' },
    {
      label: formatDndLabel(),
      enabled: false,
    },
    ...buildDndMenuTemplate('floating'),
  ]);

  menu.popup({ window });
}

function popupCompactContextMenu(window, options = {}) {
  if (!window || window.isDestroyed()) return;
  const onMinimize = typeof options.onMinimize === 'function' ? options.onMinimize : null;

  const menu = Menu.buildFromTemplate([
    {
      label: 'Minimize to Floating',
      click: () => {
        onMinimize?.();
      },
    },
    { type: 'separator' },
    {
      label: formatDndLabel(),
      enabled: false,
    },
    ...buildDndMenuTemplate('compact'),
  ]);

  menu.popup({ window });
}

function popupMainContextMenu(window) {
  if (!window || window.isDestroyed()) return;
  const menu = Menu.buildFromTemplate(buildTrayTemplate(window));
  menu.popup({ window });
}

function refreshTrayMenu() {
  rebuildMenu();
}

module.exports = { createTray, popupFloatingContextMenu, popupCompactContextMenu, popupMainContextMenu, refreshTrayMenu, setDndState };
