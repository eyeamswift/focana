const path = require('path');
const fs = require('fs');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  const requireNotarization = process.env.REQUIRE_NOTARIZATION === '1';

  if (electronPlatformName !== 'darwin') {
    return;
  }

  // electron-builder v25+ notarizes automatically during signing when it detects
  // APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER in env. Skip our custom
  // afterSign notarization to avoid notarizing twice.
  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) {
    console.log('[notarize] Skipping afterSign notarization — electron-builder already notarized');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  const appleApiKeyPath = process.env.APPLE_API_KEY_PATH;
  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  if (!appleApiKeyId || !appleApiIssuer || (!appleApiKeyPath && !appleApiKey)) {
    const message = 'Missing APPLE_API_KEY_ID / APPLE_API_ISSUER / APPLE_API_KEY_PATH|APPLE_API_KEY';
    if (requireNotarization) {
      throw new Error(`[notarize] ${message}`);
    }
    console.warn(`[notarize] Skipping notarization: ${message}`);
    console.warn('[notarize] These artifacts are not safe to ship. Use npm run build:mac:release or npm run build:mac:publish instead.');
    return;
  }

  if (appleApiKeyPath && !fs.existsSync(appleApiKeyPath)) {
    throw new Error(`[notarize] APPLE_API_KEY_PATH does not exist: ${appleApiKeyPath}`);
  }

  if (!process.env.APPLE_TEAM_ID) {
    console.warn('[notarize] APPLE_TEAM_ID is not set; notarization may fail for some accounts');
  }

  const { notarize } = require('@electron/notarize');

  console.log(`[notarize] Notarizing ${appPath}`);

  // Clear env vars that @electron/notarize auto-detects to prevent
  // "Cannot use password, API key, and keychain credentials at once" errors.
  // Capture and restore after notarize() so subsequent arch builds still work.
  const savedEnv = {};
  for (const key of [
    'APPLE_API_KEY', 'APPLE_API_KEY_PATH', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER',
    'APPLE_ID', 'APPLE_ID_PASSWORD', 'APPLE_PASSWORD',
    'APPLE_KEYCHAIN_PROFILE', 'APPLE_KEYCHAIN',
  ]) {
    if (key in process.env) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  }

  const notarizeOptions = {
    appPath,
    appleApiKeyId,
    appleApiIssuer,
  };

  if (appleApiKeyPath) {
    notarizeOptions.appleApiKey = appleApiKeyPath;
  } else {
    notarizeOptions.appleApiKey = appleApiKey;
  }

  try {
    await notarize(notarizeOptions);
    console.log('[notarize] Notarization complete');
  } finally {
    // Restore env vars for subsequent arch builds
    Object.assign(process.env, savedEnv);
  }
};
