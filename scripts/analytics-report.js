#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_WINDOWS = [7, 30];
const DEFAULT_TOP_USERS = 5;
const DEFAULT_RECENT_DAYS = 14;
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_ENV_CANDIDATES = [
  path.resolve(__dirname, '../../focana-landing/.env'),
  path.resolve(__dirname, '../../focana-landing/.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../.env.local'),
];
const TRACK_REGEX = /track\(\s*['"]([^'"]+)['"]/g;

function printHelp() {
  console.log(`Focana analytics report

Usage:
  node scripts/analytics-report.js [options]
  npm run metrics:report -- [options]

Options:
  --env-path=PATH       Load PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from PATH
  --windows=7,30       Feedback-active windows in days (default: 7,30)
  --top-users=5        Number of users to show in the top users section (default: 5)
  --recent-days=14     Number of recent daily buckets to show (default: 14)
  --json               Print machine-readable JSON
  --help               Show this help

Notes:
  - Supabase metrics here are feedback-backed, not full DAU/WAU.
  - The official PostHog CLI does not expose event-query commands, so this report audits
    current PostHog instrumentation from source and combines it with live Supabase data.
  - Environment variables override file values when both are present.`);
}

function parseArgs(argv) {
  const options = {
    envPath: '',
    windows: DEFAULT_WINDOWS.slice(),
    topUsers: DEFAULT_TOP_USERS,
    recentDays: DEFAULT_RECENT_DAYS,
    json: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg.startsWith('--env-path=')) {
      options.envPath = arg.slice('--env-path='.length).trim();
      continue;
    }
    if (arg.startsWith('--windows=')) {
      options.windows = parseNumberList(arg.slice('--windows='.length), '--windows');
      continue;
    }
    if (arg.startsWith('--top-users=')) {
      options.topUsers = parsePositiveInteger(arg.slice('--top-users='.length), '--top-users');
      continue;
    }
    if (arg.startsWith('--recent-days=')) {
      options.recentDays = parsePositiveInteger(arg.slice('--recent-days='.length), '--recent-days');
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parsePositiveInteger(raw, flagName) {
  const value = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return value;
}

function parseNumberList(raw, flagName) {
  const values = String(raw)
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) {
    throw new Error(`${flagName} must contain at least one positive integer.`);
  }

  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function findEnvPath(explicitPath) {
  if (explicitPath) {
    return path.resolve(process.cwd(), explicitPath);
  }

  for (const candidate of DEFAULT_ENV_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return '';
}

function loadEnvFile(envPath) {
  if (!envPath || !fs.existsSync(envPath)) {
    return {};
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
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    loaded[match[1]] = value;
  }

  return loaded;
}

function resolveSupabaseConfig(envPath) {
  const fileEnv = loadEnvFile(envPath);
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || fileEnv.PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      [
        'Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
        envPath ? `Checked env file: ${envPath}` : 'No env file was found automatically.',
        'You can pass --env-path=... or export the variables directly.',
      ].join(' ')
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    envPath: envPath || null,
  };
}

function createHeaders(serviceRoleKey, extraHeaders = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extraHeaders,
  };
}

async function fetchAllRows({ supabaseUrl, serviceRoleKey, pathname, select, pageSize = DEFAULT_PAGE_SIZE }) {
  const rows = [];
  let offset = 0;

  while (true) {
    const url = new URL(pathname, supabaseUrl);
    url.searchParams.set('select', select);

    const response = await fetch(url, {
      headers: createHeaders(serviceRoleKey, {
        Range: `${offset}-${offset + pageSize - 1}`,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${pathname} query failed: ${text || response.status}`);
    }

    const batch = text ? JSON.parse(text) : [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

function collectTrackedEvents(rootDir) {
  const eventMap = new Map();
  const searchRoot = path.resolve(rootDir, 'src/renderer');

  walkFiles(searchRoot, (filePath) => {
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(rootDir, filePath);
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      let match;
      TRACK_REGEX.lastIndex = 0;
      while ((match = TRACK_REGEX.exec(lines[index])) !== null) {
        const eventName = match[1];
        const existing = eventMap.get(eventName) || [];
        existing.push(`${relativePath}:${index + 1}`);
        eventMap.set(eventName, existing);
      }
    }
  });

  return Array.from(eventMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([event, locations]) => ({
      event,
      locations,
    }));
}

function walkFiles(dirPath, visitor) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, visitor);
    } else if (entry.isFile()) {
      visitor(fullPath);
    }
  }
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = normalizeBucketKey(keyFn(item));
    counts[key] = (counts[key] || 0) + 1;
  }
  return sortCountMap(counts);
}

function sortCountMap(map) {
  return Object.fromEntries(
    Object.entries(map).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
  );
}

function normalizeBucketKey(value) {
  if (value === null || value === undefined) return 'unknown';
  const text = String(value).trim();
  return text || 'unknown';
}

function numericSum(items, valueFn) {
  return items.reduce((total, item) => total + (Number(valueFn(item)) || 0), 0);
}

function round(value, digits = 2) {
  return Number((Number(value) || 0).toFixed(digits));
}

function isoDay(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isoTimestamp(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function labelForRollup(rollup) {
  if (rollup.customer_email) {
    return rollup.customer_name
      ? `${rollup.customer_name} <${rollup.customer_email}>`
      : rollup.customer_email;
  }
  if (rollup.customer_name) return rollup.customer_name;

  const key = String(rollup.analytics_user_key || '').slice(0, 8) || 'unknown';
  return `${rollup.user_resolution || 'user'}:${key}`;
}

function buildRecentDayBuckets(feedbackRows, recentDays) {
  const today = new Date();
  const buckets = new Map();

  for (let offset = recentDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }

  for (const row of feedbackRows) {
    const day = isoDay(row.client_created_at || row.received_at);
    if (day && buckets.has(day)) {
      buckets.set(day, buckets.get(day) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([day, count]) => ({ day, count }));
}

function buildSessionLengthSummary(feedbackRows) {
  const byMode = {};
  let overallMin = null;
  let overallMax = null;
  let overallMinutes = 0;

  for (const row of feedbackRows) {
    const mode = normalizeBucketKey(row.session_mode);
    const duration = Number(row.session_duration_minutes) || 0;

    if (!byMode[mode]) {
      byMode[mode] = {
        sessions: 0,
        total_minutes: 0,
        min_minutes: null,
        max_minutes: null,
      };
    }

    byMode[mode].sessions += 1;
    byMode[mode].total_minutes += duration;
    byMode[mode].min_minutes = byMode[mode].min_minutes === null
      ? duration
      : Math.min(byMode[mode].min_minutes, duration);
    byMode[mode].max_minutes = byMode[mode].max_minutes === null
      ? duration
      : Math.max(byMode[mode].max_minutes, duration);

    overallMinutes += duration;
    overallMin = overallMin === null ? duration : Math.min(overallMin, duration);
    overallMax = overallMax === null ? duration : Math.max(overallMax, duration);
  }

  for (const values of Object.values(byMode)) {
    values.total_minutes = round(values.total_minutes);
    values.avg_minutes = round(values.total_minutes / Math.max(values.sessions, 1));
    values.min_minutes = round(values.min_minutes);
    values.max_minutes = round(values.max_minutes);
  }

  return {
    overall: {
      sessions: feedbackRows.length,
      total_minutes: round(overallMinutes),
      avg_minutes: round(overallMinutes / Math.max(feedbackRows.length, 1)),
      min_minutes: round(overallMin),
      max_minutes: round(overallMax),
    },
    by_mode: byMode,
  };
}

function buildSummary({ rollups, feedbackRows, installations, windows, topUsers, recentDays, trackedEvents, envPath, supabaseUrl }) {
  const sessionLengths = buildSessionLengthSummary(feedbackRows);
  const now = new Date();
  const windowSummaries = windows.map((days) => {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const feedbackUsers = rollups.filter((row) => {
      const value = row.last_feedback_at ? new Date(row.last_feedback_at) : null;
      return value && !Number.isNaN(value.getTime()) && value >= cutoff;
    }).length;
    const installsWithFeedback = installations.filter((row) => {
      const value = row.last_seen_at ? new Date(row.last_seen_at) : null;
      return value && !Number.isNaN(value.getTime()) && value >= cutoff;
    }).length;

    return {
      days,
      feedback_active_users: feedbackUsers,
      installs_with_feedback: installsWithFeedback,
    };
  });

  const topRollups = rollups
    .slice()
    .sort((a, b) => {
      const countDiff = (Number(b.feedback_row_count) || 0) - (Number(a.feedback_row_count) || 0);
      if (countDiff !== 0) return countDiff;
      return String(a.analytics_user_key || '').localeCompare(String(b.analytics_user_key || ''));
    })
    .slice(0, topUsers)
    .map((row) => ({
      label: labelForRollup(row),
      user_resolution: row.user_resolution || 'unknown',
      feedback_row_count: Number(row.feedback_row_count) || 0,
      distinct_feedback_session_count: Number(row.distinct_feedback_session_count) || 0,
      total_feedback_session_minutes: round(row.total_feedback_session_minutes),
      avg_feedback_session_minutes: round(row.avg_feedback_session_minutes),
      first_feedback_at: isoTimestamp(row.first_feedback_at),
      last_feedback_at: isoTimestamp(row.last_feedback_at),
      last_app_version: row.last_app_version || 'unknown',
      last_channel: row.last_channel || 'unknown',
    }));

  return {
    generated_at: new Date().toISOString(),
    source: {
      supabase_host: new URL(supabaseUrl).host,
      env_path: envPath,
      caveats: [
        'Supabase metrics here are feedback-backed, not true app-open DAU/WAU.',
        'app_installations.last_seen_at only advances when feedback rows are ingested.',
        'The official PostHog CLI does not support analytics querying, so PostHog output here is an instrumentation audit from source.',
      ],
    },
    who: {
      feedback_backed_users_total: rollups.length,
      users_by_resolution: countBy(rollups, (row) => row.user_resolution || 'unknown'),
      identified_customer_users: rollups.filter((row) => row.customer_email || row.customer_name).length,
      anonymous_install_users: rollups.filter((row) => row.user_resolution === 'install').length,
      installs_total: installations.length,
      installs_by_latest_app_version: countBy(installations, (row) => row.app_version || 'unknown'),
    },
    how_often: {
      active_windows: windowSummaries,
      feedback_rows_total: feedbackRows.length,
      feedback_minutes_total: round(numericSum(feedbackRows, (row) => row.session_duration_minutes)),
      session_lengths: sessionLengths,
      recent_feedback_days: buildRecentDayBuckets(feedbackRows, recentDays),
      top_users: topRollups,
    },
    in_what_ways: {
      feedback_by_surface: countBy(feedbackRows, (row) => row.surface || 'unknown'),
      feedback_by_completion_type: countBy(feedbackRows, (row) => row.completion_type || 'unknown'),
      feedback_by_session_mode: countBy(feedbackRows, (row) => row.session_mode || 'unknown'),
      thumbs: countBy(feedbackRows, (row) => row.feedback || 'unknown'),
      posthog: {
        distinct_id_strategy: 'license_instance_id first, then install_id',
        unique_event_count: trackedEvents.length,
        events: trackedEvents,
      },
    },
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function formatWindowSummary(windowSummary) {
  return `${windowSummary.days}d: ${formatNumber(windowSummary.feedback_active_users)} feedback-active users, ${formatNumber(windowSummary.installs_with_feedback)} installs with feedback`;
}

function formatTopUser(row) {
  return `${row.label} | ${row.feedback_row_count} feedback rows | ${row.distinct_feedback_session_count} sessions | ${row.total_feedback_session_minutes} min | last ${row.last_feedback_at || 'unknown'}`;
}

function formatCountMap(map) {
  return Object.entries(map).map(([key, count]) => `${key}: ${formatNumber(count)}`);
}

function printPrettyReport(summary) {
  console.log('Focana Analytics Snapshot');
  console.log(`Generated: ${summary.generated_at}`);
  console.log(`Supabase host: ${summary.source.supabase_host}`);
  console.log(`Env file: ${summary.source.env_path || 'process environment only'}`);
  console.log('');
  console.log('Caveats');
  for (const caveat of summary.source.caveats) {
    console.log(`- ${caveat}`);
  }
  console.log('');
  console.log('Who');
  console.log(`- Feedback-backed users: ${formatNumber(summary.who.feedback_backed_users_total)}`);
  console.log(`- Identified customer users: ${formatNumber(summary.who.identified_customer_users)}`);
  console.log(`- Anonymous install users: ${formatNumber(summary.who.anonymous_install_users)}`);
  console.log(`- Total installs: ${formatNumber(summary.who.installs_total)}`);
  console.log(`- By resolution: ${formatCountMap(summary.who.users_by_resolution).join(' | ')}`);
  console.log(`- Latest install versions: ${formatCountMap(summary.who.installs_by_latest_app_version).join(' | ')}`);
  console.log('');
  console.log('How Often');
  for (const windowSummary of summary.how_often.active_windows) {
    console.log(`- ${formatWindowSummary(windowSummary)}`);
  }
  console.log(`- Feedback rows: ${formatNumber(summary.how_often.feedback_rows_total)}`);
  console.log(`- Feedback minutes: ${formatNumber(summary.how_often.feedback_minutes_total)}`);
  console.log(`- Overall average session length: ${summary.how_often.session_lengths.overall.avg_minutes} min`);
  console.log('- Session length by mode:');
  for (const [mode, values] of Object.entries(summary.how_often.session_lengths.by_mode)) {
    console.log(`  ${mode}: ${formatNumber(values.sessions)} sessions | avg ${values.avg_minutes} min | total ${formatNumber(values.total_minutes)} min`);
  }
  console.log('- Recent feedback days:');
  for (const bucket of summary.how_often.recent_feedback_days) {
    console.log(`  ${bucket.day}: ${formatNumber(bucket.count)}`);
  }
  console.log('- Top users:');
  for (const row of summary.how_often.top_users) {
    console.log(`  ${formatTopUser(row)}`);
  }
  console.log('');
  console.log('In What Ways');
  console.log(`- Session mode: ${formatCountMap(summary.in_what_ways.feedback_by_session_mode).join(' | ')}`);
  console.log(`- Completion type: ${formatCountMap(summary.in_what_ways.feedback_by_completion_type).join(' | ')}`);
  console.log(`- Feedback surface: ${formatCountMap(summary.in_what_ways.feedback_by_surface).join(' | ')}`);
  console.log(`- Feedback sentiment: ${formatCountMap(summary.in_what_ways.thumbs).join(' | ')}`);
  console.log(`- PostHog event coverage (${formatNumber(summary.in_what_ways.posthog.unique_event_count)} events):`);
  for (const event of summary.in_what_ways.posthog.events) {
    console.log(`  ${event.event}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable in this Node runtime.');
  }

  const envPath = findEnvPath(options.envPath || process.env.FOCANA_ANALYTICS_ENV_PATH || '');
  const config = resolveSupabaseConfig(envPath);
  const repoRoot = path.resolve(__dirname, '..');

  const [rollups, feedbackRows, installations] = await Promise.all([
    fetchAllRows({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
      pathname: '/rest/v1/app_feedback_user_rollups',
      select: [
        'analytics_user_key',
        'user_resolution',
        'customer_email',
        'customer_name',
        'feedback_row_count',
        'distinct_feedback_session_count',
        'total_feedback_session_minutes',
        'avg_feedback_session_minutes',
        'first_feedback_at',
        'last_feedback_at',
        'last_app_version',
        'last_channel',
      ].join(','),
    }),
    fetchAllRows({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
      pathname: '/rest/v1/app_session_feedback',
      select: [
        'id',
        'feedback',
        'surface',
        'completion_type',
        'session_mode',
        'session_duration_minutes',
        'client_created_at',
        'received_at',
      ].join(','),
    }),
    fetchAllRows({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
      pathname: '/rest/v1/app_installations',
      select: [
        'id',
        'install_id',
        'license_instance_id',
        'app_version',
        'first_seen_at',
        'last_seen_at',
      ].join(','),
    }),
  ]);

  const trackedEvents = collectTrackedEvents(repoRoot);
  const summary = buildSummary({
    rollups,
    feedbackRows,
    installations,
    windows: options.windows,
    topUsers: options.topUsers,
    recentDays: options.recentDays,
    trackedEvents,
    envPath: config.envPath,
    supabaseUrl: config.supabaseUrl,
  });

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  printPrettyReport(summary);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[analytics-report] ${message}`);
  process.exit(1);
});
