#!/usr/bin/env node

import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import {
  printInviteSummary,
  resolveInviteCreation,
} from './create-friends-and-family-invite.mjs';

const DEFAULT_SMOKE_TIMEOUT_MS = 45000;
const DEFAULT_SMOKE_INTERVAL_MS = 3000;

function printUsage() {
  console.log(`Create a friends-and-family invite and verify the live URL.

Usage:
  npm run invite:live -- --name "Justin Franklin" --email "justin@example.com"
  npm run invite:live -- --name "Justin Franklin" --email "justin@example.com" --dry-run

Options:
  --name               Creator display name
  --email              Invite recipient email
  --dry-run            Show the slug and link without inserting a row
  --smoke-timeout-ms   How long to wait for the live URL to respond correctly (default: 45000)
  --smoke-interval-ms  How often to retry the live URL check (default: 3000)
  --help               Show this message
`);
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flagName} value: ${value}`);
  }

  return parsed;
}

function parseArgs(argv) {
  const parsed = {
    name: '',
    email: '',
    dryRun: false,
    help: false,
    smokeTimeoutMs: DEFAULT_SMOKE_TIMEOUT_MS,
    smokeIntervalMs: DEFAULT_SMOKE_INTERVAL_MS,
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

    if (arg === '--smoke-timeout-ms') {
      parsed.smokeTimeoutMs = parsePositiveInteger(argv[index + 1], '--smoke-timeout-ms');
      index += 1;
      continue;
    }

    if (arg.startsWith('--smoke-timeout-ms=')) {
      parsed.smokeTimeoutMs = parsePositiveInteger(
        arg.slice('--smoke-timeout-ms='.length),
        '--smoke-timeout-ms'
      );
      continue;
    }

    if (arg === '--smoke-interval-ms') {
      parsed.smokeIntervalMs = parsePositiveInteger(argv[index + 1], '--smoke-interval-ms');
      index += 1;
      continue;
    }

    if (arg.startsWith('--smoke-interval-ms=')) {
      parsed.smokeIntervalMs = parsePositiveInteger(
        arg.slice('--smoke-interval-ms='.length),
        '--smoke-interval-ms'
      );
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function looksLikeInvitePage({ body, contentType }) {
  if (!contentType.includes('text/html')) return false;
  if (body.includes('This invite link is not available.')) return false;
  if (body.includes('This invite link is temporarily unavailable.')) return false;

  return (
    body.includes('Private early access') &&
    body.includes('Get Focana Free') &&
    body.includes('friends_and_family_landing_viewed')
  );
}

async function fetchSmokeResult(link) {
  const response = await fetch(link, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';

  return {
    ok: response.ok && looksLikeInvitePage({ body, contentType }),
    status: response.status,
    contentType,
    body,
  };
}

async function smokeTestInviteLink(link, { timeoutMs, intervalMs }) {
  const startedAt = Date.now();
  let attempts = 0;
  let lastResult = null;

  while (Date.now() - startedAt <= timeoutMs) {
    attempts += 1;
    lastResult = await fetchSmokeResult(link);

    if (lastResult.ok) {
      return {
        ok: true,
        attempts,
        status: lastResult.status,
      };
    }

    if (Date.now() - startedAt >= timeoutMs) {
      break;
    }

    await delay(intervalMs);
  }

  return {
    ok: false,
    attempts,
    status: lastResult?.status || 0,
    contentType: lastResult?.contentType || '',
  };
}

function printLiveInviteSummary({ result, smokeTest }) {
  console.log('Invite is live and smoke tested');
  console.log(`Name: ${result.invite.name}`);
  console.log(`Email: ${result.invite.email}`);
  console.log(`Slug: ${result.invite.slug}`);
  console.log(`Status: ${result.invite.status}`);
  console.log(`Link: ${result.link}`);
  console.log(`Smoke test: passed with HTTP ${smokeTest.status} after ${smokeTest.attempts} attempt(s)`);

  if (result.slugAdjusted) {
    console.log(`Note: The requested name slug was already taken, so the link was adjusted to "${result.invite.slug}".`);
  }

  if (result.existed) {
    console.log('Note: An existing invite was reused for this email.');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const result = await resolveInviteCreation({
    name: args.name,
    email: args.email,
    dryRun: args.dryRun,
  });

  if (args.dryRun) {
    printInviteSummary(result);
    console.log('Smoke test: skipped in dry-run mode.');
    return;
  }

  const smokeTest = await smokeTestInviteLink(result.link, {
    timeoutMs: args.smokeTimeoutMs,
    intervalMs: args.smokeIntervalMs,
  });

  if (!smokeTest.ok) {
    printInviteSummary(result);
    throw new Error(
      `Invite row exists, but the live smoke test did not pass within ${args.smokeTimeoutMs}ms. Last HTTP status: ${smokeTest.status || 'unknown'}`
    );
  }

  printLiveInviteSummary({ result, smokeTest });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
