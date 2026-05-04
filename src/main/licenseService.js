const os = require('node:os')
const crypto = require('node:crypto')
const { licenseConfig, isLicenseConfigComplete } = require('./licenseConfig')
const { getUpdateChannel } = require('./updater')

const LICENSE_API_BASE_URL = 'https://api.lemonsqueezy.com/v1/licenses'
const DEFAULT_LICENSE_SYNC_API_URL = 'https://focana.app/api/license-instance-sync'
const LICENSE_SYNC_TIMEOUT_MS = 10 * 1000
const DEV_TEST_LICENSE_KEY = 'password'
const TRIAL_DAYS = 30
const KNOWN_VARIANT_IDS = {
  monthly: 1442573,
  lifetime: 1611321,
  legacyLifetime: 1442556,
  friendsFamily: 1438451,
}

function isDevRuntime(app) {
  return process.env.FOCANA_E2E === '1' || process.env.FOCANA_DEV === '1' || !app.isPackaged
}

function isPackagedDevTestLicenseAllowed(app) {
  return Boolean(app?.isPackaged) && process.env.FOCANA_ALLOW_DEV_TEST_LICENSE === '1'
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

function daysBetween(start, end) {
  const startMs = start instanceof Date ? start.getTime() : new Date(start).getTime()
  const endMs = end instanceof Date ? end.getTime() : new Date(end).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0
  return Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000))
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

function clampText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function normalizePreferredName(value) {
  return clampText(value, 80).replace(/\s+/g, ' ')
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
      orderId: null,
      customerIdLs: null,
      customerEmail: null,
      customerName: null,
      trialStartedAt: null,
      trialEndsAt: null,
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
    orderId: typeof raw.orderId === 'string' && raw.orderId.trim() ? raw.orderId.trim() : null,
    customerIdLs: typeof raw.customerIdLs === 'string' && raw.customerIdLs.trim() ? raw.customerIdLs.trim() : null,
    customerEmail: clampText(raw.customerEmail, 320).toLowerCase() || null,
    customerName: clampText(raw.customerName, 160) || null,
    trialStartedAt: safeIsoDate(raw.trialStartedAt),
    trialEndsAt: safeIsoDate(raw.trialEndsAt),
  }
}

function getConfiguredVariantId(name) {
  const envKey = `FOCANA_LEMON_${name.toUpperCase()}_VARIANT_ID`
  const envValue = Number.parseInt(String(process.env[envKey] || '').trim(), 10)
  return Number.isFinite(envValue) && envValue > 0 ? envValue : KNOWN_VARIANT_IDS[name]
}

function getPlanForVariantId(variantId) {
  const normalizedVariantId = Number(variantId) || null
  if (!normalizedVariantId) return null

  if (normalizedVariantId === getConfiguredVariantId('monthly')) return 'monthly'
  if (normalizedVariantId === getConfiguredVariantId('lifetime')) return 'lifetime'
  if (normalizedVariantId === getConfiguredVariantId('legacyLifetime')) return 'legacy_lifetime'
  if (normalizedVariantId === getConfiguredVariantId('friendsFamily')) return 'friends_family'
  return 'paid'
}

function extractLicenseMeta(payload) {
  const licenseKey = payload?.license_key || payload?.data?.attributes || payload?.data || {}
  const meta = payload?.meta || {}
  const instance = payload?.instance || payload?.activated_instance || meta.instance || {}
  const licenseKeyId = Number(
    licenseKey.id
    ?? payload?.license_key_id
    ?? payload?.data?.id
    ?? 0
  ) || null

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
  const orderId = String(
    meta.order_id
    ?? payload?.order_id
    ?? ''
  ).trim() || null
  const customerId = String(
    meta.customer_id
    ?? payload?.customer_id
    ?? ''
  ).trim() || null
  const customerName = clampText(
    meta.customer_name
    ?? payload?.customer_name
    ?? '',
    160
  ) || null
  const customerEmail = clampText(
    meta.customer_email
    ?? payload?.customer_email
    ?? '',
    320
  ).toLowerCase() || null
  const valid = payload?.valid ?? payload?.activated ?? meta.valid ?? meta.activated ?? null
  const disabled = payload?.disabled ?? licenseKey.disabled ?? meta.disabled ?? false
  const licenseStatus = String(licenseKey.status || payload?.status || '').trim().toLowerCase() || null

  return {
    licenseKeyId,
    storeId,
    productId,
    variantId,
    instanceId,
    orderId,
    customerId,
    customerName,
    customerEmail,
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

async function postLicenseInstanceSync(endpointUrl, payload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, LICENSE_SYNC_TIMEOUT_MS)

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok && response.status !== 202) {
      const text = await response.text()
      throw new Error(text || `License sync failed with status ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
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
  return isDevRuntime(app) || isPackagedDevTestLicenseAllowed(app)
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

  function getStoredPreferredName() {
    return normalizePreferredName(store.get('preferredName', ''))
  }

  async function syncLicenseIdentity(meta, { installId, eventAt, preferredName = getStoredPreferredName() }) {
    const endpointUrl = process.env.FOCANA_LICENSE_SYNC_API_URL || DEFAULT_LICENSE_SYNC_API_URL
    if (!endpointUrl || !meta?.instanceId) {
      return
    }

    if (!meta.orderId && !meta.customerId && !meta.customerEmail) {
      return
    }

    try {
      await postLicenseInstanceSync(endpointUrl, {
        licenseInstanceId: meta.instanceId,
        orderId: meta.orderId,
        customerIdLs: meta.customerId,
        customerEmail: meta.customerEmail,
        preferredName,
        eventAt,
        installId,
        appVersion: app.getVersion(),
        channel: getUpdateChannel(app.getVersion()),
      })
    } catch (error) {
      const reason = typeof error?.message === 'string' ? error.message : String(error)
      console.warn(`[license-sync] Failed to sync license instance ${meta.instanceId}: ${reason}`)
    }
  }

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

  function ensureTrialWindow(storedLicense, now = new Date()) {
    const stored = normalizeStoredLicense(storedLicense)
    const trialStartedAt = safeIsoDate(stored.trialStartedAt)
    const trialEndsAt = safeIsoDate(stored.trialEndsAt)

    if (trialStartedAt && trialEndsAt) {
      return stored
    }

    const nextTrialStartedAt = trialStartedAt || now.toISOString()
    const nextTrialEndsAt = trialEndsAt || addDays(new Date(nextTrialStartedAt), TRIAL_DAYS).toISOString()
    setStoredLicense({
      ...stored,
      trialStartedAt: nextTrialStartedAt,
      trialEndsAt: nextTrialEndsAt,
    })
    return getStoredLicense()
  }

  function clearStoredLicense(lastError = null, status = 'unlicensed', { preserveTrial = true } = {}) {
    const existing = preserveTrial ? getStoredLicense() : {}
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
      trialStartedAt: existing.trialStartedAt || null,
      trialEndsAt: existing.trialEndsAt || null,
    })
  }

  function resetDevLicenseStateIfNeeded() {
    if (devLicenseStateReset) return
    if (!isLicenseGateForced() || !shouldResetLicenseState()) return
    clearStoredLicense(null, 'unlicensed', { preserveTrial: false })
    devLicenseStateReset = true
  }

  function buildStatus(overrides = {}) {
    resetDevLicenseStateIfNeeded()
    const runtime = getRuntimeInfo()
    const installId = ensureInstallId()
    const now = new Date()
    const initialStored = { ...getStoredLicense(), ...overrides }
    const keyPresent = Boolean(initialStored.key)
    const instanceId = initialStored.instanceId || ''
    const packagedDevTestLicense = runtime.licenseEnforced && !isDevTestLicenseAllowed(app) && isStoredDevTestLicense(initialStored)
    const configured = runtime.licenseConfigured || isForcedDevLicenseFlow(app) || isDevTestLicenseAllowed(app)
    const shouldHaveTrial = runtime.licenseEnforced
      && configured
      && !keyPresent
      && !packagedDevTestLicense
    const stored = shouldHaveTrial ? ensureTrialWindow(initialStored, now) : initialStored
    const lastValidatedAt = safeIsoDate(stored.lastValidatedAt)
    const offlineGraceUntil = safeIsoDate(stored.offlineGraceUntil)
    const trialStartedAt = safeIsoDate(stored.trialStartedAt)
    const trialEndsAt = safeIsoDate(stored.trialEndsAt)
    const trialDaysRemaining = trialEndsAt ? Math.max(0, daysBetween(now, new Date(trialEndsAt))) : 0
    const trialActive = Boolean(trialEndsAt && new Date(trialEndsAt) > now)
    const validationDueAt = lastValidatedAt
      ? addHours(new Date(lastValidatedAt), licenseConfig.validationIntervalHours).toISOString()
      : null
    const validationDue = !lastValidatedAt || new Date(validationDueAt) <= now
    const withinGrace = Boolean(offlineGraceUntil && new Date(offlineGraceUntil) > now)
    const usingDevTestLicense = isDevTestLicenseAllowed(app) && instanceId.startsWith('dev-test-')
    let status = stored.status || 'unlicensed'

    if (!runtime.licenseEnforced) {
      status = 'not_required'
    } else if (packagedDevTestLicense) {
      status = 'unlicensed'
    } else if (!configured) {
      status = 'config_error'
    } else if (!keyPresent || !instanceId) {
      status = trialActive ? 'trial_active' : 'trial_expired'
    } else if (status === 'offline_grace' && !withinGrace) {
      status = 'error'
    }

    const allowed = !runtime.licenseEnforced
      || status === 'active'
      || status === 'trial_active'
      || (status === 'offline_grace' && withinGrace)
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
      trialDays: TRIAL_DAYS,
      installId,
      status,
      allowed,
      plan: getPlanForVariantId(stored.variantId),
      keyPresent: packagedDevTestLicense ? false : keyPresent,
      maskedKey: packagedDevTestLicense ? '' : maskLicenseKey(stored.key),
      instanceId: packagedDevTestLicense ? null : instanceId || null,
      activatedAt: safeIsoDate(stored.activatedAt),
      lastValidatedAt,
      offlineGraceUntil,
      trialStartedAt,
      trialEndsAt,
      trialActive,
      trialExpired: status === 'trial_expired',
      trialDaysRemaining,
      validationDueAt,
      validationDue,
      withinGrace,
      shouldValidateInForeground,
      lastError: packagedDevTestLicense ? null : stored.lastError,
      productId: packagedDevTestLicense ? null : stored.productId || null,
      variantId: packagedDevTestLicense ? null : stored.variantId || null,
      customerEmail: packagedDevTestLicense ? null : stored.customerEmail || null,
      customerName: packagedDevTestLicense ? null : stored.customerName || null,
      preferredName: getStoredPreferredName() || null,
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
      const existing = getStoredLicense()
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
        orderId: null,
        customerIdLs: null,
        customerEmail: null,
        customerName: null,
        trialStartedAt: existing.trialStartedAt || null,
        trialEndsAt: existing.trialEndsAt || null,
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
      const existing = getStoredLicense()
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
        orderId: meta.orderId,
        customerIdLs: meta.customerId,
        customerEmail: meta.customerEmail,
        customerName: meta.customerName,
        trialStartedAt: existing.trialStartedAt || null,
        trialEndsAt: existing.trialEndsAt || null,
      })

      await syncLicenseIdentity(meta, {
        installId,
        eventAt: now,
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
    if (runtime.licenseEnforced && !isDevTestLicenseAllowed(app) && isStoredDevTestLicense(stored)) {
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
        orderId: meta.orderId || stored.orderId || null,
        customerIdLs: meta.customerId || stored.customerIdLs || null,
        customerEmail: meta.customerEmail || stored.customerEmail || null,
        customerName: meta.customerName || stored.customerName || null,
      })

      await syncLicenseIdentity(meta, {
        installId: currentStatus.installId || ensureInstallId(),
        eventAt: now,
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
    if (isDevTestLicenseAllowed(app) && isStoredDevTestLicense(stored)) {
      clearStoredLicense(null, 'unlicensed')
      return buildStatus()
    }

    if (!stored.key || !stored.instanceId) {
      clearStoredLicense(null, 'unlicensed')
      return buildStatus()
    }

    try {
      await postLicenseForm('deactivate', {
        license_key: stored.key,
        instance_id: stored.instanceId,
      })
      clearStoredLicense(null, 'unlicensed')
      return buildStatus()
    } catch (error) {
      return buildStatus({
        ...stored,
        lastError: typeof error?.message === 'string' ? error.message : 'Could not deactivate this Mac right now.',
      })
    }
  }

  async function savePreferredName(rawPreferredName) {
    const preferredName = normalizePreferredName(rawPreferredName)
    if (!preferredName) {
      throw new Error('Enter the name you want Focana to use.')
    }

    store.set('preferredName', preferredName)

    const stored = getStoredLicense()
    const installId = ensureInstallId()
    const canSyncIdentity = Boolean(
      stored.instanceId
      && (stored.orderId || stored.customerIdLs || stored.customerEmail)
    )

    if (!canSyncIdentity) {
      return {
        preferredName,
        synced: false,
      }
    }

    try {
      await syncLicenseIdentity({
        instanceId: stored.instanceId,
        orderId: stored.orderId,
        customerId: stored.customerIdLs,
        customerEmail: stored.customerEmail,
      }, {
        installId,
        eventAt: new Date().toISOString(),
        preferredName,
      })

      return {
        preferredName,
        synced: true,
      }
    } catch (error) {
      const reason = typeof error?.message === 'string' ? error.message : String(error)
      console.warn(`[license-sync] Failed to sync preferred name for ${stored.instanceId || 'unknown-instance'}: ${reason}`)
      return {
        preferredName,
        synced: false,
      }
    }
  }

  return {
    activateLicense,
    deactivateLicense,
    getRuntimeInfo,
    getStatus() {
      return buildStatus()
    },
    savePreferredName,
    validateLicense,
  }
}

module.exports = {
  createLicenseService,
}
