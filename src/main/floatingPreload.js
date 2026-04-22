const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('floatingAPI', {
  expand: () => ipcRenderer.send('expand-from-floating'),
  toggle: () => ipcRenderer.send('toggle-floating-minimize'),
  timerAction: (action) => ipcRenderer.send('floating-timer-action', action),
  breakAction: (action) => ipcRenderer.send('floating-break-action', action),
  openContextMenu: () => ipcRenderer.send('floating-context-menu'),
  reentryAction: (action, payload = {}) => ipcRenderer.send('floating-reentry-action', { action, payload }),
  setPromptStage: (stage) => ipcRenderer.send('floating-reentry-stage', stage),
  dragStart: () => ipcRenderer.send('floating-icon-drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('floating-icon-drag-move', { dx, dy }),
  dragEnd: () => ipcRenderer.send('floating-icon-drag-end'),
  onPulse: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('floating-icon-pulse', handler);
    return () => ipcRenderer.removeListener('floating-icon-pulse', handler);
  },
  onState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('floating-state', handler);
    return () => ipcRenderer.removeListener('floating-state', handler);
  },
});
