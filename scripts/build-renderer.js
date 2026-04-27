const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const useReleaseEnv = process.argv.includes('--release-env');

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
  const merged = {
    ...loadEnvFile(baseEnvPath),
    ...loadEnvFile(localEnvPath),
  };

  let loadedCount = 0;
  for (const [key, value] of Object.entries(merged)) {
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value;
      loadedCount += 1;
    }
  }

  console.log(`[build-renderer] Loaded ${loadedCount} env vars from .env.release files`);

  const analyticsEnabled = process.env.VITE_ENABLE_ANALYTICS === 'true';
  const hasPosthogKey = Boolean(String(process.env.VITE_POSTHOG_KEY || '').trim());
  const analyticsState = analyticsEnabled && hasPosthogKey ? 'enabled' : 'disabled';
  const host = String(process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com').trim();
  console.log(`[build-renderer] PostHog ${analyticsState} for release build (host: ${host})`);
  if (!analyticsEnabled || !hasPosthogKey) {
    console.error('[build-renderer] Release build requires VITE_ENABLE_ANALYTICS=true and VITE_POSTHOG_KEY in .env.release or .env.release.local.');
    process.exit(1);
  }
}

if (useReleaseEnv) {
  applyReleaseEnv();
}

const viteBin = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
);

const result = spawnSync(viteBin, ['build'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error('[build-renderer] Failed to execute vite build:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
