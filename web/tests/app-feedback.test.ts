import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  normalizeFeedbackItem,
  storeFeedbackRows,
  type AppFeedbackStore,
  type FeedbackWriteRow,
  type InstallationRow,
} from '../src/lib/appFeedbackService.ts';

class MemoryAppFeedbackStore implements AppFeedbackStore {
  installations: InstallationRow[] = [];
  feedbackRows: FeedbackWriteRow[] = [];
  nextInstallationId = 1;

  async findInstallationByInstallId(installId: string) {
    return this.clone(this.installations.find((row) => row.install_id === installId) || null);
  }

  async findInstallationByLicenseInstanceId(licenseInstanceId: string) {
    return this.clone(
      this.installations.find((row) => row.license_instance_id === licenseInstanceId) || null
    );
  }

  async createInstallation(input: {
    install_id: string;
    license_instance_id: string | null;
    app_version: string | null;
    os_version: string | null;
    channel: string;
    first_seen_at: string;
    last_seen_at: string;
  }) {
    this.assertUniqueInstallId(input.install_id);
    this.assertUniqueLicense(input.license_instance_id);

    const row: InstallationRow = {
      id: `installation-${this.nextInstallationId++}`,
      install_id: input.install_id,
      license_instance_id: input.license_instance_id,
      app_version: input.app_version,
      os_version: input.os_version,
      channel: input.channel,
      first_seen_at: input.first_seen_at,
      last_seen_at: input.last_seen_at,
      created_at: input.first_seen_at,
      updated_at: input.last_seen_at,
    };

    this.installations.push(row);
    return this.clone(row);
  }

  async updateInstallation(
    id: string,
    patch: Partial<{
      install_id: string;
      license_instance_id: string | null;
      app_version: string | null;
      os_version: string | null;
      channel: string;
      first_seen_at: string;
      last_seen_at: string;
    }>
  ) {
    const index = this.installations.findIndex((row) => row.id === id);
    if (index === -1) {
      throw new Error(`Unknown installation ${id}`);
    }

    const nextRow = {
      ...this.installations[index],
      ...patch,
      updated_at:
        patch.last_seen_at ||
        patch.first_seen_at ||
        this.installations[index].updated_at,
    };

    this.assertUniqueInstallId(nextRow.install_id, id);
    this.assertUniqueLicense(nextRow.license_instance_id, id);
    this.installations[index] = nextRow;
    return this.clone(nextRow);
  }

  async upsertFeedbackRows(rows: FeedbackWriteRow[]) {
    for (const row of rows) {
      const existingIndex = this.feedbackRows.findIndex((existing) => existing.id === row.id);
      if (existingIndex === -1) {
        this.feedbackRows.push(this.clone(row));
      } else {
        this.feedbackRows[existingIndex] = this.clone(row);
      }
    }
  }

  private assertUniqueInstallId(installId: string, ignoreId?: string) {
    const duplicate = this.installations.find(
      (row) => row.install_id === installId && row.id !== ignoreId
    );
    if (duplicate) {
      throw new Error(`Duplicate install_id ${installId}`);
    }
  }

  private assertUniqueLicense(licenseInstanceId: string | null, ignoreId?: string) {
    if (!licenseInstanceId) return;
    const duplicate = this.installations.find(
      (row) => row.license_instance_id === licenseInstanceId && row.id !== ignoreId
    );
    if (duplicate) {
      throw new Error(`Duplicate license_instance_id ${licenseInstanceId}`);
    }
  }

  private clone<T>(value: T) {
    return value === null ? null : structuredClone(value);
  }
}

function makeRow(
  id: string,
  overrides: Partial<{
    feedback: 'up' | 'down';
    surface: string;
    completionType: string;
    sessionMode: 'freeflow' | 'timed';
    sessionDurationMinutes: number;
    clientCreatedAt: string;
    appVersion: string;
    osVersion: string;
    channel: string;
    installId: string;
    licenseInstanceId: string | null;
  }> = {}
) {
  const normalized = normalizeFeedbackItem({
    id,
    feedback: 'up',
    surface: 'notes-modal',
    completionType: 'completed',
    sessionMode: 'freeflow',
    sessionDurationMinutes: 25,
    clientCreatedAt: '2026-03-19T12:00:00.000Z',
    appVersion: '1.0.0',
    osVersion: 'macOS 15.4',
    channel: 'latest',
    installId: 'install-1',
    licenseInstanceId: null,
    ...overrides,
  });

  if (!normalized) {
    throw new Error('Expected normalized feedback row');
  }

  return normalized;
}

function createLogger() {
  const warnings: string[] = [];
  return {
    warnings,
    logger: {
      warn: (...args: unknown[]) => {
        warnings.push(args.map((value) => String(value)).join(' '));
      },
    },
  };
}

test('normalizeFeedbackItem preserves backward-compatible payload fields', () => {
  const row = normalizeFeedbackItem({
    id: '  feedback-1  ',
    feedback: 'up',
    surface: 'session-modal',
    completionType: 'stopped',
    sessionMode: 'timed',
    sessionDurationMinutes: '42.5',
    clientCreatedAt: '2026-03-19T10:00:00.000Z',
    appVersion: ' 1.0.1 ',
    osVersion: ' macOS 15.4 ',
    channel: ' beta ',
    installId: ' install-123 ',
    licenseInstanceId: ' license-123 ',
  });

  assert.deepEqual(row, {
    id: 'feedback-1',
    session_id: null,
    feedback: 'up',
    surface: 'session-modal',
    completion_type: 'stopped',
    session_mode: 'timed',
    session_duration_minutes: 42.5,
    client_created_at: '2026-03-19T10:00:00.000Z',
    app_version: '1.0.1',
    os_version: 'macOS 15.4',
    channel: 'beta',
    install_id: 'install-123',
    license_instance_id: 'license-123',
  });
});

test('new feedback creates one installation row and one linked feedback row', async () => {
  const store = new MemoryAppFeedbackStore();

  const writtenRows = await storeFeedbackRows([makeRow('feedback-1')], {
    store,
  });

  assert.equal(store.installations.length, 1);
  assert.equal(store.feedbackRows.length, 1);
  assert.equal(writtenRows[0].installation_id, store.installations[0].id);
  assert.equal(store.feedbackRows[0].installation_id, store.installations[0].id);
});

test('repeated feedback reuses the same installation row and updates last_seen_at', async () => {
  const store = new MemoryAppFeedbackStore();

  await storeFeedbackRows([makeRow('feedback-1', {
    clientCreatedAt: '2026-03-19T12:00:00.000Z',
    appVersion: '1.0.0',
  })], { store });

  const firstInstallationId = store.installations[0].id;

  await storeFeedbackRows([makeRow('feedback-2', {
    clientCreatedAt: '2026-03-19T14:30:00.000Z',
    appVersion: '1.1.0',
  })], { store });

  assert.equal(store.installations.length, 1);
  assert.equal(store.installations[0].id, firstInstallationId);
  assert.equal(store.installations[0].last_seen_at, '2026-03-19T14:30:00.000Z');
  assert.equal(store.installations[0].app_version, '1.1.0');
});

test('later feedback enriches an existing installation with license_instance_id', async () => {
  const store = new MemoryAppFeedbackStore();

  await storeFeedbackRows([makeRow('feedback-1', {
    licenseInstanceId: null,
  })], { store });

  await storeFeedbackRows([makeRow('feedback-2', {
    clientCreatedAt: '2026-03-19T12:05:00.000Z',
    licenseInstanceId: 'license-1',
  })], { store });

  assert.equal(store.installations.length, 1);
  assert.equal(store.installations[0].license_instance_id, 'license-1');
});

test('license fallback reuses the existing installation row when install_id changes later', async () => {
  const store = new MemoryAppFeedbackStore();

  await storeFeedbackRows([makeRow('feedback-1', {
    installId: 'install-old',
    licenseInstanceId: 'license-1',
  })], { store });

  const existingInstallationId = store.installations[0].id;

  await storeFeedbackRows([makeRow('feedback-2', {
    installId: 'install-new',
    licenseInstanceId: 'license-1',
    clientCreatedAt: '2026-03-19T13:00:00.000Z',
  })], { store });

  assert.equal(store.installations.length, 1);
  assert.equal(store.installations[0].id, existingInstallationId);
  assert.equal(store.installations[0].install_id, 'install-new');
  assert.equal(store.feedbackRows[1].installation_id, existingInstallationId);
});

test('conflicting install_id and license_instance_id rows are not auto-merged', async () => {
  const store = new MemoryAppFeedbackStore();
  const { logger, warnings } = createLogger();

  await storeFeedbackRows([makeRow('feedback-1', {
    installId: 'install-a',
    licenseInstanceId: null,
  })], { store, logger });

  await storeFeedbackRows([makeRow('feedback-2', {
    installId: 'install-b',
    licenseInstanceId: 'license-shared',
  })], { store, logger });

  const installAMatch = store.installations.find((row) => row.install_id === 'install-a');
  const installBMatch = store.installations.find((row) => row.install_id === 'install-b');
  assert.ok(installAMatch);
  assert.ok(installBMatch);

  await storeFeedbackRows([makeRow('feedback-3', {
    installId: 'install-a',
    licenseInstanceId: 'license-shared',
    clientCreatedAt: '2026-03-19T13:30:00.000Z',
  })], { store, logger });

  const conflictFeedback = store.feedbackRows.find((row) => row.id === 'feedback-3');
  assert.equal(conflictFeedback?.installation_id, installAMatch.id);
  assert.equal(
    store.installations.find((row) => row.id === installAMatch.id)?.license_instance_id,
    null
  );
  assert.equal(
    store.installations.find((row) => row.id === installBMatch.id)?.license_instance_id,
    'license-shared'
  );
  assert.equal(warnings.length > 0, true);
});

test('blank install_id skips installation linking and still stores feedback', async () => {
  const store = new MemoryAppFeedbackStore();

  await storeFeedbackRows([makeRow('feedback-1', {
    installId: '   ',
  })], { store });

  assert.equal(store.installations.length, 0);
  assert.equal(store.feedbackRows.length, 1);
  assert.equal(store.feedbackRows[0].installation_id, null);
});

test('migration files define baseline tables and installation backfill', async () => {
  const baselineSql = await readFile(
    new URL('../supabase/migrations/001_baseline.sql', import.meta.url),
    'utf8'
  );
  const installSql = await readFile(
    new URL('../supabase/migrations/002_app_installations.sql', import.meta.url),
    'utf8'
  );

  assert.match(baselineSql, /create table if not exists public\."Beta_Downloads"/i);
  assert.match(baselineSql, /create table if not exists public\."Windows_Waitlist"/i);
  assert.match(baselineSql, /create table if not exists public\.customers/i);
  assert.match(baselineSql, /create table if not exists public\.app_session_feedback/i);

  assert.match(installSql, /create table if not exists public\.app_installations/i);
  assert.match(installSql, /add column if not exists installation_id uuid null/i);
  assert.match(installSql, /update public\.app_session_feedback as feedback/i);
});
