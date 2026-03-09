const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window control
  closeWindow: () => ipcRenderer.send('close-window'),
  restartApp: () => ipcRenderer.send('restart-app'),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  toggleFloatingMinimize: () => ipcRenderer.send('toggle-floating-minimize'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  bringToFront: () => ipcRenderer.send('bring-to-front'),

  // Shortcuts
  registerGlobalShortcuts: (shortcuts) => ipcRenderer.send('register-shortcuts', shortcuts),
  unregisterGlobalShortcuts: () => ipcRenderer.send('unregister-shortcuts'),
  onShortcut: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('shortcut-triggered', handler);
    return () => ipcRenderer.removeListener('shortcut-triggered', handler);
  },

  // Store (persistence)
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),

  // Modal window expansion
  modalOpened: (minWidth, minHeight) => ipcRenderer.invoke('modal-opened', minWidth, minHeight),
  modalClosed: () => ipcRenderer.invoke('modal-closed'),

  // Pill mode resize
  enterPillMode: () => ipcRenderer.invoke('enter-pill-mode'),
  exitPillMode: () => ipcRenderer.invoke('exit-pill-mode'),
  setPillWidth: (width) => ipcRenderer.invoke('set-pill-width', width),
  setPillSize: (size) => ipcRenderer.invoke('set-pill-size', size),
  startPillPulseResize: () => ipcRenderer.invoke('start-pill-pulse-resize'),
  endPillPulseResize: () => ipcRenderer.invoke('end-pill-pulse-resize'),
  ensureMainWindowSize: (minWidth, minHeight) => ipcRenderer.invoke('ensure-main-window-size', minWidth, minHeight),

  // Check-ins
  checkInAdd: (data) => ipcRenderer.invoke('checkin:add', data),
  checkInGetBySession: (sessionId) => ipcRenderer.invoke('checkin:getBySession', sessionId),
  checkInUpdate: (id, updates) => ipcRenderer.invoke('checkin:update', id, updates),

  // Do Not Disturb — tray ↔ renderer sync
  onDndToggle: (callback) => {
    const handler = (_event, enabled) => callback(enabled);
    ipcRenderer.on('dnd-toggled', handler);
    return () => ipcRenderer.removeListener('dnd-toggled', handler);
  },
  onTrayOpenHistory: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('tray-open-history', handler);
    return () => ipcRenderer.removeListener('tray-open-history', handler);
  },
  onTrayOpenParkingLot: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('tray-open-parking-lot', handler);
    return () => ipcRenderer.removeListener('tray-open-parking-lot', handler);
  },
  onTrayOpenSettings: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('tray-open-settings', handler);
    return () => ipcRenderer.removeListener('tray-open-settings', handler);
  },
  onTrayThemeSelect: (callback) => {
    const handler = (_event, theme) => callback(theme);
    ipcRenderer.on('tray-theme-select', handler);
    return () => ipcRenderer.removeListener('tray-theme-select', handler);
  },
  setDnd: (enabled) => ipcRenderer.send('set-dnd', enabled),

  // Pill drag (JS-based — CSS drag regions block mouse events)
  pillDragStart: () => ipcRenderer.send('pill-drag-start'),
  pillDragMove: (dx, dy) => ipcRenderer.send('pill-drag-move', { dx, dy }),
  pillDragEnd: () => ipcRenderer.send('pill-drag-end'),
});
