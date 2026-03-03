const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

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

function getBuilderArgs(mode) {
  if (mode === 'zip') {
    return ['--mac', 'zip', '--x64', '--arm64', '--publish', 'never'];
  }

  if (mode === 'universal') {
    return ['--mac', 'zip', '--universal', '--publish', 'never'];
  }

  return ['--mac', '--publish', 'never'];
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

  process.exit(result.status ?? 1);
}

const mode = process.argv[2] || 'zip';
const requireNotarization = process.argv.includes('--require-notarization');
const validModes = new Set(['zip', 'full', 'universal']);
if (!validModes.has(mode)) {
  console.error(`[release] Invalid mode "${mode}". Use one of: zip, full, universal`);
  process.exit(1);
}

applyReleaseEnv();
if (requireNotarization) {
  process.env.REQUIRE_NOTARIZATION = '1';
}

const builderArgs = getBuilderArgs(mode);
runElectronBuilder(builderArgs);
