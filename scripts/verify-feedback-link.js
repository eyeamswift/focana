#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const landingRoot = path.resolve(projectRoot, '../focana-landing');
const landingEnvPath = path.join(landingRoot, '.env');

function fail(message) {
  console.error(`[verify-feedback-link] ${message}`);
  process.exit(1);
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    fail(`Missing env file: ${envPath}`);
  }

  const loaded = {};
  const content = fs.readFileSync(envPath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    loaded[match[1]] = value;
  }

  return loaded;
}

function createHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
}

async function fetchRows(url, serviceKey, context) {
  const response = await fetch(url, {
    headers: createHeaders(serviceKey),
  });

  if (!response.ok) {
    const text = await response.text();
    fail(`${context}: ${text || response.status}`);
  }

  return response.json();
}

async function main() {
  const feedbackId = process.argv[2];
  if (!feedbackId) {
    fail('Usage: node scripts/verify-feedback-link.js <feedback-id>');
  }

  const env = loadEnvFile(landingEnvPath);
  const supabaseUrl = env.PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    fail(`Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${landingEnvPath}`);
  }

  const feedbackUrl = new URL(`${supabaseUrl}/rest/v1/app_session_feedback`);
  feedbackUrl.searchParams.set(
    'select',
    [
      'id',
      'install_id',
      'license_instance_id',
      'installation_id',
      'app_version',
      'channel',
      'client_created_at',
    ].join(',')
  );
  feedbackUrl.searchParams.set('id', `eq.${feedbackId}`);
  feedbackUrl.searchParams.set('limit', '1');

  const feedbackRows = await fetchRows(feedbackUrl, serviceKey, `Feedback lookup failed for id=${feedbackId}`);
  const feedback = feedbackRows[0];

  if (!feedback) {
    fail(`No feedback row found for id=${feedbackId}`);
  }

  let installation = null;
  if (feedback.installation_id) {
    const installationUrl = new URL(`${supabaseUrl}/rest/v1/app_installations`);
    installationUrl.searchParams.set(
      'select',
      [
        'id',
        'install_id',
        'license_instance_id',
        'first_seen_at',
        'last_seen_at',
        'app_version',
        'os_version',
        'channel',
      ].join(',')
    );
    installationUrl.searchParams.set('id', `eq.${feedback.installation_id}`);
    installationUrl.searchParams.set('limit', '1');

    const installationRows = await fetchRows(
      installationUrl,
      serviceKey,
      `Installation lookup failed for id=${feedback.installation_id}`
    );
    installation = installationRows[0] || null;
  }

  const result = {
    feedback,
    installation,
    linked: Boolean(feedback.installation_id && installation),
    matches: installation
      ? {
          install_id: installation.install_id === feedback.install_id,
          license_instance_id: installation.license_instance_id === feedback.license_instance_id,
        }
      : null,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.linked) {
    process.exit(2);
  }

  if (!result.matches.install_id || !result.matches.license_instance_id) {
    process.exit(3);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
