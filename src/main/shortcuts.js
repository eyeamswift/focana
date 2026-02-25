const { globalShortcut } = require('electron');

let registeredShortcuts = [];

function unregisterAll() {
  registeredShortcuts.forEach((accelerator) => {
    try {
      globalShortcut.unregister(accelerator);
    } catch (e) {
      // Ignore errors from already-unregistered shortcuts
    }
  });
  registeredShortcuts = [];
}

function registerShortcuts(shortcuts, mainWindow) {
  unregisterAll();

  const actionMap = {
    startPause: 'startPause',
    newTask: 'newTask',
    toggleIncognito: 'toggleIncognito',
    completeTask: 'completeTask',
    openParkingLot: 'openParkingLot',
  };

  Object.entries(shortcuts).forEach(([action, accelerator]) => {
    if (!accelerator || !actionMap[action]) return;

    // Convert from display format (Cmd+Shift+S) to Electron format (CommandOrControl+Shift+S)
    const electronAccelerator = accelerator
      .replace(/Cmd/g, 'CommandOrControl')
      .replace(/⌘/g, 'CommandOrControl')
      .replace(/⇧/g, 'Shift')
      .replace(/⌥/g, 'Alt');

    try {
      const success = globalShortcut.register(electronAccelerator, () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shortcut-triggered', actionMap[action]);
        }
      });

      if (success) {
        registeredShortcuts.push(electronAccelerator);
      }
    } catch (e) {
      console.warn(`Failed to register shortcut ${electronAccelerator} for ${action}:`, e.message);
    }
  });
}

module.exports = { registerShortcuts, unregisterAll };
