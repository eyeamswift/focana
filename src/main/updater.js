const { EventEmitter } = require('events');

function getUpdateChannel(version) {
  const rawVersion = typeof version === 'string' ? version.trim() : '';
  const prereleaseMatch = rawVersion.match(/-([0-9A-Za-z-]+)/);
  if (!prereleaseMatch) return 'latest';
  return prereleaseMatch[1].split('.')[0].toLowerCase() || 'latest';
}

function normalizeReleaseNotes(input) {
  if (typeof input === 'string') {
    return input.trim() || null;
  }

  if (!Array.isArray(input)) {
    return null;
  }

  const notes = input
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry.note === 'string') return entry.note.trim();
      return '';
    })
    .filter(Boolean);

  return notes.length > 0 ? notes.join('\n\n') : null;
}

function buildUpdateSnapshot(version, supported) {
  return {
    supported,
    currentVersion: version,
    channel: getUpdateChannel(version),
    provider: 'github',
    status: supported ? 'idle' : 'unsupported',
    availableVersion: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    downloadPercent: null,
    lastCheckedAt: null,
    lastCheckSource: null,
    lastCheckSucceeded: false,
    error: null,
  };
}

function buildUpdateInfo(version) {
  return {
    version,
    releaseName: `Focana ${version}`,
    releaseNotes: `Focana ${version} includes beta update improvements.`,
    releaseDate: new Date().toISOString(),
  };
}

class MockUpdater extends EventEmitter {
  constructor({ scenario = 'none', version = '9.9.9' } = {}) {
    super();
    this.autoDownload = true;
    this.autoInstallOnAppQuit = true;
    this.scenario = scenario;
    this.version = version;
  }

  async checkForUpdates() {
    this.emit('checking-for-update');
    await new Promise((resolve) => setTimeout(resolve, 20));

    if (this.scenario === 'error') {
      const error = new Error('Mock updater failed');
      this.emit('error', error);
      throw error;
    }

    if (this.scenario === 'available') {
      const updateInfo = buildUpdateInfo(this.version);
      this.emit('update-available', updateInfo);
      await new Promise((resolve) => setTimeout(resolve, 20));
      this.emit('download-progress', {
        percent: 67,
        bytesPerSecond: 1024 * 64,
        transferred: 67,
        total: 100,
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      this.emit('update-downloaded', updateInfo);
      return { updateInfo };
    }

    const currentInfo = buildUpdateInfo(this.version);
    this.emit('update-not-available', currentInfo);
    return { updateInfo: currentInfo };
  }

  quitAndInstall() {
    this.emit('before-quit-for-update');
  }
}

function getUserFacingUpdateError(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const code = typeof error?.code === 'string' ? error.code : '';

  if (code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' || message.includes('latest-mac.yml') || message.includes('beta-mac.yml')) {
    return 'Update metadata for this release was not found on GitHub. If you just published it, wait a minute and try again.';
  }

  if (code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND') {
    return 'Could not find a published update on GitHub.';
  }

  return 'Could not check for updates.';
}

function createUpdaterService({ app, Notification }) {
  const appVersion = app.getVersion();
  const mockScenario = process.env.FOCANA_E2E_UPDATER_SCENARIO || '';
  const supported = Boolean(mockScenario) || app.isPackaged;
  const notificationsEnabled = process.env.FOCANA_E2E !== '1';
  const snapshot = buildUpdateSnapshot(appVersion, supported);
  let currentState = supported
    ? snapshot
    : {
        ...snapshot,
        error: 'Auto-updates are only available in packaged builds.',
      };
  let mainWindow = null;
  let startupCheckTimer = null;
  let startupCheckScheduled = false;
  let checkPromise = null;
  let lastNotifiedVersion = null;

  const updater = supported
    ? (mockScenario
      ? new MockUpdater({
          scenario: mockScenario,
          version: process.env.FOCANA_E2E_UPDATER_VERSION || '9.9.9',
        })
      : require('electron-updater').autoUpdater)
    : null;

  function broadcastState() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.webContents.isLoading()) return;
    mainWindow.webContents.send('updates:state-changed', currentState);
  }

  function setState(patch) {
    currentState = { ...currentState, ...patch };
    broadcastState();
  }

  function getState() {
    return { ...currentState };
  }

  function attachWindow(window) {
    if (!window || window.isDestroyed()) return;
    mainWindow = window;
    const pushSnapshot = () => {
      if (!window.isDestroyed()) {
        window.webContents.send('updates:state-changed', currentState);
      }
    };

    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', pushSnapshot);
    } else {
      pushSnapshot();
    }

    window.on('closed', () => {
      if (mainWindow === window) {
        mainWindow = null;
      }
    });
  }

  function notifyUpdateReady(version) {
    if (!notificationsEnabled) return;
    if (!version || lastNotifiedVersion === version) return;
    if (!Notification || typeof Notification.isSupported !== 'function' || !Notification.isSupported()) return;

    lastNotifiedVersion = version;

    try {
      new Notification({
        title: 'Update Ready',
        body: `Focana ${version} is ready to install.`,
        silent: false,
      }).show();
    } catch (error) {
      console.error('Failed to show update-ready notification:', error);
    }
  }

  async function checkForUpdates({ userInitiated = false } = {}) {
    if (!supported || !updater) {
      return getState();
    }

    if (currentState.status === 'downloaded' || currentState.status === 'installing') {
      return getState();
    }

    if (checkPromise) {
      return checkPromise;
    }

    const lastCheckedAt = new Date().toISOString();
    setState({
      status: 'checking',
      error: null,
      downloadPercent: null,
      lastCheckedAt,
      lastCheckSource: userInitiated ? 'manual' : 'startup',
    });

    checkPromise = Promise.resolve()
      .then(() => updater.checkForUpdates())
      .then(() => getState())
      .catch((error) => {
        if (userInitiated) {
          setState({
            status: 'error',
            error: getUserFacingUpdateError(error),
            downloadPercent: null,
            lastCheckSucceeded: false,
          });
        } else {
          setState({
            status: 'idle',
            error: null,
            downloadPercent: null,
            lastCheckSucceeded: false,
          });
        }
        return getState();
      })
      .finally(() => {
        checkPromise = null;
      });

    return checkPromise;
  }

  async function quitAndInstall() {
    if (!supported || !updater || currentState.status !== 'downloaded') {
      return false;
    }

    setState({
      status: 'installing',
      error: null,
    });
    updater.quitAndInstall();
    return true;
  }

  function start() {
    if (!supported || !updater || startupCheckScheduled || process.env.FOCANA_DISABLE_AUTO_UPDATES === '1') {
      return;
    }

    startupCheckScheduled = true;
    startupCheckTimer = setTimeout(() => {
      startupCheckTimer = null;
      void checkForUpdates({ userInitiated: false });
    }, 1500);
  }

  if (updater) {
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = currentState.channel !== 'latest';
    if (currentState.channel !== 'latest') {
      updater.channel = currentState.channel;
    }

    updater.on('checking-for-update', () => {
      setState({
        status: 'checking',
        error: null,
      });
    });

    updater.on('update-available', (info) => {
      setState({
        status: 'downloading',
        availableVersion: info?.version || null,
        releaseName: info?.releaseName || null,
        releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
        releaseDate: info?.releaseDate || null,
        downloadPercent: 0,
        lastCheckSucceeded: true,
        error: null,
      });
    });

    updater.on('download-progress', (progress) => {
      const nextPercent = Number.isFinite(progress?.percent)
        ? Math.max(0, Math.min(100, Math.round(progress.percent)))
        : currentState.downloadPercent;

      setState({
        status: 'downloading',
        downloadPercent: nextPercent,
        error: null,
      });
    });

    updater.on('update-downloaded', (info) => {
      const version = info?.version || currentState.availableVersion || 'update';
      setState({
        status: 'downloaded',
        availableVersion: version,
        releaseName: info?.releaseName || currentState.releaseName,
        releaseNotes: normalizeReleaseNotes(info?.releaseNotes) || currentState.releaseNotes,
        releaseDate: info?.releaseDate || currentState.releaseDate,
        downloadPercent: 100,
        lastCheckSucceeded: true,
        error: null,
      });
      notifyUpdateReady(version);
    });

    updater.on('update-not-available', () => {
      setState({
        status: 'idle',
        availableVersion: null,
        releaseName: null,
        releaseNotes: null,
        releaseDate: null,
        downloadPercent: null,
        lastCheckSucceeded: true,
        error: null,
      });
    });

    updater.on('error', (error) => {
      const userInitiated = currentState.lastCheckSource === 'manual';
      if (userInitiated) {
        setState({
          status: 'error',
          error: getUserFacingUpdateError(error),
          downloadPercent: null,
          lastCheckSucceeded: false,
        });
      } else {
        setState({
          status: 'idle',
          error: null,
          downloadPercent: null,
          lastCheckSucceeded: false,
        });
      }
    });
  }

  return {
    attachWindow,
    checkForUpdates,
    getState,
    quitAndInstall,
    start,
    stop() {
      if (startupCheckTimer) {
        clearTimeout(startupCheckTimer);
        startupCheckTimer = null;
      }
    },
  };
}

module.exports = {
  createUpdaterService,
  getUpdateChannel,
};
