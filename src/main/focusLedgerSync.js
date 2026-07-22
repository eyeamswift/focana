const DEFAULT_FOCUS_LEDGER_API_URL = 'https://focana.app/api/app-focus-ledger'
const MAX_BATCH_SIZE = 100
const BASE_RETRY_MS = 30 * 1000
const MAX_RETRY_MS = 15 * 60 * 1000
const PERIODIC_SYNC_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15 * 1000

const LEDGER_TYPES = ['session', 'segment', 'checkin']

function clampText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function safeIso(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeSyncStatus(value) {
  return value === 'synced' || value === 'failed' ? value : 'pending'
}

function normalizePayload(rawPayload) {
  return rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
    ? { ...rawPayload }
    : null
}

function inferLocalId(type, payload) {
  if (type === 'session') return clampText(payload.localSessionId, 160)
  if (type === 'segment') return clampText(payload.localSegmentId, 180)
  if (type === 'checkin') return clampText(payload.localCheckinId, 180)
  return ''
}

function normalizeFocusLedgerQueueItem(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return null

  const type = LEDGER_TYPES.includes(rawItem.type) ? rawItem.type : ''
  const payload = normalizePayload(rawItem.payload)
  if (!type || !payload) return null

  const localId = inferLocalId(type, payload)
  if (!localId) return null

  const id = clampText(rawItem.id, 220) || `${type}:${localId}`
  return {
    id,
    type,
    payload,
    syncStatus: normalizeSyncStatus(rawItem.syncStatus),
    attemptCount: Number.isFinite(Number(rawItem.attemptCount)) ? Math.max(0, Math.floor(Number(rawItem.attemptCount))) : 0,
    lastAttemptAt: safeIso(rawItem.lastAttemptAt),
    syncedAt: safeIso(rawItem.syncedAt),
    lastError: clampText(rawItem.lastError, 400) || null,
  }
}

function normalizeFocusLedgerQueue(rawQueue) {
  if (!Array.isArray(rawQueue)) return []
  return rawQueue
    .map(normalizeFocusLedgerQueueItem)
    .filter(Boolean)
}

function buildBatchPayload(items) {
  return {
    sessions: items.filter((item) => item.type === 'session').map((item) => item.payload),
    segments: items.filter((item) => item.type === 'segment').map((item) => item.payload),
    checkins: items.filter((item) => item.type === 'checkin').map((item) => item.payload),
  }
}

async function postFocusLedgerBatch(endpointUrl, items, fetchImpl = fetch) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  let response
  try {
    response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(buildBatchPayload(items)),
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Focus ledger sync timed out.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch (_) {
    payload = null
  }

  if (!response.ok) {
    const message = typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : `Focus ledger sync failed with status ${response.status}`
    throw new Error(message)
  }

  const acceptedIds = Array.isArray(payload?.acceptedIds)
    ? payload.acceptedIds.map((value) => clampText(value, 220)).filter(Boolean)
    : []

  return { acceptedIds }
}

function createFocusLedgerSyncService({
  store,
  endpointUrl = process.env.FOCANA_FOCUS_LEDGER_API_URL || DEFAULT_FOCUS_LEDGER_API_URL,
  fetchImpl = fetch,
} = {}) {
  let syncInFlight = null
  let retryTimeout = null
  let periodicInterval = null
  let retryDelayMs = BASE_RETRY_MS
  let nextAllowedSyncAt = 0
  let followUpSyncRequested = false
  let followUpSyncReason = 'queued-follow-up'

  function clearRetryTimeout() {
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
  }

  function scheduleRetry(delayMs) {
    clearRetryTimeout()
    retryTimeout = setTimeout(() => {
      void syncNow({ reason: 'retry-timeout' })
    }, delayMs)
  }

  function readQueue() {
    const normalized = normalizeFocusLedgerQueue(store.get('focusLedgerQueue', []))
    store.set('focusLedgerQueue', normalized)
    return normalized
  }

  function writeQueue(nextQueue) {
    store.set('focusLedgerQueue', normalizeFocusLedgerQueue(nextQueue))
  }

  function writeSyncState(patch) {
    const current = store.get('focusLedgerSyncState', {})
    store.set('focusLedgerSyncState', {
      ...(current && typeof current === 'object' ? current : {}),
      ...patch,
    })
  }

  async function enqueueItems(rawItems, reason = 'manual-enqueue') {
    const rawList = Array.isArray(rawItems) ? rawItems : [rawItems]
    const nextItems = rawList.map(normalizeFocusLedgerQueueItem).filter(Boolean)
    if (!nextItems.length) {
      return { ok: false, error: 'Invalid focus ledger item.' }
    }

    const queue = readQueue()
    const nextIdSet = new Set(nextItems.map((item) => item.id))
    writeQueue([
      ...queue.filter((item) => !nextIdSet.has(item.id)),
      ...nextItems,
    ])

    const sync = await syncNow({ reason, ignoreBackoff: true })
    return { ok: true, items: nextItems, sync }
  }

  function requestSync(reason = 'manual') {
    if (syncInFlight) {
      followUpSyncRequested = true
      followUpSyncReason = reason
      return syncInFlight
    }
    return startSyncCycle({ reason })
  }

  async function syncNow({ reason = 'manual', ignoreBackoff = false } = {}) {
    if (!endpointUrl) {
      return { ok: false, skipped: true, reason: 'missing-endpoint' }
    }

    if (syncInFlight) {
      followUpSyncRequested = true
      followUpSyncReason = reason
      return syncInFlight
    }

    return startSyncCycle({ reason, ignoreBackoff })
  }

  function startSyncCycle({ reason = 'manual', ignoreBackoff = false } = {}) {
    if (!endpointUrl) {
      return Promise.resolve({ ok: false, skipped: true, reason: 'missing-endpoint' })
    }

    if (!ignoreBackoff && Date.now() < nextAllowedSyncAt) {
      return Promise.resolve({ ok: false, skipped: true, reason: 'backoff' })
    }

    syncInFlight = (async () => {
      try {
        const queue = readQueue()
        const pendingItems = queue.filter((item) => item.syncStatus !== 'synced').slice(0, MAX_BATCH_SIZE)
        if (pendingItems.length === 0) {
          retryDelayMs = BASE_RETRY_MS
          nextAllowedSyncAt = 0
          clearRetryTimeout()
          return { ok: true, synced: 0, reason }
        }

        const attemptedIds = new Set(pendingItems.map((item) => item.id))
        const attemptTimestamp = new Date().toISOString()
        writeQueue(queue.map((item) => (
          attemptedIds.has(item.id)
            ? {
              ...item,
              attemptCount: (item.attemptCount || 0) + 1,
              lastAttemptAt: attemptTimestamp,
              lastError: null,
              syncStatus: item.syncStatus === 'synced' ? 'synced' : 'pending',
            }
            : item
        )))

        try {
          const { acceptedIds } = await postFocusLedgerBatch(endpointUrl, pendingItems, fetchImpl)
          const acceptedIdSet = new Set(acceptedIds)
          const syncedAt = new Date().toISOString()
          const syncedQueue = readQueue().map((item) => {
            if (!attemptedIds.has(item.id) || item.syncStatus === 'synced') {
              return item
            }
            if (acceptedIdSet.has(item.id)) {
              return {
                ...item,
                syncStatus: 'synced',
                syncedAt,
                lastError: null,
              }
            }
            return {
              ...item,
              syncStatus: 'failed',
              lastError: 'Focus ledger sync was not acknowledged by the server.',
            }
          })

          writeQueue(syncedQueue)
          writeSyncState({ lastSyncAt: new Date().toISOString(), lastError: null })
          retryDelayMs = BASE_RETRY_MS
          nextAllowedSyncAt = 0
          clearRetryTimeout()
          return { ok: true, synced: acceptedIds.length, attempted: pendingItems.length, reason }
        } catch (error) {
          const message = clampText(error?.message, 400) || 'Could not sync focus ledger right now.'
          const failedQueue = readQueue().map((item) => (
            attemptedIds.has(item.id) && item.syncStatus !== 'synced'
              ? {
                ...item,
                syncStatus: 'failed',
                lastError: message,
              }
              : item
          ))
          writeQueue(failedQueue)
          writeSyncState({ lastError: message })
          nextAllowedSyncAt = Date.now() + retryDelayMs
          scheduleRetry(retryDelayMs)
          retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS)
          return { ok: false, error: message, attempted: pendingItems.length, reason }
        }
      } finally {
        syncInFlight = null
        if (followUpSyncRequested) {
          const nextReason = followUpSyncReason
          followUpSyncRequested = false
          followUpSyncReason = 'queued-follow-up'
          queueMicrotask(() => {
            void syncNow({ reason: nextReason })
          })
        }
      }
    })()

    return syncInFlight
  }

  function start() {
    if (!endpointUrl) return
    clearRetryTimeout()
    if (!periodicInterval) {
      periodicInterval = setInterval(() => {
        void syncNow({ reason: 'periodic' })
      }, PERIODIC_SYNC_MS)
    }
    void syncNow({ reason: 'startup' })
  }

  function stop() {
    clearRetryTimeout()
    if (periodicInterval) {
      clearInterval(periodicInterval)
      periodicInterval = null
    }
  }

  return {
    enqueueItems,
    requestSync,
    start,
    stop,
    syncNow,
  }
}

module.exports = {
  createFocusLedgerSyncService,
  normalizeFocusLedgerQueue,
  normalizeFocusLedgerQueueItem,
}
