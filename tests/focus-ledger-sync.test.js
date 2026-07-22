const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createFocusLedgerSyncService,
  normalizeFocusLedgerQueueItem,
} = require('../src/main/focusLedgerSync');

function createMemoryStore(initialState = {}) {
  const state = { ...initialState };
  return {
    get(key, defaultValue) {
      return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : defaultValue;
    },
    set(key, value) {
      state[key] = value;
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}

test('normalizeFocusLedgerQueueItem derives stable queue ids by item type', () => {
  assert.deepEqual(normalizeFocusLedgerQueueItem({
    type: 'session',
    payload: { localSessionId: 'session-1' },
  }), {
    id: 'session:session-1',
    type: 'session',
    payload: { localSessionId: 'session-1' },
    syncStatus: 'pending',
    attemptCount: 0,
    lastAttemptAt: null,
    syncedAt: null,
    lastError: null,
  });

  assert.equal(normalizeFocusLedgerQueueItem({
    type: 'segment',
    payload: {},
  }), null);
});

test('focus ledger sync groups queue items and marks acknowledged items synced', async () => {
  const store = createMemoryStore();
  const requests = [];
  const service = createFocusLedgerSyncService({
    store,
    endpointUrl: 'https://example.test/focus-ledger',
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      return new Response(JSON.stringify({
        acceptedIds: [
          'session:session-1',
          'segment:segment-1',
          'checkin:checkin-1',
        ],
      }), { status: 200 });
    },
  });

  const result = await service.enqueueItems([
    {
      type: 'session',
      payload: { localSessionId: 'session-1', installId: 'install-1', startedAt: '2026-07-07T10:00:00.000Z' },
    },
    {
      type: 'segment',
      payload: { localSegmentId: 'segment-1', localSessionId: 'session-1' },
    },
    {
      type: 'checkin',
      payload: { localCheckinId: 'checkin-1', localSessionId: 'session-1' },
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].sessions.length, 1);
  assert.equal(requests[0].segments.length, 1);
  assert.equal(requests[0].checkins.length, 1);
  assert.equal(store.snapshot().focusLedgerQueue.every((item) => item.syncStatus === 'synced'), true);
});

test('focus ledger sync keeps failed items queued for retry', async () => {
  const store = createMemoryStore();
  const service = createFocusLedgerSyncService({
    store,
    endpointUrl: 'https://example.test/focus-ledger',
    fetchImpl: async () => new Response(JSON.stringify({ error: 'nope' }), { status: 500 }),
  });

  const result = await service.enqueueItems({
    type: 'session',
    payload: { localSessionId: 'session-1', installId: 'install-1', startedAt: '2026-07-07T10:00:00.000Z' },
  });
  service.stop();

  const queue = store.snapshot().focusLedgerQueue;
  assert.equal(result.ok, true);
  assert.equal(result.sync.ok, false);
  assert.equal(queue[0].syncStatus, 'failed');
  assert.match(queue[0].lastError, /nope/);
});
