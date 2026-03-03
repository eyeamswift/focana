const Store = require('electron-store');

const schema = {
  currentTask: {
    type: 'object',
    properties: {
      text: { type: 'string', default: '' },
      contextNote: { type: 'string', default: '' },
      startedAt: { type: ['string', 'null'], default: null },
    },
    default: { text: '', contextNote: '', startedAt: null },
  },
  timerState: {
    type: 'object',
    properties: {
      mode: { type: 'string', default: 'freeflow' },
      seconds: { type: 'number', default: 0 },
      isRunning: { type: 'boolean', default: false },
      initialTime: { type: 'number', default: 0 },
    },
    default: { mode: 'freeflow', seconds: 0, isRunning: false, initialTime: 0 },
  },
  parkingLot: {
    type: 'array',
    default: [],
  },
  sessions: {
    type: 'array',
    default: [],
  },
  thoughts: {
    type: 'array',
    default: [],
  },
  settings: {
    type: 'object',
    properties: {
      theme: { type: 'string', default: 'light' },
      shortcuts: {
        type: 'object',
        default: {
          startPause: 'CommandOrControl+Shift+S',
          newTask: 'CommandOrControl+N',
          toggleIncognito: 'CommandOrControl+Shift+I',
          completeTask: 'CommandOrControl+Enter',
          openParkingLot: 'CommandOrControl+Shift+P',
        },
      },
      pulseSettings: {
        type: 'object',
        default: {
          timeAwarenessEnabled: true,
          timeAwarenessInterval: 30,
          celebrationEnabled: true,
          incognitoEnabled: true,
        },
      },
      shortcutsEnabled: { type: 'boolean', default: true },
      bringToFront: { type: 'boolean', default: true },
      keepTextAfterCompletion: { type: 'boolean', default: false },
      showTaskInCompactDefault: { type: 'boolean', default: true },
      showTaskInCompactCustomized: { type: 'boolean', default: false },
      launchOnStartup: { type: 'boolean', default: false },
    },
    default: {},
  },
  windowState: {
    type: 'object',
    properties: {
      x: { type: 'number', default: 100 },
      y: { type: 'number', default: 100 },
      width: { type: 'number', default: 400 },
      height: { type: 'number', default: 220 },
    },
    default: { x: 100, y: 100, width: 400, height: 220 },
  },
};

let store;
try {
  store = new Store({ schema });
} catch (e) {
  console.error('Store initialization failed, resetting config:', e);
  try {
    const tempStore = new Store();
    tempStore.clear();
  } catch (_) {}
  store = new Store({ schema });
}

module.exports = store;
