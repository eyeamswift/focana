const os = require('node:os')
const crypto = require('node:crypto')
const { licenseConfig, isLicenseConfigComplete } = require('./licenseConfig')
const { getUpdateChannel } = require('./updater')

const LICENSE_API_BASE_URL = 'https://api.lemonsqueezy.com/v1/licenses'
const DEV_TEST_LICENSE_KEY = 'password'

function isDevRuntime(app) {
  return process.env.FOCANA_E2E === '1' || process.env.FOCANA_DEV === '1' || !app.isPackaged
}

function isLicenseGateForced() {
  return process.env.FOCANA_FORCE_LICENSE_GATE === '1'
}

function shouldResetLicenseState() {
  return process.env.FOCANA_RESET_LICENSE === '1'
}

function isForcedDevLicenseFlow(app) {
  return isDevRuntime(app) && isLicenseGateForced()
}

function addHours(date, hours) {
  const copy = new Date(date)
  copy.setHours(copy.getHours() + hours)
  return copy
}

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function safeIsoDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function maskLicenseKey(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return ''
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)}-${raw.slice(-4)}`
}

function buildInstanceName(app, installId) {
  const hostname = String(os.hostname() || 'Mac').trim() || 'Mac'
  return `${app.getName()} on ${hostname} (${installId.slice(0, 8)})`
}

function normalizeStoredLicense(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      key: '',
      instanceId: '',
      status: 'unlicensed',
      activatedAt: null,
      lastValidatedAt: null,
      offlineGraceUntil: null,
      lastError: null,
      productId: null,
      variantId: null,
    }
  }

  return {
    key: typeof raw.key === 'string' ? raw.key : '',
    instanceId: typeof raw.instanceId === 'string' ? raw.instanceId : '',
    status: typeof raw.status === 'string' ? raw.status : 'unlicensed',
    activatedAt: safeIsoDate(raw.activatedAt),
    lastValidatedAt: safeIsoDate(raw.lastValidatedAt),
    offlineGraceUntil: safeIsoDate(raw.offlineGraceUntil),
    lastError: typeof raw.lastError === 'string' && raw.lastError.trim() ? raw.lastError : null,
    productId: Number.isFinite(Number(raw.productId)) ? Number(raw.productId) : null,
    variantId: Number.isFinite(Number(raw.variantId)) ? Number(raw.variantId) : null,
  }
}

function extractLicenseMeta(payload) {
  const licenseKey = payload?.license_key || payload?.data?.attributes || payload?.data || {}
  const meta = payload?.meta || {}
  const instance = payload?.instance || payload?.activated_instance || meta.instance || {}

  const storeId = Number(
    licenseKey.store_id
    ?? meta.store_id
    ?? meta.storeId
    ?? payload?.store_id
    ?? 0
  ) || null
  const productId = Number(
    licenseKey.product_id
    ?? meta.product_id
    ?? meta.productId
    ?? payload?.product_id
    ?? 0
  ) || null
  const variantId = Number(
    licenseKey.variant_id
    ?? meta.variant_id
    ?? meta.variantId
    ?? payload?.variant_id
    ?? 0
  ) || null
  const instanceId = String(
    instance.id
    ?? instance.instance_id
    ?? payload?.instance_id
    ?? ''
  ).trim()
  const valid = payload?.valid ?? payload?.activated ?? meta.valid ?? meta.activated ?? null
  const disabled = payload?.disabled ?? licenseKey.disabled ?? meta.disabled ?? false
  const licenseStatus = String(licenseKey.status || payload?.status || '').trim().toLowerCase() || null

  return {
    storeId,
    productId,
    variantId,
    instanceId,
    valid: typeof valid === 'boolean' ? valid : null,
    disabled: Boolean(disabled),
    licenseStatus,
  }
}

function getApiErrorMessage(payload, fallback) {
  const candidates = [
    payload?.error,
    payload?.message,
    payload?.errors?.[0]?.detail,
    payload?.errors?.[0]?.title,
  ]
    .filter((entry) => typeof entry === 'string' && entry.trim())

  return candidates[0] || fallback
}

async function postLicenseForm(endpoint, params) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    body.set(key, String(value))
  }

  const response = await fetch(`${LICENSE_API_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body,
  })

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch (_) {
    payload = null
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `License request failed with status ${response.status}`))
  }

  return payload || {}
}

function mapActivationError(error) {
  const message = typeof error?.message === 'string' ? error.message : 'Could not activate this key.'
  const lower = message.toLowerCase()

  if (lower.includes('activation') && lower.includes('limit')) {
    return 'This key is already activated on another Mac. Deactivate the old Mac in Settings or contact support.'
  }
  if (lower.includes('disabled') || lower.includes('inactive')) {
    return 'This license is not active. Contact support if you think this is a mistake.'
  }
  if (lower.includes('expired')) {
    return 'This license has expired and cannot activate this Mac.'
  }
  if (lower.includes('invalid')) {
    return 'That license key was not recognized. Double-check the key from your Lemon receipt email.'
  }
  return message
}

function mapValidationError(error) {
  const message = typeof error?.message === 'string' ? error.message : 'Could not validate this license.'
  const lower = message.toLowerCase()

  if (lower.includes('invalid')) {
    return 'This license is no longer valid for Focana.'
  }
  if (lower.includes('disabled') || lower.includes('inactive')) {
    return 'This license has been disabled. Contact support if you need help.'
  }
  if (lower.includes('expired')) {
    return 'This license has expired for Focana.'
  }
  return message
}

function isDevTestLicenseAllowed(app) {
  return isDevRuntime(app)
}

function isStoredDevTestLicense(stored) {
  const key = typeof stored?.key === 'string' ? stored.key.trim() : ''
  const instanceId = typeof stored?.instanceId === 'string' ? stored.instanceId.trim() : ''
  return key === DEV_TEST_LICENSE_KEY || instanceId.startsWith('dev-test-')
}

function isRecoverableValidationError(error) {
  const message = typeof error?.message === 'string' ? error.message : ''
  const lower = message.toLowerCase()

  if (!lower) return true

  const nonRecoverableFragments = [
    'invalid',
    'not found',
    'disabled',
    'inactive',
    'expired',
    'not recognized',
    'no longer valid',
  ]

  return !nonRecoverableFragments.some((fragment) => lower.includes(fragment))
}

function createLicenseService({ app, store }) {
  let devLicenseStateReset = false

  function getRuntimeInfo() {
    const version = app.getVersion()
    const channel = getUpdateChannel(version)
    const licenseEnforced = isLicenseGateForced() || !isDevRuntime(app)
    const osVersion = typeof os.version === 'function' ? os.version() : os.release()
    return {
      version,
      osVersion,
      channel,
      licenseEnforced,
      licenseGateForced: isLicenseGateForced(),
      validationIntervalHours: licenseConfig.validationIntervalHours,
      offlineGraceDays: licenseConfig.offlineGraceDays,
      licenseConfigured: !licenseEnforced || isLicenseConfigComplete(),
    }
  }

  function ensureInstallId() {
    const existing = store.get('installId', '')
    if (typeof existing === 'string' && existing.trim()) {
      return existing.trim()
    }

    const nextId = crypto.randomUUID()
    store.set('installId', nextId)
    return nextId
  }

  function getStoredLicense() {
    return normalizeStoredLicense(store.get('license', {}))
  }

  function setStoredLicense(nextLicense) {
    store.set('license', normalizeStoredLicense(nextLicense))
    return getStoredLicense()
  }

  function clearStoredLicense(lastError = null, status = 'unlicensed') {
    return setStoredLicense({
      key: '',
      instanceId: '',
      status,
      activatedAt: null,
      lastValidatedAt: null,
      offlineGraceUntil: null,
      lastError,
      productId: null,
      variantId: null,
    })
  }

  function resetDevLicenseStateIfNeeded() {
    if (devLicenseStateReset) return
    if (!isLicenseGateForced() || !shouldResetLicenseState()) return
    clearStoredLicense(null, 'unlicensed')
    devLicenseStateReset = true
  }

  function buildStatus(overrides = {}) {
    resetDevLicenseStateIfNeeded()
    const runtime = getRuntimeInfo()
    const installId = ensureInstallId()
    const stored = { ...getStoredLicense(), ...overrides }
    const now = new Date()
    const lastValidatedAt = safeIsoDate(stored.lastValidatedAt)
    const offlineGraceUntil = safeIsoDate(stored.offlineGraceUntil)
    const validationDueAt = lastValidatedAt
      ? addHours(new Date(lastValidatedAt), licenseConfig.validationIntervalHours).toISOString()
      : null
    const validationDue = !lastValidatedAt || new Date(validationDueAt) <= now
    const withinGrace = Boolean(offlineGraceUntil && new Date(offlineGraceUntil) > now)
    const keyPresent = Boolean(stored.key)
    const instanceId = stored.instanceId || ''
    const usingForcedDevFlow = isForcedDevLicenseFlow(app)
    const usingDevTestLicense = usingForcedDevFlow && instanceId.startsWith('dev-test-')
    const configured = runtime.licenseConfigured || usingForcedDevFlow || usingDevTestLicense
    let status = stored.status || 'unlicensed'
    const packagedDevTestLicense = runtime.licenseEnforced && !isDevRuntime(app) && isStoredDevTestLicense(stored)

    if (!runtime.licenseEnforced) {
      status = 'not_required'
    } else if (packagedDevTestLicense) {
      status = 'unlicensed'
    } else if (!configured) {
      status = 'config_error'
    } else if (!keyPresent || !instanceId) {
      status = 'unlicensed'
    } else if (status === 'offline_grace' && !withinGrace) {
      status = 'error'
    }

    const allowed = !runtime.licenseEnforced || status === 'active' || (status === 'offline_grace' && withinGrace)
    const shouldValidateInForeground = runtime.licenseEnforced
      && configured
      && keyPresent
      && Boolean(instanceId)
      && validationDue
      && !packagedDevTestLicense

    return {
      version: runtime.version,
      channel: runtime.channel,
      licenseEnforced: runtime.licenseEnforced,
      licenseConfigured: configured,
      validationIntervalHours: runtime.validationIntervalHours,
      offlineGraceDays: runtime.offlineGraceDays,
      installId,
      status,
      allowed,
      keyPresent: packagedDevTestLicense ? false : keyPresent,
      maskedKey: packagedDevTestLicense ? '' : maskLicenseKey(stored.key),
      instanceId: packagedDevTestLicense ? null : instanceId || null,
      activatedAt: safeIsoDate(stored.activatedAt),
      lastValidatedAt,
      offlineGraceUntil,
      validationDueAt,
      validationDue,
      withinGrace,
      shouldValidateInForeground,
      lastError: packagedDevTestLicense ? null : stored.lastError,
      productId: packagedDevTestLicense ? null : stored.productId || null,
      variantId: packagedDevTestLicense ? null : stored.variantId || null,
    }
  }

  function verifyLicenseOwnership(meta) {
    if (!isLicenseConfigComplete()) {
      return {
        ok: false,
        reason: 'This build is missing Lemon licensing configuration.',
      }
    }

    if (!meta.storeId || meta.storeId !== licenseConfig.storeId) {
      return {
        ok: false,
        reason: 'This key belongs to a different Lemon store.',
      }
    }

    if (!meta.productId || meta.productId !== licenseConfig.productId) {
      return {
        ok: false,
        reason: 'This key is not for this Focana product.',
      }
    }

    if (!meta.variantId || !licenseConfig.variantIds.includes(meta.variantId)) {
      return {
        ok: false,
        reason: 'This key is not for an allowed Focana variant.',
      }
    }

    return { ok: true, reason: null }
  }

  async function activateLicense(rawKey) {
    const runtime = getRuntimeInfo()
    const key = typeof rawKey === 'string' ? rawKey.trim() : ''

    if (isDevTestLicenseAllowed(app) && key === DEV_TEST_LICENSE_KEY) {
      const now = new Date().toISOString()
      const nextGrace = addDays(new Date(now), licenseConfig.offlineGraceDays).toISOString()
      const installId = ensureInstallId()
      setStoredLicense({
        key,
        instanceId: `dev-test-${installId}`,
        status: 'active',
        activatedAt: now,
        lastValidatedAt: now,
        offlineGraceUntil: nextGrace,
        lastError: null,
        productId: licenseConfig.productId,
        variantId: licenseConfig.variantIds[0] || null,
      })
      return buildStatus()
    }

    if (isForcedDevLicenseFlow(app)) {
      if (!key) {
        return buildStatus({ status: 'unlicensed', lastError: 'Enter a license key from your Lemon receipt email.' })
      }

      return buildStatus({
        status: 'invalid',
        lastError: 'That license key was not recognized. Double-check the key from your Lemon Squeezy receipt email.',
      })
    }

    if (!runtime.licenseEnforced) {
      return buildStatus()
    }

    if (!runtime.licenseConfigured) {
      return buildStatus({ status: 'config_error', lastError: 'This build is missing Lemon licensing configuration.' })
    }

    if (!key) {
      return buildStatus({ status: 'unlicensed', lastError: 'Enter a license key from your Lemon receipt email.' })
    }

    const installId = ensureInstallId()

    try {
      const payload = await postLicenseForm('activate', {
        license_key: key,
        instance_name: buildInstanceName(app, installId),
      })
      const meta = extractLicenseMeta(payload)
      const ownership = verifyLicenseOwnership(meta)
      const activated = payload?.activated ?? meta.valid ?? false

      if (!activated || !meta.instanceId || meta.licenseStatus === 'disabled' || meta.licenseStatus === 'expired') {
        return buildStatus({ status: 'error', lastError: 'Lemon did not activate this key for this Mac.' })
      }

      if (!ownership.ok) {
        return clearStoredLicense(ownership.reason, 'invalid')
      }

      const now = new Date().toISOString()
      const nextGrace = addDays(new Date(now), licenseConfig.offlineGraceDays).toISOString()
      setStoredLicense({
        key,
        instanceId: meta.instanceId,
        status: 'active',
        activatedAt: now,
        lastValidatedAt: now,
        offlineGraceUntil: nextGrace,
        lastError: null,
        productId: meta.productId,
        variantId: meta.variantId,
      })

      return buildStatus()
    } catch (error) {
      return buildStatus({
        status: 'error',
        lastError: mapActivationError(error),
      })
    }
  }

  async function validateLicense({ force = false } = {}) {
    const runtime = getRuntimeInfo()
    const currentStatus = buildStatus()
    if (!runtime.licenseEnforced) {
      return currentStatus
    }

    if (!runtime.licenseConfigured) {
      return buildStatus({ status: 'config_error', lastError: 'This build is missing Lemon licensing configuration.' })
    }

    const stored = getStoredLicense()
    if (runtime.licenseEnforced && !isDevRuntime(app) && isStoredDevTestLicense(stored)) {
      return clearStoredLicense(null, 'unlicensed')
    }

    if (!stored.key || !stored.instanceId) {
      return buildStatus({ status: 'unlicensed' })
    }

    if (!force && !currentStatus.validationDue) {
      return currentStatus
    }

    try {
      const payload = await postLicenseForm('validate', {
        license_key: stored.key,
        instance_id: stored.instanceId,
      })
      const meta = extractLicenseMeta(payload)
      const ownership = verifyLicenseOwnership(meta)
      const valid = payload?.valid ?? meta.valid ?? false
      const invalidStatus = meta.disabled || meta.licenseStatus === 'disabled' || meta.licenseStatus === 'expired'

      if (!valid || invalidStatus) {
        return clearStoredLicense('This license is no longer active for Focana.', 'invalid')
      }

      if (!ownership.ok) {
        return clearStoredLicense(ownership.reason, 'invalid')
      }

      const now = new Date().toISOString()
      const nextGrace = addDays(new Date(now), licenseConfig.offlineGraceDays).toISOString()
      setStoredLicense({
        ...stored,
        status: 'active',
        lastValidatedAt: now,
        offlineGraceUntil: nextGrace,
        lastError: null,
        productId: meta.productId,
        variantId: meta.variantId,
      })
      return buildStatus()
    } catch (error) {
      const existing = getStoredLicense()
      if (!isRecoverableValidationError(error)) {
        return clearStoredLicense(mapValidationError(error), 'invalid')
      }

      if (currentStatus.withinGrace) {
        setStoredLicense({
          ...existing,
          status: 'offline_grace',
          lastError: mapValidationError(error),
        })
        return buildStatus()
      }

      return clearStoredLicense(mapValidationError(error), 'error')
    }
  }

  async function deactivateLicense() {
    const runtime = getRuntimeInfo()
    if (!runtime.licenseEnforced) {
      return buildStatus()
    }

    const stored = getStoredLicense()
    if (!stored.key || !stored.instanceId) {
      return clearStoredLicense(null, 'unlicensed')
    }

    try {
      await postLicenseForm('deactivate', {
        license_key: stored.key,
        instance_id: stored.instanceId,
      })
      return clearStoredLicense(null, 'unlicensed')
    } catch (error) {
      return buildStatus({
        ...stored,
        lastError: typeof error?.message === 'string' ? error.message : 'Could not deactivate this Mac right now.',
      })
    }
  }

  return {
    activateLicense,
    deactivateLicense,
    getRuntimeInfo,
    getStatus() {
      return buildStatus()
    },
    validateLicense,
  }
}

module.exports = {
  createLicenseService,
}
