const path = require('path');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;

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
    console.log('[notarize] Skipping notarization: missing APPLE_API_KEY_ID / APPLE_API_ISSUER / APPLE_API_KEY_PATH|APPLE_API_KEY');
    return;
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
