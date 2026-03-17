const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const builderConfigPath = path.join(projectRoot, 'electron-builder.config.js');

function getAppVersion() {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return typeof packageJson.version === 'string' ? packageJson.version.trim() : '0.0.0';
}

function getUpdateChannel(version) {
  void version;
  return 'latest';
}

function getReleaseType(version) {
  void version;
  return 'release';
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

function getBuilderArgs(mode, publishMode, version) {
  const channel = getUpdateChannel(version);
  const releaseType = getReleaseType(version);
  const args = [
    '--config',
    builderConfigPath,
    '-c.publish.channel=' + channel,
    '--publish',
    publishMode,
  ];

  if (publishMode !== 'never') {
    args.push('-c.publish.releaseType=' + releaseType);
  }

  if (mode === 'zip') {
    return [...args, '--mac', 'zip', '--x64', '--arm64'];
  }

  if (mode === 'universal') {
    return [...args, '--mac', 'zip', '--universal'];
  }

  return [...args, '--mac'];
}

function runElectronBuilder(args) {
  const binName = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
  const builderBin = path.join(projectRoot, 'node_modules', '.bin', binName);
  const command = fs.existsSync(builderBin) ? builderBin : 'electron-builder';

  console.log(`[release] Running ${path.basename(command)} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });

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
  const manifestPath = path.join(projectRoot, 'release', manifestName);

  if (!fs.existsSync(manifestPath)) {
    console.error(`[release] Missing expected updater manifest: ${manifestName}`);
    console.error('[release] Auto-update checks will fail unless this file is present in the release assets.');
    process.exit(1);
  }

  console.log(`[release] Verified updater manifest: ${manifestName}`);
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
if (requireNotarization) {
  process.env.REQUIRE_NOTARIZATION = '1';
}

const builderArgs = getBuilderArgs(mode, publishMode, getAppVersion());
const version = getAppVersion();
const exitCode = runElectronBuilder(builderArgs);
if (exitCode !== 0) {
  process.exit(exitCode);
}

verifyMacUpdateManifest(version);
process.exit(0);
