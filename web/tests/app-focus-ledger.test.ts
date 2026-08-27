import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  storeFocusLedgerBatch,
  type FocusCheckInInsertRow,
  type FocusLedgerStore,
  type FocusSegmentInsertRow,
  type FocusSessionInsertRow,
  type FocusSessionRow,
} from '../src/lib/appFocusLedgerService.ts';
import type { InstallationRow } from '../src/lib/appFeedbackService.ts';

class MemoryFocusLedgerStore implements FocusLedgerStore {
  installations: InstallationRow[] = [];
  sessions: FocusSessionRow[] = [];
  segments: FocusSegmentInsertRow[] = [];
  checkins: FocusCheckInInsertRow[] = [];
  customerLicenseMap = new Map<string, string>();
  nextInstallationId = 1;
  nextSessionId = 1;

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

  async updateInstallation(id: string, patch: Partial<{
    install_id: string;
    license_instance_id: string | null;
    app_version: string | null;
    os_version: string | null;
    channel: string;
    first_seen_at: string;
    last_seen_at: string;
  }>) {
    const index = this.installations.findIndex((row) => row.id === id);
    if (index === -1) throw new Error(`Unknown installation ${id}`);
    this.installations[index] = {
      ...this.installations[index],
      ...patch,
      updated_at: patch.last_seen_at || this.installations[index].updated_at,
    };
    return this.clone(this.installations[index]);
  }

  async findCustomerIdByLicenseInstanceId(licenseInstanceId: string) {
    return this.customerLicenseMap.get(licenseInstanceId) || null;
  }

  async upsertFocusSessions(rows: FocusSessionInsertRow[]) {
    const written: FocusSessionRow[] = [];
    for (const row of rows) {
      const existingIndex = this.sessions.findIndex((existing) => (
        existing.installation_id === row.installation_id
        && existing.local_session_id === row.local_session_id
      ));
      const nextRow: FocusSessionRow = {
        id: existingIndex === -1 ? `session-${this.nextSessionId++}` : this.sessions[existingIndex].id,
        ...this.clone(row),
      };
      if (existingIndex === -1) {
        this.sessions.push(nextRow);
      } else {
        this.sessions[existingIndex] = nextRow;
      }
      written.push(this.clone(nextRow));
    }
    return written;
  }

  async findFocusSession(installationId: string, localSessionId: string) {
    return this.clone(
      this.sessions.find((row) => (
        row.installation_id === installationId
        && row.local_session_id === localSessionId
      )) || null
    );
  }

  async upsertFocusSegments(rows: FocusSegmentInsertRow[]) {
    for (const row of rows) {
      const existingIndex = this.segments.findIndex((existing) => (
        existing.installation_id === row.installation_id
        && existing.local_segment_id === row.local_segment_id
      ));
      if (existingIndex === -1) {
        this.segments.push(this.clone(row));
      } else {
        this.segments[existingIndex] = this.clone(row);
      }
    }
  }

  async upsertFocusCheckIns(rows: FocusCheckInInsertRow[]) {
    for (const row of rows) {
      const existingIndex = this.checkins.findIndex((existing) => (
        existing.installation_id === row.installation_id
        && existing.local_checkin_id === row.local_checkin_id
      ));
      if (existingIndex === -1) {
        this.checkins.push(this.clone(row));
      } else {
        this.checkins[existingIndex] = this.clone(row);
      }
    }
  }

  private clone<T>(value: T) {
    return value === null ? null : structuredClone(value);
  }
}

test('focus ledger batch stores sessions, segments, and check-ins idempotently', async () => {
  const store = new MemoryFocusLedgerStore();
  store.customerLicenseMap.set('license-1', 'customer-1');

  const batch = {
    sessions: [{
      localSessionId: 'session-local-1',
      installId: 'install-1',
      licenseInstanceId: 'license-1',
      mode: 'pomodoro',
      startedAt: '2026-07-07T15:00:00.000Z',
      endedAt: '2026-07-07T15:25:00.000Z',
      activeSeconds: 1500,
      outcome: 'completed',
      completed: true,
      taskTitle: ' Write onboarding copy ',
      taskTitleIncluded: true,
      appVersion: '2.5.0',
      channel: 'latest',
      clientUpdatedAt: '2026-07-07T15:25:00.000Z',
    }],
    segments: [{
      localSegmentId: 'segment-local-1',
      localSessionId: 'session-local-1',
      segmentType: 'subtask',
      parentTaskTitle: 'Write onboarding copy',
      focusTitle: 'Draft headline',
      focusTitleIncluded: true,
      subtaskLocalId: 'subtask-1',
      startedAt: '2026-07-07T15:05:00.000Z',
      endedAt: '2026-07-07T15:15:00.000Z',
      activeSeconds: 600,
      completed: true,
      completionEventAt: '2026-07-07T15:15:00.000Z',
    }],
    checkins: [{
      localCheckinId: 'checkin-local-1',
      localSessionId: 'session-local-1',
      shownAt: '2026-07-07T15:10:00.000Z',
      status: 'detour',
      elapsedActiveSeconds: 600,
      taskTitle: 'Write onboarding copy',
      subtaskTitle: 'Draft headline',
      focusTitleIncluded: true,
      detourNotePresent: true,
    }],
  };

  const firstResult = await storeFocusLedgerBatch(batch, { store });
  const secondResult = await storeFocusLedgerBatch(batch, { store });

  assert.deepEqual(firstResult.acceptedIds.sort(), [
    'checkin:checkin-local-1',
    'segment:segment-local-1',
    'session:session-local-1',
  ]);
  assert.deepEqual(secondResult.acceptedIds.sort(), firstResult.acceptedIds.sort());
  assert.equal(store.installations.length, 1);
  assert.equal(store.sessions.length, 1);
  assert.equal(store.segments.length, 1);
  assert.equal(store.checkins.length, 1);
  assert.equal(store.sessions[0].customer_id, 'customer-1');
  assert.equal(store.sessions[0].task_title, 'Write onboarding copy');
  assert.equal(store.segments[0].focus_title, 'Draft headline');
  assert.equal(store.checkins[0].detour_note_present, true);
});

test('focus ledger suppresses task titles when title inclusion is disabled', async () => {
  const store = new MemoryFocusLedgerStore();

  await storeFocusLedgerBatch({
    sessions: [{
      localSessionId: 'private-session',
      installId: 'install-private',
      startedAt: '2026-07-07T15:00:00.000Z',
      activeSeconds: 120,
      taskTitle: 'Private legal task',
      taskTitleIncluded: false,
      clientUpdatedAt: '2026-07-07T15:02:00.000Z',
    }],
    segments: [{
      localSegmentId: 'private-segment',
      localSessionId: 'private-session',
      parentTaskTitle: 'Private legal task',
      focusTitle: 'Read clause 12',
      focusTitleIncluded: false,
      startedAt: '2026-07-07T15:00:00.000Z',
      activeSeconds: 120,
    }],
  }, { store });

  assert.equal(store.sessions[0].task_title, null);
  assert.match(store.sessions[0].task_hash, /^sha256:/);
  assert.equal(store.segments[0].parent_task_title, null);
  assert.equal(store.segments[0].focus_title, null);
  assert.match(store.segments[0].focus_hash, /^sha256:/);
});

test('focus ledger migration defines tables and rollups', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/010_focus_ledger.sql', import.meta.url),
    'utf8'
  );

  assert.match(sql, /create table if not exists public\.app_focus_sessions/i);
  assert.match(sql, /create table if not exists public\.app_focus_segments/i);
  assert.match(sql, /create table if not exists public\.app_focus_checkins/i);
  assert.match(sql, /create table if not exists public\.app_focus_milestones/i);
  assert.match(sql, /create table if not exists public\.app_focus_weekly_emails/i);
  assert.match(sql, /create or replace view public\.app_focus_user_rollups/i);
  assert.match(sql, /create or replace view public\.app_focus_task_rollups/i);
  assert.match(sql, /create or replace view public\.app_focus_weekly_rollups/i);
});
