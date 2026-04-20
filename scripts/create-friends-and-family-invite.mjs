#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_ORIGIN = 'https://www.focana.app';
const CREATOR_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_SELECT =
  'id,name,email,slug,status,claimed_email,claimed_order_id,claimed_at,created_at,updated_at';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function printUsage() {
  console.log(`Create a friends-and-family invite.

Usage:
  npm run invite:create -- --name "Justin Franklin" --email "justin@example.com"
  npm run invite:create -- --name "Justin Franklin" --email "justin@example.com" --dry-run

Options:
  --name      Creator display name
  --email     Invite recipient email
  --dry-run   Show the slug and link without inserting a row
  --help      Show this message
`);
}

function parseArgs(argv) {
  const parsed = {
    name: '',
    email: '',
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (arg === '--name') {
      parsed.name = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--name=')) {
      parsed.name = arg.slice('--name='.length);
      continue;
    }

    if (arg === '--email') {
      parsed.email = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--email=')) {
      parsed.email = arg.slice('--email='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function normalizeDisplayName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeCreatorSlug(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized || normalized.length > 80 || !CREATOR_SLUG_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeInviteEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeSiteOrigin(rawOrigin) {
  if (!rawOrigin) return DEFAULT_SITE_ORIGIN;

  try {
    const url = new URL(rawOrigin);

    if (url.hostname === 'focana.app') {
      url.hostname = 'www.focana.app';
    }

    return url.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

function buildInviteLink(slug) {
  const origin = normalizeSiteOrigin(
    process.env.PUBLIC_SITE_URL || process.env.SITE || DEFAULT_SITE_ORIGIN
  );

  return new URL(`/friends-and-family/${slug}`, origin).toString();
}

function createHeaders(serviceKey, extraHeaders = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extraHeaders,
  };
}

async function readJsonResponse(response, context) {
  if (!response.ok) {
    const errText = await response.text();
    let payload = null;

    try {
      payload = errText ? JSON.parse(errText) : null;
    } catch {
      payload = null;
    }

    const message = String(payload?.message || errText || response.status);
    if (
      payload?.code === '42703' &&
      message.includes('friends_and_family_invites.email')
    ) {
      throw new Error(
        'Supabase is missing the new friends-and-family invite email column. Apply the latest Supabase migrations before running invite:create.'
      );
    }

    if (
      payload?.code === '42P01' &&
      message.includes('friends_and_family_invites')
    ) {
      throw new Error(
        'Supabase is missing the friends_and_family_invites table. Apply the latest Supabase migrations before running invite:create.'
      );
    }

    throw new Error(`${context}: ${message}`);
  }

  return response.json();
}

async function loadEnvFile(filename) {
  const filePath = path.join(REPO_ROOT, filename);
  let raw;

  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');

    process.env[key] = value;
  }
}

async function loadLocalEnvFiles() {
  await loadEnvFile('.env');
  await loadEnvFile('.env.local');
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function fetchInviteBySlug({ supabaseUrl, serviceKey, slug }) {
  const url = new URL(`${supabaseUrl}/rest/v1/friends_and_family_invites`);
  url.searchParams.set('select', INVITE_SELECT);
  url.searchParams.set('slug', `eq.${slug}`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: createHeaders(serviceKey),
  });

  const rows = await readJsonResponse(
    response,
    `Friends-and-family invite lookup failed for slug=${slug}`
  );

  return rows[0] || null;
}

async function fetchInviteByEmail({ supabaseUrl, serviceKey, email }) {
  const url = new URL(`${supabaseUrl}/rest/v1/friends_and_family_invites`);
  url.searchParams.set('select', INVITE_SELECT);
  url.searchParams.set('email', `eq.${email}`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: createHeaders(serviceKey),
  });

  const rows = await readJsonResponse(
    response,
    `Friends-and-family invite lookup failed for email=${email}`
  );

  return rows[0] || null;
}

async function findAvailableSlug({ supabaseUrl, serviceKey, baseSlug }) {
  let attempt = 0;

  while (attempt < 100) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existingInvite = await fetchInviteBySlug({
      supabaseUrl,
      serviceKey,
      slug,
    });

    if (!existingInvite) {
      return slug;
    }

    attempt += 1;
  }

  throw new Error(`Could not find an available slug for base "${baseSlug}"`);
}

async function createInvite({ supabaseUrl, serviceKey, name, email, slug }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/friends_and_family_invites`, {
    method: 'POST',
    headers: createHeaders(serviceKey, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({
      name,
      email,
      slug,
    }),
  });

  const rows = await readJsonResponse(
    response,
    `Friends-and-family invite insert failed for email=${email}`
  );

  if (!rows[0]) {
    throw new Error(`Friends-and-family invite insert returned no rows for email=${email}`);
  }

  return rows[0];
}

function printInviteSummary({ heading, invite, link, dryRun, slugAdjusted }) {
  console.log(heading);
  console.log(`Name: ${invite.name}`);
  console.log(`Email: ${invite.email}`);
  console.log(`Slug: ${invite.slug}`);
  console.log(`Status: ${invite.status}`);
  console.log(`Link: ${link}`);

  if (slugAdjusted) {
    console.log(`Note: The requested name slug was already taken, so the link was adjusted to "${invite.slug}".`);
  }

  if (dryRun) {
    console.log('Mode: dry-run only, nothing was inserted.');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const name = normalizeDisplayName(args.name);
  if (!name) {
    throw new Error('Missing required --name value');
  }

  const email = normalizeInviteEmail(args.email);
  if (!email) {
    throw new Error('Missing or invalid --email value');
  }

  const baseSlug = normalizeCreatorSlug(name);
  if (!baseSlug) {
    throw new Error(`Could not derive a valid slug from "${name}"`);
  }

  await loadLocalEnvFiles();

  const supabaseUrl = requireEnv('PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const existingInviteByEmail = await fetchInviteByEmail({
    supabaseUrl,
    serviceKey,
    email,
  });

  if (existingInviteByEmail) {
    const link = buildInviteLink(existingInviteByEmail.slug);
    printInviteSummary({
      heading: 'Invite already exists for this email.',
      invite: existingInviteByEmail,
      link,
      dryRun: args.dryRun,
      slugAdjusted: false,
    });
    process.exitCode = 1;
    return;
  }

  const slug = await findAvailableSlug({
    supabaseUrl,
    serviceKey,
    baseSlug,
  });
  const link = buildInviteLink(slug);
  const slugAdjusted = slug !== baseSlug;

  if (args.dryRun) {
    printInviteSummary({
      heading: 'Invite preview',
      invite: {
        name,
        email,
        slug,
        status: 'active',
      },
      link,
      dryRun: true,
      slugAdjusted,
    });
    return;
  }

  const invite = await createInvite({
    supabaseUrl,
    serviceKey,
    name,
    email,
    slug,
  });

  printInviteSummary({
    heading: 'Invite created',
    invite,
    link,
    dryRun: false,
    slugAdjusted,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
