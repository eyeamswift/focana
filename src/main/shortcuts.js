const { globalShortcut } = require('electron');

const registeredCustomShortcuts = new Set();
const registeredSpecialShortcuts = new Set();
const KEEP_FOR_LATER_ACCELERATOR = 'CommandOrControl+Shift+K';
const CHECK_IN_YES_ACCELERATOR = 'CommandOrControl+Shift+Y';

function unregisterShortcut(accelerator, registry) {
  if (!registry.has(accelerator)) return;

  try {
    globalShortcut.unregister(accelerator);
  } catch (e) {
    // Ignore errors from already-unregistered shortcuts
  }

  registry.delete(accelerator);
}

function unregisterShortcutRegistry(registry) {
  Array.from(registry).forEach((accelerator) => {
    unregisterShortcut(accelerator, registry);
  });
}

function unregisterAll() {
  unregisterShortcutRegistry(registeredCustomShortcuts);
  unregisterShortcutRegistry(registeredSpecialShortcuts);
}

function registerManagedShortcut(accelerator, callback, description, registry) {
  if (!accelerator) return false;
  if (registry.has(accelerator)) return true;

  try {
    const success = globalShortcut.register(accelerator, callback);
    if (success) {
      registry.add(accelerator);
      return true;
    }
    console.warn(`Failed to register shortcut ${accelerator} for ${description}.`);
  } catch (e) {
    console.warn(`Failed to register shortcut ${accelerator} for ${description}:`, e.message);
  }

  return false;
}

function resolveWindow(windowOrGetter) {
  if (typeof windowOrGetter === 'function') {
    return windowOrGetter();
  }
  return windowOrGetter;
}

function registerShortcuts(shortcuts, mainWindow) {
  unregisterShortcutRegistry(registeredCustomShortcuts);

  const actionMap = {
    startPause: 'startPause',
    newTask: 'newTask',
    toggleCompact: 'toggleCompact',
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

    registerManagedShortcut(
      electronAccelerator,
      () => {
        const targetWindow = resolveWindow(mainWindow);
        if (targetWindow && !targetWindow.isDestroyed()) {
          targetWindow.webContents.send('shortcut-triggered', actionMap[action]);
        }
      },
      action,
      registeredCustomShortcuts,
    );
  });
}

function resolveShortcutPayload(payloadOrFactory, fallbackPayload) {
  if (typeof payloadOrFactory === 'function') {
    const resolved = payloadOrFactory();
    return typeof resolved === 'undefined' ? fallbackPayload : resolved;
  }
  return typeof payloadOrFactory === 'undefined' ? fallbackPayload : payloadOrFactory;
}

function registerKeepForLaterShortcut(mainWindow, payloadOrFactory) {
  registerManagedShortcut(
    KEEP_FOR_LATER_ACCELERATOR,
    () => {
      const targetWindow = resolveWindow(mainWindow);
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send(
          'shortcut-triggered',
          resolveShortcutPayload(payloadOrFactory, 'openParkingLot'),
        );
      }
    },
    'Keep for Later',
    registeredSpecialShortcuts,
  );
}

function registerCheckInYesShortcut(mainWindow, payloadOrFactory) {
  registerManagedShortcut(
    CHECK_IN_YES_ACCELERATOR,
    () => {
      const targetWindow = resolveWindow(mainWindow);
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send(
          'scoped-checkin-shortcut',
          resolveShortcutPayload(payloadOrFactory, 'focused'),
        );
      }
    },
    'Check-in: Yes',
    registeredSpecialShortcuts,
  );
}

function unregisterCheckInYesShortcut() {
  unregisterShortcut(CHECK_IN_YES_ACCELERATOR, registeredSpecialShortcuts);
}

module.exports = {
  registerShortcuts,
  registerKeepForLaterShortcut,
  registerCheckInYesShortcut,
  unregisterCheckInYesShortcut,
  unregisterAll,
};
