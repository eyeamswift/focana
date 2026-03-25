const test = require('node:test');
const assert = require('node:assert/strict');

const { createLicenseService } = require('../src/main/licenseService');

function createMemoryStore(initialState = {}) {
  const state = { ...initialState };
  return {
    get(key, defaultValue) {
      return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : defaultValue;
    },
    set(key, value) {
      state[key] = value;
    },
  };
}

function createPackagedApp() {
  return {
    isPackaged: true,
    getVersion() {
      return '1.2.0';
    },
    getName() {
      return 'Focana';
    },
  };
}

test('packaged builds without Lemon config stay blocked by default', () => {
  const previous = process.env.FOCANA_ALLOW_DEV_TEST_LICENSE;
  delete process.env.FOCANA_ALLOW_DEV_TEST_LICENSE;

  try {
    const service = createLicenseService({
      app: createPackagedApp(),
      store: createMemoryStore(),
    });

    const status = service.getStatus();
    assert.equal(status.status, 'config_error');
    assert.equal(status.allowed, false);
  } finally {
    if (previous === undefined) {
      delete process.env.FOCANA_ALLOW_DEV_TEST_LICENSE;
    } else {
      process.env.FOCANA_ALLOW_DEV_TEST_LICENSE = previous;
    }
  }
});

test('packaged builds can opt into the local dev-test password without embedded Lemon config', async () => {
  const previous = process.env.FOCANA_ALLOW_DEV_TEST_LICENSE;
  process.env.FOCANA_ALLOW_DEV_TEST_LICENSE = '1';

  try {
    const service = createLicenseService({
      app: createPackagedApp(),
      store: createMemoryStore(),
    });

    const initialStatus = service.getStatus();
    assert.equal(initialStatus.status, 'unlicensed');
    assert.equal(initialStatus.allowed, false);

    const activatedStatus = await service.activateLicense('password');
    assert.equal(activatedStatus.status, 'active');
    assert.equal(activatedStatus.allowed, true);
    assert.match(activatedStatus.instanceId || '', /^dev-test-/);
  } finally {
    if (previous === undefined) {
      delete process.env.FOCANA_ALLOW_DEV_TEST_LICENSE;
    } else {
      process.env.FOCANA_ALLOW_DEV_TEST_LICENSE = previous;
    }
  }
});
