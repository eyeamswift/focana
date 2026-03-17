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
      elapsedSeconds: { type: 'number', default: 0 },
      sessionStartedAt: { type: ['string', 'null'], default: null },
      timedSegmentStartElapsed: { type: 'number', default: 0 },
      timedSegmentDuration: { type: 'number', default: 0 },
      checkInTimedIndex: { type: 'number', default: 0 },
      checkInTimedPendingIndex: { type: ['number', 'null'], default: null },
      compactPulseTimedIndex: { type: 'number', default: 0 },
    },
    default: {
      mode: 'freeflow',
      seconds: 0,
      isRunning: false,
      initialTime: 0,
      elapsedSeconds: 0,
      sessionStartedAt: null,
      timedSegmentStartElapsed: 0,
      timedSegmentDuration: 0,
      checkInTimedIndex: 0,
      checkInTimedPendingIndex: null,
      compactPulseTimedIndex: 0,
    },
  },
  parkingLot: {
    type: 'array',
    default: [],
  },
  sessions: {
    type: 'array',
    default: [],
  },
  checkIns: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        timestamp: { type: 'string' },
        sessionId: { type: 'string' },
        taskText: { type: 'string' },
        elapsedMinutes: { type: 'number' },
        status: {
          type: 'string',
          enum: ['focused', 'completed', 'detour', 'missed'],
        },
        detourNote: { type: 'string' },
      },
    },
  },
  thoughts: {
    type: 'array',
    default: [],
  },
  feedbackQueue: {
    type: 'array',
    default: [],
  },
  userEmail: {
    type: 'string',
    default: '',
  },
  installId: {
    type: 'string',
    default: '',
  },
  emailPromptSkipped: {
    type: 'boolean',
    default: false,
  },
  license: {
    type: 'object',
    properties: {
      key: { type: 'string', default: '' },
      instanceId: { type: 'string', default: '' },
      status: { type: 'string', default: 'unlicensed' },
      activatedAt: { type: ['string', 'null'], default: null },
      lastValidatedAt: { type: ['string', 'null'], default: null },
      offlineGraceUntil: { type: ['string', 'null'], default: null },
      lastError: { type: ['string', 'null'], default: null },
      productId: { type: ['number', 'null'], default: null },
      variantId: { type: ['number', 'null'], default: null },
    },
    default: {},
  },
  settings: {
    type: 'object',
    properties: {
      theme: { type: 'string', default: 'light' },
      themeManual: { type: 'boolean', default: false },
      shortcuts: {
        type: 'object',
        default: {
          startPause: 'CommandOrControl+Shift+S',
          newTask: 'CommandOrControl+N',
          toggleCompact: 'CommandOrControl+Shift+I',
          completeTask: 'CommandOrControl+Enter',
          openParkingLot: 'CommandOrControl+Shift+P',
        },
      },
      pulseSettings: {
        type: 'object',
        default: {
          compactEnabled: true,
        },
      },
      shortcutsEnabled: { type: 'boolean', default: true },
      alwaysOnTop: { type: 'boolean', default: true },
      bringToFront: { type: 'boolean', default: true },
      keepTextAfterCompletion: { type: 'boolean', default: false },
      showTaskInCompactDefault: { type: 'boolean', default: true },
      showTaskInCompactCustomized: { type: 'boolean', default: false },
      mainScreenControlsEnabled: {
        type: 'object',
        default: {
          dnd: true,
          theme: true,
          parkingLot: true,
          history: true,
          restart: true,
          floatingMinimize: true,
        },
      },
      checkInEnabled: { type: 'boolean', default: true },
      checkInIntervalFreeflow: { type: 'number', default: 15 },
      checkInIntervalTimed: {
        type: 'array',
        default: [0.4, 0.8],
      },
      doNotDisturbEnabled: { type: 'boolean', default: false },
      doNotDisturbUntil: { type: ['string', 'null'], default: null },
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
const storeCwd = process.env.FOCANA_STORE_CWD;

const storeOptions = storeCwd
  ? { schema, cwd: storeCwd }
  : { schema };

try {
  store = new Store(storeOptions);
} catch (e) {
  console.error('Store initialization failed, resetting config:', e);
  try {
    const tempStore = storeCwd ? new Store({ cwd: storeCwd }) : new Store();
    tempStore.clear();
  } catch (_) {}
  store = new Store(storeOptions);
}

module.exports = store;
