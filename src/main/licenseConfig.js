const fs = require('node:fs')
const path = require('node:path')

const VALIDATION_INTERVAL_HOURS = 72
const OFFLINE_GRACE_DAYS = 7

function parseId(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseVariantIds(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => parseId(entry))
      .filter(Boolean)
  }

  return String(value || '')
    .split(',')
    .map((entry) => parseId(entry))
    .filter(Boolean)
}

function readEmbeddedLicenseConfig() {
  const packageJsonPath = path.join(__dirname, '..', '..', 'package.json')

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return packageJson?.focanaLicenseConfig && typeof packageJson.focanaLicenseConfig === 'object'
      ? packageJson.focanaLicenseConfig
      : {}
  } catch (_) {
    return {}
  }
}

function resolveId(primaryValue, fallbackValue) {
  return parseId(primaryValue) || parseId(fallbackValue)
}

const embeddedLicenseConfig = readEmbeddedLicenseConfig()
const envVariantIds = parseVariantIds(process.env.FOCANA_LEMON_VARIANT_IDS)
const embeddedVariantIds = parseVariantIds(embeddedLicenseConfig.variantIds)

const licenseConfig = {
  storeId: resolveId(process.env.FOCANA_LEMON_STORE_ID, embeddedLicenseConfig.storeId),
  productId: resolveId(process.env.FOCANA_LEMON_PRODUCT_ID, embeddedLicenseConfig.productId),
  variantIds: envVariantIds.length > 0 ? envVariantIds : embeddedVariantIds,
  validationIntervalHours: VALIDATION_INTERVAL_HOURS,
  offlineGraceDays: OFFLINE_GRACE_DAYS,
}

function isLicenseConfigComplete() {
  return Boolean(
    licenseConfig.storeId
    && licenseConfig.productId
    && licenseConfig.variantIds.length > 0
  )
}

module.exports = {
  licenseConfig,
  isLicenseConfigComplete,
}
