const DEFAULT_FEEDBACK_API_URL = 'https://focana.app/api/app-feedback'
const MAX_BATCH_SIZE = 25
const BASE_RETRY_MS = 30 * 1000
const MAX_RETRY_MS = 15 * 60 * 1000
const PERIODIC_SYNC_MS = 5 * 60 * 1000

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

function normalizeFeedbackItem(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return null

  const id = clampText(rawItem.id, 160)
  const sessionId = clampText(rawItem.sessionId, 160)
  const feedback = rawItem.feedback === 'down' ? 'down' : (rawItem.feedback === 'up' ? 'up' : null)
  if (!id || !feedback) return null

  return {
    id,
    sessionId: sessionId || null,
    feedback,
    surface: clampText(rawItem.surface, 80),
    completionType: clampText(rawItem.completionType, 40),
    sessionMode: rawItem.sessionMode === 'timed' ? 'timed' : 'freeflow',
    sessionDurationMinutes: Number.isFinite(Number(rawItem.sessionDurationMinutes))
      ? Number(rawItem.sessionDurationMinutes)
      : 0,
    clientCreatedAt: safeIso(rawItem.clientCreatedAt) || new Date().toISOString(),
    appVersion: clampText(rawItem.appVersion, 40),
    osVersion: clampText(rawItem.osVersion, 120),
    channel: clampText(rawItem.channel, 40),
    installId: clampText(rawItem.installId, 160),
    licenseInstanceId: clampText(rawItem.licenseInstanceId, 160) || null,
    syncStatus: normalizeSyncStatus(rawItem.syncStatus),
    attemptCount: Number.isFinite(Number(rawItem.attemptCount)) ? Math.max(0, Math.floor(Number(rawItem.attemptCount))) : 0,
    lastAttemptAt: safeIso(rawItem.lastAttemptAt),
    syncedAt: safeIso(rawItem.syncedAt),
    lastError: clampText(rawItem.lastError, 400) || null,
  }
}

function normalizeFeedbackQueue(rawQueue) {
  if (!Array.isArray(rawQueue)) return []
  return rawQueue
    .map(normalizeFeedbackItem)
    .filter(Boolean)
}

async function postFeedbackBatch(endpointUrl, items) {
  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ items }),
  })

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
      : `Feedback sync failed with status ${response.status}`
    throw new Error(message)
  }

  const acceptedIds = Array.isArray(payload?.acceptedIds)
    ? payload.acceptedIds.map((value) => clampText(value, 160)).filter(Boolean)
    : []

  return { acceptedIds }
}

function createFeedbackSyncService({ store, endpointUrl = process.env.FOCANA_FEEDBACK_API_URL || DEFAULT_FEEDBACK_API_URL } = {}) {
  let syncInFlight = null
  let retryTimeout = null
  let periodicInterval = null
  let retryDelayMs = BASE_RETRY_MS
  let nextAllowedSyncAt = 0

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
    const normalized = normalizeFeedbackQueue(store.get('feedbackQueue', []))
    store.set('feedbackQueue', normalized)
    return normalized
  }

  function writeQueue(nextQueue) {
    store.set('feedbackQueue', normalizeFeedbackQueue(nextQueue))
  }

  function requestSync(reason = 'manual') {
    void syncNow({ reason })
  }

  async function syncNow({ reason = 'manual' } = {}) {
    if (!endpointUrl) {
      return { ok: false, skipped: true, reason: 'missing-endpoint' }
    }

    if (syncInFlight) return syncInFlight

    if (Date.now() < nextAllowedSyncAt) {
      return { ok: false, skipped: true, reason: 'backoff' }
    }

    syncInFlight = (async () => {
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
        const { acceptedIds } = await postFeedbackBatch(endpointUrl, pendingItems)
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
            lastError: 'Feedback sync was not acknowledged by the server.',
          }
        })

        writeQueue(syncedQueue)
        retryDelayMs = BASE_RETRY_MS
        nextAllowedSyncAt = 0
        clearRetryTimeout()
        return { ok: true, synced: acceptedIds.length, attempted: pendingItems.length, reason }
      } catch (error) {
        const message = clampText(error?.message, 400) || 'Could not sync feedback right now.'
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
        nextAllowedSyncAt = Date.now() + retryDelayMs
        scheduleRetry(retryDelayMs)
        retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS)
        return { ok: false, error: message, attempted: pendingItems.length, reason }
      } finally {
        syncInFlight = null
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
    requestSync,
    start,
    stop,
    syncNow,
  }
}

module.exports = {
  createFeedbackSyncService,
}
