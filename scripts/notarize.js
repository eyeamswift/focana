const path = require('path');
const fs = require('fs');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  const requireNotarization = process.env.REQUIRE_NOTARIZATION === '1';

  if (electronPlatformName !== 'darwin') {
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
    console.log(`[notarize] Skipping notarization: ${message}`);
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

  const notarizeOptions = {
    appPath,
    teamId: process.env.APPLE_TEAM_ID,
    appleApiKeyId,
    appleApiIssuer,
  };

  if (appleApiKeyPath) {
    notarizeOptions.appleApiKey = appleApiKeyPath;
  } else {
    notarizeOptions.appleApiKey = appleApiKey;
  }

  await notarize(notarizeOptions);
  console.log('[notarize] Notarization complete');
};
