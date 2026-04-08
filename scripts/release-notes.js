#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const notesRoot = path.join(projectRoot, 'release-notes');
const defaultLandingRoot = path.resolve(projectRoot, '../focana-landing');
const packageJsonPath = path.join(projectRoot, 'package.json');
const defaultVersion = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;

function info(message) {
  process.stdout.write(`[release-notes] ${message}\n`);
}

function warn(message) {
  process.stderr.write(`[release-notes] Warning: ${message}\n`);
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      parsed._.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function ensureStringArray(value) {
  if (!Array.isArray(value)) return false;
  return value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDisplayDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    fail(`Could not format published date: ${value}`);
  }
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function parseVersionParts(version) {
  const [core, prerelease = ''] = String(version || '').split('-', 2);
  const parts = core.split('.').map((part) => Number.parseInt(part, 10));
  return {
    parts: [
      Number.isFinite(parts[0]) ? parts[0] : 0,
      Number.isFinite(parts[1]) ? parts[1] : 0,
      Number.isFinite(parts[2]) ? parts[2] : 0,
    ],
    prerelease,
  };
}

function compareVersionsDesc(left, right) {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);

  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) {
      return b.parts[index] - a.parts[index];
    }
  }

  if (a.prerelease && !b.prerelease) return 1;
  if (!a.prerelease && b.prerelease) return -1;
  return b.prerelease.localeCompare(a.prerelease);
}

function getNotePath(version) {
  return path.join(notesRoot, `${version}.json`);
}

function validateReleaseNote(note, { expectedVersion, filePath }) {
  const errors = [];
  const fixes = Array.isArray(note?.fixes) ? note.fixes : [];
  const improvements = Array.isArray(note?.improvements) ? note.improvements : [];

  if (!note || typeof note !== 'object' || Array.isArray(note)) {
    return ['Release note must be a JSON object.'];
  }

  if (typeof note.version !== 'string' || !note.version.trim()) {
    errors.push('`version` must be a non-empty string.');
  }

  if (expectedVersion && note.version !== expectedVersion) {
    errors.push(`\`version\` must match ${expectedVersion}.`);
  }

  if (!isIsoDate(note.publishedAt)) {
    errors.push('`publishedAt` must be an ISO date in YYYY-MM-DD format.');
  }

  if (Object.prototype.hasOwnProperty.call(note, 'summary') && (typeof note.summary !== 'string' || !note.summary.trim())) {
    errors.push('`summary` must be a non-empty string when present.');
  }

  if (!ensureStringArray(fixes)) {
    errors.push('`fixes` must be an array of non-empty strings.');
  }

  if (!ensureStringArray(improvements)) {
    errors.push('`improvements` must be an array of non-empty strings.');
  }

  if (fixes.length === 0 && improvements.length === 0) {
    errors.push('At least one entry is required in `fixes` or `improvements`.');
  }

  if (filePath) {
    const expectedFileName = `${note.version}.json`;
    const actualFileName = path.basename(filePath);
    if (actualFileName !== expectedFileName) {
      errors.push(`File name must match version (${expectedFileName}).`);
    }
  }

  return errors;
}

function loadReleaseNote(version) {
  const filePath = getNotePath(version);
  if (!fs.existsSync(filePath)) {
    fail(`Missing release notes file: ${path.relative(projectRoot, filePath)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Could not parse ${path.relative(projectRoot, filePath)}: ${error.message}`);
  }

  const errors = validateReleaseNote(parsed, { expectedVersion: version, filePath });
  if (errors.length > 0) {
    fail(`Malformed release notes in ${path.relative(projectRoot, filePath)}:\n- ${errors.join('\n- ')}`);
  }

  return normalizeReleaseNote(parsed);
}

function normalizeReleaseNote(note) {
  return {
    version: note.version,
    publishedAt: note.publishedAt,
    displayDate: formatDisplayDate(note.publishedAt),
    summary: typeof note.summary === 'string' ? note.summary.trim() : '',
    fixes: Array.isArray(note.fixes) ? note.fixes.map((item) => item.trim()) : [],
    improvements: Array.isArray(note.improvements) ? note.improvements.map((item) => item.trim()) : [],
  };
}

function loadAllReleaseNotes() {
  if (!fs.existsSync(notesRoot)) {
    fail(`Missing release-notes directory: ${notesRoot}`);
  }

  const fileNames = fs.readdirSync(notesRoot)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => compareVersionsDesc(left.replace(/\.json$/, ''), right.replace(/\.json$/, '')));

  const releases = [];
  const warnings = [];

  for (const fileName of fileNames) {
    const filePath = path.join(notesRoot, fileName);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const errors = validateReleaseNote(raw, { filePath });
      if (errors.length > 0) {
        warnings.push(`${path.relative(projectRoot, filePath)} skipped:\n- ${errors.join('\n- ')}`);
        continue;
      }
      releases.push(normalizeReleaseNote(raw));
    } catch (error) {
      warnings.push(`${path.relative(projectRoot, filePath)} skipped: ${error.message}`);
    }
  }

  releases.sort((left, right) => compareVersionsDesc(left.version, right.version));
  return { releases, warnings };
}

function renderGitHubNotes(release) {
  const lines = [
    `## Focana ${release.version}`,
    '',
    release.displayDate,
  ];

  if (release.summary) {
    lines.push('', release.summary);
  }

  if (release.fixes.length > 0) {
    lines.push('', '### Fixes');
    for (const item of release.fixes) {
      lines.push(`- ${item}`);
    }
  }

  if (release.improvements.length > 0) {
    lines.push('', '### Improvements');
    for (const item of release.improvements) {
      lines.push(`- ${item}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function syncLandingData(landingRoot) {
  const { releases, warnings } = loadAllReleaseNotes();
  warnings.forEach(warn);

  if (releases.length === 0) {
    fail('No valid release notes were found to sync.');
  }

  const dataDir = path.join(landingRoot, 'src', 'data');
  const outputPath = path.join(dataDir, 'releases.json');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(releases, null, 2)}\n`);
  info(`Synced ${releases.length} release note(s) to ${path.relative(landingRoot, outputPath)}`);
}

function usage() {
  process.stdout.write([
    'Usage:',
    '  node scripts/release-notes.js validate [--version 1.3.2]',
    '  node scripts/release-notes.js render-github [--version 1.3.2]',
    '  node scripts/release-notes.js sync-landing [--landing-root ../focana-landing]',
    '',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv);
  const [command] = args._;
  const version = String(args.version || defaultVersion).trim();

  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }

  if (command === 'validate') {
    const release = loadReleaseNote(version);
    info(`Validated release notes for ${release.version}`);
    return;
  }

  if (command === 'render-github') {
    const release = loadReleaseNote(version);
    process.stdout.write(renderGitHubNotes(release));
    return;
  }

  if (command === 'sync-landing') {
    const landingRoot = path.resolve(String(args['landing-root'] || defaultLandingRoot));
    syncLandingData(landingRoot);
    return;
  }

  fail(`Unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`[release-notes] ${error.message}\n`);
  process.exit(1);
});
