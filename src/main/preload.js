const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window control
  quitApp: () => ipcRenderer.send('quit-app'),
  forceQuitApp: () => ipcRenderer.send('force-quit-app'),
  hideApp: () => ipcRenderer.send('hide-app'),
  restartApp: () => ipcRenderer.send('restart-app'),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  toggleFloatingMinimize: () => ipcRenderer.send('toggle-floating-minimize'),
  getFloatingMinimized: () => ipcRenderer.invoke('get-floating-minimized'),
  restoreFromFloatingForTimeUp: () => ipcRenderer.invoke('restore-from-floating-for-time-up'),
  enterFloatingMinimize: (options) => ipcRenderer.invoke('enter-floating-minimize', options),
  exitFloatingForCompact: () => ipcRenderer.invoke('exit-floating-for-compact'),
  showMainWindowAfterStartup: (width, height) => ipcRenderer.invoke('show-main-window-after-startup', width, height),
  openCompactContextMenu: () => ipcRenderer.send('compact-context-menu'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('set-always-on-top', enabled),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  getLaunchAtLogin: () => ipcRenderer.invoke('launch-at-login:get'),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('launch-at-login:set', enabled),
  getStartupLaunchSource: () => ipcRenderer.invoke('startup:get-launch-source'),
  getPendingSystemEntryReveal: () => ipcRenderer.invoke('system-entry:get-pending-reveal'),
  beginSystemEntry: (source) => ipcRenderer.invoke('system-entry:begin', source),
  showSystemEntryWindow: () => ipcRenderer.invoke('system-entry:show-window'),
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  checkForAppUpdates: () => ipcRenderer.invoke('updates:check'),
  installAppUpdate: () => ipcRenderer.invoke('updates:install'),
  getRuntimeInfo: () => ipcRenderer.invoke('app:get-runtime-info'),
  getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
  activateLicense: (licenseKey) => ipcRenderer.invoke('license:activate', licenseKey),
  validateLicense: (options) => ipcRenderer.invoke('license:validate', options),
  deactivateLicense: () => ipcRenderer.invoke('license:deactivate'),
  getBillingCheckoutLinks: () => ipcRenderer.invoke('billing:get-checkout-links'),
  openBillingCheckout: (plan) => ipcRenderer.invoke('billing:open-checkout', plan),
  openExternalUrl: (url) => ipcRenderer.invoke('app:open-external-url', url),
  savePreferredName: (preferredName) => ipcRenderer.invoke('profile:save-preferred-name', preferredName),
  enqueueFeedback: (item) => ipcRenderer.invoke('feedback:enqueue', item),
  syncFeedbackQueue: () => ipcRenderer.invoke('feedback:sync'),
  bringToFront: (options) => ipcRenderer.send('bring-to-front', options),
  armFocusReturnSource: (source) => ipcRenderer.invoke('focus:arm-previous-app', source),
  returnFocusToPreviousApp: (source) => ipcRenderer.invoke('focus:return-previous-app', source),
  e2eSetFrontmostApp: (appInfo) => ipcRenderer.invoke('e2e:set-frontmost-app', appInfo),
  e2eGetLastActivatedApp: () => ipcRenderer.invoke('e2e:get-last-activated-app'),
  e2eGetLastBringToFrontPayload: () => ipcRenderer.invoke('e2e:get-last-bring-to-front-payload'),
  e2eGetLastExternalUrl: () => ipcRenderer.invoke('e2e:get-last-external-url'),

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

  // Modal window expansion
  modalOpened: (minWidth, minHeight) => ipcRenderer.invoke('modal-opened', minWidth, minHeight),
  modalClosed: () => ipcRenderer.invoke('modal-closed'),

  // Pill mode resize
  enterPillMode: (options) => ipcRenderer.invoke('enter-pill-mode', options),
  exitPillMode: (options) => ipcRenderer.invoke('exit-pill-mode', options),
  setPillWidth: (width) => ipcRenderer.invoke('set-pill-width', width),
  setPillSize: (size) => ipcRenderer.invoke('set-pill-size', size),
  capturePillRestoreBounds: () => ipcRenderer.invoke('capture-pill-restore-bounds'),
  beginCompactTransient: (source) => ipcRenderer.invoke('begin-compact-transient', { source }),
  endCompactTransient: (source, delayMs = 0) => ipcRenderer.invoke('end-compact-transient', { source, delayMs }),
  startPillPulseResize: () => ipcRenderer.invoke('start-pill-pulse-resize'),
  endPillPulseResize: () => ipcRenderer.invoke('end-pill-pulse-resize'),
  ensureMainWindowSize: (minWidth, minHeight) => ipcRenderer.invoke('ensure-main-window-size', minWidth, minHeight),

  // Check-ins
  checkInAdd: (data) => ipcRenderer.invoke('checkin:add', data),
  checkInGetBySession: (sessionId) => ipcRenderer.invoke('checkin:getBySession', sessionId),
  checkInUpdate: (id, updates) => ipcRenderer.invoke('checkin:update', id, updates),
  setCheckInShortcutState: (state) => ipcRenderer.send('set-checkin-shortcut-state', state),
  onScopedCheckInShortcut: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('scoped-checkin-shortcut', handler);
    return () => ipcRenderer.removeListener('scoped-checkin-shortcut', handler);
  },

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
  onFloatingTimerAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('floating-timer-action', handler);
    return () => ipcRenderer.removeListener('floating-timer-action', handler);
  },
  onFloatingReentryAction: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('floating-reentry-action', handler);
    return () => ipcRenderer.removeListener('floating-reentry-action', handler);
  },
  onFloatingBreakAction: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('floating-break-action', handler);
    return () => ipcRenderer.removeListener('floating-break-action', handler);
  },
  onSystemSuspendPaused: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('system-suspend-paused', handler);
    return () => ipcRenderer.removeListener('system-suspend-paused', handler);
  },
  onSystemEntryEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('system-entry-event', handler);
    return () => ipcRenderer.removeListener('system-entry-event', handler);
  },
  onSystemEntryReveal: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('system-entry-reveal', handler);
    return () => ipcRenderer.removeListener('system-entry-reveal', handler);
  },
  onSystemEntryOpenNow: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('system-entry-open-now', handler);
    return () => ipcRenderer.removeListener('system-entry-open-now', handler);
  },
  onQuitResidentInfoRequested: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('quit-resident-info-requested', handler);
    return () => ipcRenderer.removeListener('quit-resident-info-requested', handler);
  },
  onUpdateStateChange: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('updates:state-changed', handler);
    return () => ipcRenderer.removeListener('updates:state-changed', handler);
  },
  setDnd: (enabled) => ipcRenderer.send('set-dnd', enabled),

  // Floating pulse (renderer-driven timing)
  triggerFloatingPulse: () => ipcRenderer.send('trigger-floating-pulse'),
  setFloatingReentryState: (state) => ipcRenderer.send('set-floating-reentry-state', state),
  setFloatingBreakState: (state) => ipcRenderer.send('set-floating-break-state', state),

  // Pill drag (JS-based — CSS drag regions block mouse events)
  pillDragStart: () => ipcRenderer.send('pill-drag-start'),
  pillDragMove: (dx, dy) => ipcRenderer.send('pill-drag-move', { dx, dy }),
  pillDragEnd: () => ipcRenderer.send('pill-drag-end'),
});
