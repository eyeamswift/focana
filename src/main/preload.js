const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window control
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  bringToFront: () => ipcRenderer.send('bring-to-front'),

  // Shortcuts
  registerGlobalShortcuts: (shortcuts) => ipcRenderer.send('register-shortcuts', shortcuts),
  onShortcut: (callback) => {
    ipcRenderer.on('shortcut-triggered', (_event, action) => callback(action));
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

  // Pill drag (JS-based — CSS drag regions block mouse events)
  pillDragStart: () => ipcRenderer.send('pill-drag-start'),
  pillDragMove: (dx, dy) => ipcRenderer.send('pill-drag-move', { dx, dy }),
  pillDragEnd: () => ipcRenderer.send('pill-drag-end'),
});
