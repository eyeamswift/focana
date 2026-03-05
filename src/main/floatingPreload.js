const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('floatingAPI', {
  expand: () => ipcRenderer.send('expand-from-floating'),
  toggle: () => ipcRenderer.send('toggle-floating-minimize'),
  dragStart: () => ipcRenderer.send('floating-icon-drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('floating-icon-drag-move', { dx, dy }),
  dragEnd: () => ipcRenderer.send('floating-icon-drag-end'),
  onPulse: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('floating-icon-pulse', handler);
    return () => ipcRenderer.removeListener('floating-icon-pulse', handler);
  },
});
