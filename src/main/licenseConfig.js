const VALIDATION_INTERVAL_HOURS = 72
const OFFLINE_GRACE_DAYS = 7

function parseId(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseVariantIds(value) {
  return String(value || '')
    .split(',')
    .map((entry) => parseId(entry))
    .filter(Boolean)
}

const licenseConfig = {
  storeId: parseId(process.env.FOCANA_LEMON_STORE_ID),
  productId: parseId(process.env.FOCANA_LEMON_PRODUCT_ID),
  variantIds: parseVariantIds(process.env.FOCANA_LEMON_VARIANT_IDS),
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
