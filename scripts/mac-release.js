const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const builderConfigPath = path.join(projectRoot, 'electron-builder.config.js');
const releaseDir = path.join(projectRoot, 'release');

let cachedBuilderConfig = null;

function getAppVersion() {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return typeof packageJson.version === 'string' ? packageJson.version.trim() : '0.0.0';
}

function getBuilderConfig() {
  if (!cachedBuilderConfig) {
    delete require.cache[require.resolve(builderConfigPath)];
    cachedBuilderConfig = require(builderConfigPath);
  }
  return cachedBuilderConfig;
}

function getProductName() {
  return getBuilderConfig().productName || 'Focana';
}

function getGitHubRepo() {
  const publish = getBuilderConfig().publish || {};
  if (!publish.owner || !publish.repo) {
    console.error('[release] Missing GitHub publish owner/repo in electron-builder config');
    process.exit(1);
  }
  return `${publish.owner}/${publish.repo}`;
}

function getUpdateChannel(version) {
  void version;
  return 'latest';
}

function parsePublishMode(argv) {
  const publishFlagIndex = argv.indexOf('--publish');
  if (publishFlagIndex === -1) return 'never';

  const nextValue = argv[publishFlagIndex + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    return 'always';
  }

  const validModes = new Set(['always', 'never', 'onTag', 'onTagOrDraft']);
  if (!validModes.has(nextValue)) {
    console.error(`[release] Invalid publish mode "${nextValue}". Use one of: always, never, onTag, onTagOrDraft`);
    process.exit(1);
  }
  return nextValue;
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};

  const loaded = {};
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.replace(/^export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] ?? '';

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    loaded[key] = value;
  }

  return loaded;
}

function applyReleaseEnv() {
  const baseEnvPath = path.join(projectRoot, '.env.release');
  const localEnvPath = path.join(projectRoot, '.env.release.local');

  const baseEnv = loadEnvFile(baseEnvPath);
  const localEnv = loadEnvFile(localEnvPath);
  const merged = { ...baseEnv, ...localEnv };

  let loadedCount = 0;
  for (const [key, value] of Object.entries(merged)) {
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value;
      loadedCount += 1;
    }
  }

  if (loadedCount > 0) {
    console.log(`[release] Loaded ${loadedCount} env vars from .env.release files`);
  } else {
    console.log('[release] No env vars loaded from .env.release files');
  }
}

function getBuilderArgs(mode, version) {
  const channel = getUpdateChannel(version);
  const args = [
    '--config',
    builderConfigPath,
    '-c.publish.channel=' + channel,
    '--publish',
    'never',
  ];

  if (mode === 'zip') {
    return [...args, '--mac', 'zip', '--x64', '--arm64'];
  }

  if (mode === 'universal') {
    return [...args, '--mac', 'zip', '--universal'];
  }

  return [...args, '--mac'];
}

function runCommand(command, args, options = {}) {
  const {
    captureOutput = false,
    allowFailure = false,
    env = process.env,
  } = options;

  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    encoding: 'utf8',
    stdio: captureOutput ? 'pipe' : 'inherit',
  });

  if (result.error) {
    if (allowFailure) {
      return result;
    }
    console.error(`[release] Failed to execute ${command}:`, result.error.message);
    process.exit(1);
  }

  if (!allowFailure && (result.status ?? 1) !== 0) {
    if (captureOutput) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    console.error(`[release] Command failed: ${command} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }

  return result;
}

function runElectronBuilder(args) {
  const binName = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
  const builderBin = path.join(projectRoot, 'node_modules', '.bin', binName);
  const command = fs.existsSync(builderBin) ? builderBin : 'electron-builder';

  console.log(`[release] Running ${path.basename(command)} ${args.join(' ')}`);

  const result = runCommand(command, args, { allowFailure: true });
  if (result.error) {
    console.error('[release] Failed to execute electron-builder:', result.error.message);
    process.exit(1);
  }
  return result.status ?? 1;
}

function expectedMacManifestName(version) {
  void version;
  return 'latest-mac.yml';
}

function verifyMacUpdateManifest(version) {
  const manifestName = expectedMacManifestName(version);
  const manifestPath = path.join(releaseDir, manifestName);

  if (!fs.existsSync(manifestPath)) {
    console.error(`[release] Missing expected updater manifest: ${manifestName}`);
    console.error('[release] Auto-update checks will fail unless this file is present in the release assets.');
    process.exit(1);
  }

  console.log(`[release] Verified updater manifest: ${manifestName}`);
  return manifestPath;
}

function ensureRequiredEnv(requireNotarization, publishMode) {
  const missingLicensingEnv = [
    'FOCANA_LEMON_STORE_ID',
    'FOCANA_LEMON_PRODUCT_ID',
    'FOCANA_LEMON_VARIANT_IDS',
  ].filter((key) => !String(process.env[key] || '').trim());

  if (missingLicensingEnv.length > 0) {
    console.error(`[release] Missing required Lemon licensing env vars: ${missingLicensingEnv.join(', ')}`);
    console.error('[release] Finder-installed builds will fail activation without them.');
    process.exit(1);
  }

  if (requireNotarization) {
    const missingAppleEnv = [
      'APPLE_API_KEY_ID',
      'APPLE_API_ISSUER',
    ].filter((key) => !String(process.env[key] || '').trim());
    const hasAppleKey = String(process.env.APPLE_API_KEY || process.env.APPLE_API_KEY_PATH || '').trim();
    if (!hasAppleKey) {
      missingAppleEnv.push('APPLE_API_KEY_PATH|APPLE_API_KEY');
    }

    if (missingAppleEnv.length > 0) {
      console.error(`[release] Missing required notarization env vars: ${missingAppleEnv.join(', ')}`);
      process.exit(1);
    }
  }

  if (publishMode !== 'never' && !String(process.env.GH_TOKEN || '').trim()) {
    console.error('[release] Missing GH_TOKEN for GitHub release publishing.');
    process.exit(1);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findBuiltAppBundles() {
  const appName = `${getProductName()}.app`;

  if (!fs.existsSync(releaseDir)) {
    return [];
  }

  return fs.readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
    .map((entry) => path.join(releaseDir, entry.name, appName))
    .filter((appPath) => fs.existsSync(appPath));
}

function findBuiltDmgs(version) {
  if (!fs.existsSync(releaseDir)) {
    return [];
  }

  const dmgPattern = new RegExp(`^${escapeRegExp(getProductName())}-${escapeRegExp(version)}-mac-.*\\.dmg$`);
  return fs.readdirSync(releaseDir)
    .filter((name) => dmgPattern.test(name))
    .map((name) => path.join(releaseDir, name))
    .sort();
}

function validateNotarizedApps() {
  const appBundles = findBuiltAppBundles();

  if (appBundles.length === 0) {
    console.error('[release] No packaged macOS app bundles were found in release/.');
    process.exit(1);
  }

  for (const appPath of appBundles) {
    console.log(`[release] Validating notarized app bundle: ${path.relative(projectRoot, appPath)}`);
    runCommand('xcrun', ['stapler', 'validate', appPath]);
    runCommand('spctl', ['--assess', '--type', 'execute', '-vv', appPath]);
  }
}

function notarizeDmgs(version) {
  const dmgPaths = findBuiltDmgs(version);

  if (dmgPaths.length === 0) {
    console.error('[release] No DMG artifacts were found to notarize.');
    process.exit(1);
  }

  const apiKey = process.env.APPLE_API_KEY;
  const apiKeyId = process.env.APPLE_API_KEY_ID;
  const apiIssuer = process.env.APPLE_API_ISSUER;

  if (!apiKey || !apiKeyId || !apiIssuer) {
    console.error('[release] Missing Apple notarization env vars for DMG notarization.');
    process.exit(1);
  }

  for (const dmgPath of dmgPaths) {
    console.log(`[release] Submitting DMG for notarization: ${path.relative(projectRoot, dmgPath)}`);
    runCommand('xcrun', [
      'notarytool', 'submit', dmgPath,
      '--key', apiKey,
      '--key-id', apiKeyId,
      '--issuer', apiIssuer,
      '--wait',
    ]);
  }

  return dmgPaths;
}

function stapleAndValidateDmgs(version) {
  const dmgPaths = findBuiltDmgs(version);

  if (dmgPaths.length === 0) {
    console.error('[release] No DMG artifacts were found to staple.');
    process.exit(1);
  }

  for (const dmgPath of dmgPaths) {
    console.log(`[release] Stapling DMG ticket: ${path.relative(projectRoot, dmgPath)}`);
    runCommand('xcrun', ['stapler', 'staple', dmgPath]);
    runCommand('xcrun', ['stapler', 'validate', dmgPath]);
  }

  return dmgPaths;
}

function getFileMetadata(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    size: buffer.byteLength,
    sha512: crypto.createHash('sha512').update(buffer).digest('base64'),
  };
}

function refreshUpdaterManifest(manifestPath, artifactPaths) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  for (const artifactPath of artifactPaths) {
    const fileName = path.basename(artifactPath);
    const { sha512, size } = getFileMetadata(artifactPath);
    const fileEntryPattern = new RegExp(
      `(- url: ${escapeRegExp(fileName)}\\n\\s+sha512: )([^\\n]+)(\\n\\s+size: )(\\d+)`
    );

    if (!fileEntryPattern.test(manifest)) {
      console.error(`[release] Could not find ${fileName} in ${path.basename(manifestPath)} to refresh its hash.`);
      process.exit(1);
    }

    manifest = manifest.replace(fileEntryPattern, `$1${sha512}$3${size}`);

    const primaryPathPattern = new RegExp(`(\\npath: ${escapeRegExp(fileName)}\\nsha512: )([^\\n]+)`);
    if (primaryPathPattern.test(manifest)) {
      manifest = manifest.replace(primaryPathPattern, `$1${sha512}`);
    }
  }

  fs.writeFileSync(manifestPath, manifest);
  console.log(`[release] Refreshed ${path.basename(manifestPath)} for final stapled DMGs`);
}

function removeStaleDmgBlockmaps(version) {
  if (!fs.existsSync(releaseDir)) {
    return;
  }

  const pattern = new RegExp(`^${escapeRegExp(getProductName())}-${escapeRegExp(version)}-mac-.*\\.dmg\\.blockmap$`);
  const staleFiles = fs.readdirSync(releaseDir)
    .filter((name) => pattern.test(name))
    .map((name) => path.join(releaseDir, name));

  for (const filePath of staleFiles) {
    fs.unlinkSync(filePath);
  }

  if (staleFiles.length > 0) {
    console.log(`[release] Removed ${staleFiles.length} stale DMG blockmap file(s) after stapling`);
  }
}

function collectReleaseAssets(mode, version) {
  const manifestPath = path.join(releaseDir, expectedMacManifestName(version));
  const versionPrefix = `${getProductName()}-${version}-mac-`;
  const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir) : [];
  const assetNames = releaseFiles.filter((name) => {
    if (!name.startsWith(versionPrefix)) return false;
    if (name.endsWith('.zip') || name.endsWith('.zip.blockmap')) return true;
    if (mode === 'full' && name.endsWith('.dmg')) return true;
    return false;
  }).sort();

  const assetPaths = assetNames.map((name) => path.join('release', name));
  assetPaths.push(path.join('release', path.basename(manifestPath)));

  for (const relativeAssetPath of assetPaths) {
    const absolutePath = path.join(projectRoot, relativeAssetPath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`[release] Missing expected release asset: ${relativeAssetPath}`);
      process.exit(1);
    }
  }

  return assetPaths;
}

function hasLocalTag(tagName) {
  const result = runCommand('git', ['rev-parse', '-q', '--verify', `refs/tags/${tagName}`], {
    allowFailure: true,
    captureOutput: true,
  });
  return (result.status ?? 1) === 0;
}

function publishGitHubRelease(mode, publishMode, version) {
  if (publishMode === 'never') {
    return;
  }

  const tagName = `v${version}`;
  const isTaggedRelease = hasLocalTag(tagName);

  if (publishMode === 'always' && !isTaggedRelease) {
    console.error(`[release] Refusing to publish without local git tag ${tagName}.`);
    console.error('[release] Create and push the version tag first so the release assets attach to the right tag.');
    process.exit(1);
  }

  if ((publishMode === 'onTag' || publishMode === 'onTagOrDraft') && !isTaggedRelease) {
    console.log(`[release] Skipping publish because ${tagName} is not present locally.`);
    return;
  }

  const repo = getGitHubRepo();
  const assets = collectReleaseAssets(mode, version);
  const releaseExists = runCommand('gh', ['release', 'view', tagName, '--repo', repo], {
    allowFailure: true,
    captureOutput: true,
  });

  if ((releaseExists.status ?? 1) === 0) {
    console.log(`[release] Uploading refreshed assets to existing GitHub release ${tagName}`);
    runCommand('gh', ['release', 'upload', tagName, ...assets, '--repo', repo, '--clobber']);
    return;
  }

  console.log(`[release] Creating GitHub release ${tagName}`);
  const createArgs = [
    'release',
    'create',
    tagName,
    ...assets,
    '--repo',
    repo,
    '--title',
    `${getProductName()} ${version}`,
  ];

  if (publishMode === 'onTagOrDraft') {
    createArgs.push('--draft');
  }

  if (version.includes('-')) {
    createArgs.push('--prerelease');
  }

  runCommand('gh', createArgs);
}

const mode = process.argv[2] || 'zip';
const requireNotarization = process.argv.includes('--require-notarization');
const publishMode = parsePublishMode(process.argv.slice(3));
const validModes = new Set(['zip', 'full', 'universal']);
if (!validModes.has(mode)) {
  console.error(`[release] Invalid mode "${mode}". Use one of: zip, full, universal`);
  process.exit(1);
}

applyReleaseEnv();

// electron-builder's built-in notarization expects APPLE_API_KEY (the file path to the
// .p8 key). We allow APPLE_API_KEY_PATH as an alias for clarity in .env.release files.
if (process.env.APPLE_API_KEY_PATH && !process.env.APPLE_API_KEY) {
  process.env.APPLE_API_KEY = process.env.APPLE_API_KEY_PATH;
  console.log(`[release] Set APPLE_API_KEY from APPLE_API_KEY_PATH: ${process.env.APPLE_API_KEY_PATH}`);
}

if (requireNotarization) {
  process.env.REQUIRE_NOTARIZATION = '1';
}

const version = getAppVersion();
ensureRequiredEnv(requireNotarization, publishMode);

const builderArgs = getBuilderArgs(mode, version);
const exitCode = runElectronBuilder(builderArgs);
if (exitCode !== 0) {
  process.exit(exitCode);
}

const manifestPath = verifyMacUpdateManifest(version);
validateNotarizedApps();

if (mode === 'full') {
  notarizeDmgs(version);
  const dmgPaths = stapleAndValidateDmgs(version);
  refreshUpdaterManifest(manifestPath, dmgPaths);
  removeStaleDmgBlockmaps(version);
}

verifyMacUpdateManifest(version);
publishGitHubRelease(mode, publishMode, version);
process.exit(0);
