const DEFAULT_FOCUS_FACT_EMAIL_API_URL = 'https://focana.app/api/focus-fact-email'
const REQUEST_TIMEOUT_MS = 15 * 1000

function clampText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function normalizeEmail(value) {
  const email = clampText(value, 320).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function normalizeFocusFactEmailRequest(rawRequest) {
  if (!rawRequest || typeof rawRequest !== 'object' || Array.isArray(rawRequest)) return null
  const email = normalizeEmail(rawRequest.email)
  const factId = clampText(rawRequest.factId, 80)
  const requestId = clampText(rawRequest.requestId, 120)
  if (!email || !factId || !requestId) return null
  return { email, factId, requestId }
}

async function requestFocusFactEmail(rawRequest, {
  endpointUrl = process.env.FOCANA_FOCUS_FACT_EMAIL_API_URL || DEFAULT_FOCUS_FACT_EMAIL_API_URL,
  fetchImpl = fetch,
} = {}) {
  const request = normalizeFocusFactEmailRequest(rawRequest)
  if (!request) throw new Error('Enter a valid email address and try again.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response
  try {
    response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('The request timed out. You can try again.')
    throw new Error('That email did not go through. You can try again.')
  } finally {
    clearTimeout(timeout)
  }

  let payload = null
  try {
    payload = JSON.parse(await response.text())
  } catch (_) {}
  if (!response.ok || payload?.accepted !== true) {
    throw new Error(typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : 'That email did not go through. You can try again.')
  }
  return { ok: true, accepted: true }
}

module.exports = {
  DEFAULT_FOCUS_FACT_EMAIL_API_URL,
  normalizeFocusFactEmailRequest,
  requestFocusFactEmail,
}
