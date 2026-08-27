import { createHash } from 'node:crypto';

import {
  clampText,
  safeIso,
  type InstallationRow,
  type LoggerLike,
} from './appFeedbackService.ts';

export const MAX_LEDGER_BATCH_SIZE = 100;

type FetchLike = typeof fetch;

type InstallationCreateInput = {
  install_id: string;
  license_instance_id: string | null;
  app_version: string | null;
  os_version: string | null;
  channel: string;
  first_seen_at: string;
  last_seen_at: string;
};

type InstallationUpdateInput = Partial<InstallationCreateInput> & {
  install_id?: string;
};

export type RawFocusSession = {
  localSessionId?: unknown;
  installId?: unknown;
  licenseInstanceId?: unknown;
  precision?: unknown;
  mode?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  activeSeconds?: unknown;
  wallClockSeconds?: unknown;
  pausedSeconds?: unknown;
  breakSeconds?: unknown;
  outcome?: unknown;
  completed?: unknown;
  kept?: unknown;
  taskTitle?: unknown;
  taskHash?: unknown;
  taskTitleIncluded?: unknown;
  weeklyEmails?: unknown;
  milestoneEmails?: unknown;
  appVersion?: unknown;
  osVersion?: unknown;
  channel?: unknown;
  timezone?: unknown;
  clientUpdatedAt?: unknown;
};

export type RawFocusSegment = {
  localSegmentId?: unknown;
  localSessionId?: unknown;
  installId?: unknown;
  licenseInstanceId?: unknown;
  segmentType?: unknown;
  parentTaskTitle?: unknown;
  parentTaskHash?: unknown;
  focusTitle?: unknown;
  focusHash?: unknown;
  focusTitleIncluded?: unknown;
  subtaskLocalId?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  activeSeconds?: unknown;
  completed?: unknown;
  completionEventAt?: unknown;
};

export type RawFocusCheckIn = {
  localCheckinId?: unknown;
  localSessionId?: unknown;
  installId?: unknown;
  licenseInstanceId?: unknown;
  shownAt?: unknown;
  respondedAt?: unknown;
  missedAt?: unknown;
  status?: unknown;
  elapsedActiveSeconds?: unknown;
  taskTitle?: unknown;
  taskHash?: unknown;
  subtaskTitle?: unknown;
  subtaskHash?: unknown;
  focusTitleIncluded?: unknown;
  detourNotePresent?: unknown;
};

export type FocusSessionInsertRow = {
  local_session_id: string;
  installation_id: string;
  install_id: string;
  license_instance_id: string | null;
  customer_id: string | null;
  precision: 'segment_v1' | 'session_only_backfill';
  mode: 'freeflow' | 'timed' | 'pomodoro';
  started_at: string;
  ended_at: string | null;
  active_seconds: number;
  wall_clock_seconds: number;
  paused_seconds: number;
  break_seconds: number;
  outcome: 'started' | 'completed' | 'kept' | 'saved_for_later' | 'done_for_now' | 'moved_to_next' | 'discarded' | 'unknown';
  completed: boolean;
  kept: boolean;
  task_title: string | null;
  task_hash: string;
  task_title_included: boolean;
  weekly_emails_enabled: boolean;
  milestone_emails_enabled: boolean;
  app_version: string;
  os_version: string;
  channel: string;
  timezone: string;
  client_updated_at: string;
};

export type FocusSessionRow = FocusSessionInsertRow & {
  id: string;
};

export type FocusSegmentInsertRow = {
  local_segment_id: string;
  local_session_id: string;
  focus_session_id: string;
  installation_id: string;
  customer_id: string | null;
  segment_type: 'main_task' | 'subtask';
  parent_task_title: string | null;
  parent_task_hash: string;
  focus_title: string | null;
  focus_hash: string;
  focus_title_included: boolean;
  subtask_local_id: string | null;
  started_at: string;
  ended_at: string | null;
  active_seconds: number;
  completed: boolean;
  completion_event_at: string | null;
};

export type FocusCheckInInsertRow = {
  local_checkin_id: string;
  local_session_id: string;
  focus_session_id: string;
  installation_id: string;
  customer_id: string | null;
  shown_at: string;
  responded_at: string | null;
  missed_at: string | null;
  status: 'focused' | 'completed' | 'detour' | 'missed';
  elapsed_active_seconds: number;
  task_title: string | null;
  task_hash: string;
  subtask_title: string | null;
  subtask_hash: string | null;
  focus_title_included: boolean;
  detour_note_present: boolean;
};

export type FocusLedgerStore = {
  findInstallationByInstallId: (installId: string) => Promise<InstallationRow | null>;
  findInstallationByLicenseInstanceId: (licenseInstanceId: string) => Promise<InstallationRow | null>;
  createInstallation: (input: InstallationCreateInput) => Promise<InstallationRow>;
  updateInstallation: (id: string, patch: InstallationUpdateInput) => Promise<InstallationRow>;
  findCustomerIdByLicenseInstanceId: (licenseInstanceId: string) => Promise<string | null>;
  upsertFocusSessions: (rows: FocusSessionInsertRow[]) => Promise<FocusSessionRow[]>;
  findFocusSession: (installationId: string, localSessionId: string) => Promise<FocusSessionRow | null>;
  upsertFocusSegments: (rows: FocusSegmentInsertRow[]) => Promise<void>;
  upsertFocusCheckIns: (rows: FocusCheckInInsertRow[]) => Promise<void>;
};

export type StoreFocusLedgerResult = {
  acceptedIds: string[];
  acceptedSessionIds: string[];
  acceptedSegmentIds: string[];
  acceptedCheckinIds: string[];
};

const INSTALLATION_SELECT =
  'id,install_id,license_instance_id,app_version,os_version,channel,first_seen_at,last_seen_at,created_at,updated_at';
const SESSION_SELECT =
  'id,local_session_id,installation_id,install_id,license_instance_id,customer_id,precision,mode,started_at,ended_at,active_seconds,wall_clock_seconds,paused_seconds,break_seconds,outcome,completed,kept,task_title,task_hash,task_title_included,weekly_emails_enabled,milestone_emails_enabled,app_version,os_version,channel,timezone,client_updated_at';

function hashLedgerText(value: string, fallback = 'unknown') {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase() || fallback;
  return `sha256:${createHash('sha256').update(normalized).digest('hex')}`;
}

function clampNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.round(next)) : fallback;
}

function normalizeMode(value: unknown): FocusSessionInsertRow['mode'] {
  return value === 'timed' || value === 'pomodoro' ? value : 'freeflow';
}

function normalizePrecision(value: unknown): FocusSessionInsertRow['precision'] {
  return value === 'session_only_backfill' ? 'session_only_backfill' : 'segment_v1';
}

function normalizeOutcome(value: unknown): FocusSessionInsertRow['outcome'] {
  const safe = clampText(value, 40);
  switch (safe) {
    case 'started':
    case 'completed':
    case 'kept':
    case 'saved_for_later':
    case 'done_for_now':
    case 'moved_to_next':
    case 'discarded':
      return safe;
    default:
      return 'unknown';
  }
}

function normalizeStatus(value: unknown): FocusCheckInInsertRow['status'] | null {
  switch (value) {
    case 'focused':
    case 'completed':
    case 'detour':
    case 'missed':
      return value;
    default:
      return null;
  }
}

function normalizeSegmentType(value: unknown): FocusSegmentInsertRow['segment_type'] {
  return value === 'subtask' ? 'subtask' : 'main_task';
}

function normalizeTitleFields({
  title,
  hash,
  included,
}: {
  title: unknown;
  hash: unknown;
  included: unknown;
}) {
  const safeTitle = clampText(title, 500);
  const safeHash = clampText(hash, 96);
  const shouldIncludeTitle = included === true && Boolean(safeTitle);
  return {
    title: shouldIncludeTitle ? safeTitle : null,
    hash: safeHash || hashLedgerText(safeTitle),
    included: shouldIncludeTitle,
  };
}

function parseIsoToMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function hasKeys(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function buildInstallationPatch(
  existing: InstallationRow,
  event: {
    install_id: string;
    license_instance_id: string | null;
    app_version: string;
    os_version: string;
    channel: string;
    event_at: string;
  },
  {
    allowLicenseFill = false,
    allowInstallIdRewrite = false,
  }: {
    allowLicenseFill?: boolean;
    allowInstallIdRewrite?: boolean;
  } = {}
) {
  const patch: InstallationUpdateInput = {};
  const eventAtMs = parseIsoToMs(event.event_at);
  const firstSeenMs = parseIsoToMs(existing.first_seen_at);
  const lastSeenMs = parseIsoToMs(existing.last_seen_at);

  if (eventAtMs !== null && (firstSeenMs === null || eventAtMs < firstSeenMs)) {
    patch.first_seen_at = event.event_at;
  }

  if (eventAtMs !== null && (lastSeenMs === null || eventAtMs >= lastSeenMs)) {
    patch.last_seen_at = event.event_at;
    patch.app_version = event.app_version;
    patch.os_version = event.os_version;
    patch.channel = event.channel;
  }

  if (allowLicenseFill && event.license_instance_id && !existing.license_instance_id) {
    patch.license_instance_id = event.license_instance_id;
  }

  if (allowInstallIdRewrite && event.install_id && event.install_id !== existing.install_id) {
    patch.install_id = event.install_id;
  }

  return patch;
}

async function resolveInstallation(
  event: {
    install_id: string;
    license_instance_id: string | null;
    app_version: string;
    os_version: string;
    channel: string;
    event_at: string;
  },
  store: FocusLedgerStore,
  logger: LoggerLike
) {
  const installMatch = await store.findInstallationByInstallId(event.install_id);
  const licenseMatch = event.license_instance_id
    ? await store.findInstallationByLicenseInstanceId(event.license_instance_id)
    : null;

  if (installMatch && licenseMatch && installMatch.id !== licenseMatch.id) {
    logger.warn?.(
      `[focus-ledger] Installation conflict for install_id=${event.install_id} license_instance_id=${event.license_instance_id}; keeping install_id match ${installMatch.id}.`
    );
    const patch = buildInstallationPatch(installMatch, event);
    return hasKeys(patch) ? store.updateInstallation(installMatch.id, patch) : installMatch;
  }

  if (installMatch) {
    const patch = buildInstallationPatch(installMatch, event, { allowLicenseFill: true });
    return hasKeys(patch) ? store.updateInstallation(installMatch.id, patch) : installMatch;
  }

  if (licenseMatch) {
    const patch = buildInstallationPatch(licenseMatch, event, { allowInstallIdRewrite: true });
    return hasKeys(patch) ? store.updateInstallation(licenseMatch.id, patch) : licenseMatch;
  }

  try {
    return await store.createInstallation({
      install_id: event.install_id,
      license_instance_id: event.license_instance_id,
      app_version: event.app_version,
      os_version: event.os_version,
      channel: event.channel,
      first_seen_at: event.event_at,
      last_seen_at: event.event_at,
    });
  } catch (error) {
    const recoveredByInstall = await store.findInstallationByInstallId(event.install_id);
    if (recoveredByInstall) return recoveredByInstall;
    if (event.license_instance_id) {
      const recoveredByLicense = await store.findInstallationByLicenseInstanceId(event.license_instance_id);
      if (recoveredByLicense) return recoveredByLicense;
    }
    throw error;
  }
}

function normalizeSession(raw: RawFocusSession) {
  const localSessionId = clampText(raw.localSessionId, 160);
  const installId = clampText(raw.installId, 160);
  const startedAt = safeIso(raw.startedAt);
  if (!localSessionId || !installId || !startedAt) return null;

  const licenseInstanceId = clampText(raw.licenseInstanceId, 160) || null;
  const appVersion = clampText(raw.appVersion, 40) || 'unknown';
  const osVersion = clampText(raw.osVersion, 120);
  const channel = clampText(raw.channel, 40) || 'latest';
  const task = normalizeTitleFields({
    title: raw.taskTitle,
    hash: raw.taskHash,
    included: raw.taskTitleIncluded,
  });

  return {
    localSessionId,
    installId,
    licenseInstanceId,
    appVersion,
    osVersion,
    channel,
    eventAt: safeIso(raw.clientUpdatedAt) || safeIso(raw.endedAt) || startedAt,
    row: {
      local_session_id: localSessionId,
      installation_id: '',
      install_id: installId,
      license_instance_id: licenseInstanceId,
      customer_id: null,
      precision: normalizePrecision(raw.precision),
      mode: normalizeMode(raw.mode),
      started_at: startedAt,
      ended_at: safeIso(raw.endedAt),
      active_seconds: clampNumber(raw.activeSeconds),
      wall_clock_seconds: clampNumber(raw.wallClockSeconds),
      paused_seconds: clampNumber(raw.pausedSeconds),
      break_seconds: clampNumber(raw.breakSeconds),
      outcome: normalizeOutcome(raw.outcome),
      completed: raw.completed === true,
      kept: raw.kept === true,
      task_title: task.title,
      task_hash: task.hash,
      task_title_included: task.included,
      weekly_emails_enabled: raw.weeklyEmails !== false,
      milestone_emails_enabled: raw.milestoneEmails !== false,
      app_version: appVersion,
      os_version: osVersion,
      channel,
      timezone: clampText(raw.timezone, 80),
      client_updated_at: safeIso(raw.clientUpdatedAt) || new Date().toISOString(),
    } satisfies FocusSessionInsertRow,
  };
}

function normalizeSegment(raw: RawFocusSegment, session: FocusSessionRow) {
  const localSegmentId = clampText(raw.localSegmentId, 180);
  const localSessionId = clampText(raw.localSessionId, 160);
  const startedAt = safeIso(raw.startedAt);
  if (!localSegmentId || !localSessionId || !startedAt) return null;

  const parent = normalizeTitleFields({
    title: raw.parentTaskTitle,
    hash: raw.parentTaskHash,
    included: raw.focusTitleIncluded,
  });
  const focus = normalizeTitleFields({
    title: raw.focusTitle,
    hash: raw.focusHash,
    included: raw.focusTitleIncluded,
  });

  return {
    local_segment_id: localSegmentId,
    local_session_id: localSessionId,
    focus_session_id: session.id,
    installation_id: session.installation_id,
    customer_id: session.customer_id,
    segment_type: normalizeSegmentType(raw.segmentType),
    parent_task_title: parent.title,
    parent_task_hash: parent.hash,
    focus_title: focus.title,
    focus_hash: focus.hash,
    focus_title_included: focus.included,
    subtask_local_id: clampText(raw.subtaskLocalId, 160) || null,
    started_at: startedAt,
    ended_at: safeIso(raw.endedAt),
    active_seconds: clampNumber(raw.activeSeconds),
    completed: raw.completed === true,
    completion_event_at: safeIso(raw.completionEventAt),
  } satisfies FocusSegmentInsertRow;
}

function normalizeCheckIn(raw: RawFocusCheckIn, session: FocusSessionRow) {
  const localCheckinId = clampText(raw.localCheckinId, 180);
  const localSessionId = clampText(raw.localSessionId, 160);
  const shownAt = safeIso(raw.shownAt);
  const status = normalizeStatus(raw.status);
  if (!localCheckinId || !localSessionId || !shownAt || !status) return null;

  const task = normalizeTitleFields({
    title: raw.taskTitle,
    hash: raw.taskHash,
    included: raw.focusTitleIncluded,
  });
  const subtaskTitle = clampText(raw.subtaskTitle, 500);
  const subtaskHash = clampText(raw.subtaskHash, 96) || (subtaskTitle ? hashLedgerText(subtaskTitle) : null);
  const includeSubtaskTitle = raw.focusTitleIncluded === true && Boolean(subtaskTitle);

  return {
    local_checkin_id: localCheckinId,
    local_session_id: localSessionId,
    focus_session_id: session.id,
    installation_id: session.installation_id,
    customer_id: session.customer_id,
    shown_at: shownAt,
    responded_at: safeIso(raw.respondedAt),
    missed_at: safeIso(raw.missedAt),
    status,
    elapsed_active_seconds: clampNumber(raw.elapsedActiveSeconds),
    task_title: task.title,
    task_hash: task.hash,
    subtask_title: includeSubtaskTitle ? subtaskTitle : null,
    subtask_hash: subtaskHash,
    focus_title_included: task.included || includeSubtaskTitle,
    detour_note_present: raw.detourNotePresent === true,
  } satisfies FocusCheckInInsertRow;
}

export async function storeFocusLedgerBatch(
  rawBatch: {
    sessions?: RawFocusSession[];
    segments?: RawFocusSegment[];
    checkins?: RawFocusCheckIn[];
  },
  {
    store,
    logger = {},
  }: {
    store: FocusLedgerStore;
    logger?: LoggerLike;
  }
): Promise<StoreFocusLedgerResult> {
  const normalizedSessions = (Array.isArray(rawBatch.sessions) ? rawBatch.sessions : [])
    .slice(0, MAX_LEDGER_BATCH_SIZE)
    .map(normalizeSession)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeSession>> => Boolean(item));

  const acceptedSessionIds: string[] = [];
  const acceptedSegmentIds: string[] = [];
  const acceptedCheckinIds: string[] = [];
  const sessionRowsByLocalId = new Map<string, FocusSessionRow>();

  for (const item of normalizedSessions) {
    const installation = await resolveInstallation({
      install_id: item.installId,
      license_instance_id: item.licenseInstanceId,
      app_version: item.appVersion,
      os_version: item.osVersion,
      channel: item.channel,
      event_at: item.eventAt,
    }, store, logger);
    const customerId = item.licenseInstanceId
      ? await store.findCustomerIdByLicenseInstanceId(item.licenseInstanceId)
      : null;

    const rows = await store.upsertFocusSessions([{
      ...item.row,
      installation_id: installation.id,
      customer_id: customerId,
    }]);
    const row = rows[0];
    if (row) {
      sessionRowsByLocalId.set(row.local_session_id, row);
      acceptedSessionIds.push(row.local_session_id);
    }
  }

  async function findSessionForRaw(raw: RawFocusSegment | RawFocusCheckIn) {
    const localSessionId = clampText(raw.localSessionId, 160);
    if (!localSessionId) return null;
    const existing = sessionRowsByLocalId.get(localSessionId);
    if (existing) return existing;

    const installId = clampText(raw.installId, 160);
    if (!installId) return null;
    const licenseInstanceId = clampText(raw.licenseInstanceId, 160) || null;
    const installation = await resolveInstallation({
      install_id: installId,
      license_instance_id: licenseInstanceId,
      app_version: 'unknown',
      os_version: '',
      channel: 'latest',
      event_at: new Date().toISOString(),
    }, store, logger);
    const found = await store.findFocusSession(installation.id, localSessionId);
    if (found) sessionRowsByLocalId.set(localSessionId, found);
    return found;
  }

  const segmentRows: FocusSegmentInsertRow[] = [];
  for (const raw of (Array.isArray(rawBatch.segments) ? rawBatch.segments : []).slice(0, MAX_LEDGER_BATCH_SIZE)) {
    const session = await findSessionForRaw(raw);
    if (!session) continue;
    const row = normalizeSegment(raw, session);
    if (row) {
      segmentRows.push(row);
      acceptedSegmentIds.push(row.local_segment_id);
    }
  }
  if (segmentRows.length) {
    await store.upsertFocusSegments(segmentRows);
  }

  const checkinRows: FocusCheckInInsertRow[] = [];
  for (const raw of (Array.isArray(rawBatch.checkins) ? rawBatch.checkins : []).slice(0, MAX_LEDGER_BATCH_SIZE)) {
    const session = await findSessionForRaw(raw);
    if (!session) continue;
    const row = normalizeCheckIn(raw, session);
    if (row) {
      checkinRows.push(row);
      acceptedCheckinIds.push(row.local_checkin_id);
    }
  }
  if (checkinRows.length) {
    await store.upsertFocusCheckIns(checkinRows);
  }

  return {
    acceptedSessionIds,
    acceptedSegmentIds,
    acceptedCheckinIds,
    acceptedIds: [
      ...acceptedSessionIds.map((id) => `session:${id}`),
      ...acceptedSegmentIds.map((id) => `segment:${id}`),
      ...acceptedCheckinIds.map((id) => `checkin:${id}`),
    ],
  };
}

function createHeaders(serviceKey: string, extraHeaders: Record<string, string> = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extraHeaders,
  };
}

async function readJsonResponse<T>(response: Response, context: string) {
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${context}: ${errText || response.status}`);
  }

  return (await response.json()) as T;
}

async function expectMinimalResponse(response: Response, context: string) {
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${context}: ${errText || response.status}`);
  }
}

export function createSupabaseFocusLedgerStore({
  supabaseUrl,
  supabaseServiceKey,
  fetchImpl = fetch,
}: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  fetchImpl?: FetchLike;
}): FocusLedgerStore {
  async function fetchInstallationByFilter(filterColumn: 'install_id' | 'license_instance_id', filterValue: string) {
    const url = new URL(`${supabaseUrl}/rest/v1/app_installations`);
    url.searchParams.set('select', INSTALLATION_SELECT);
    url.searchParams.set(filterColumn, `eq.${filterValue}`);
    url.searchParams.set('limit', '1');

    const response = await fetchImpl(url, {
      headers: createHeaders(supabaseServiceKey),
    });

    const rows = await readJsonResponse<InstallationRow[]>(
      response,
      `Installation lookup failed for ${filterColumn}=${filterValue}`
    );

    return rows[0] || null;
  }

  return {
    findInstallationByInstallId(installId) {
      return fetchInstallationByFilter('install_id', installId);
    },

    findInstallationByLicenseInstanceId(licenseInstanceId) {
      return fetchInstallationByFilter('license_instance_id', licenseInstanceId);
    },

    async createInstallation(input) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_installations`);
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(input),
      });

      const rows = await readJsonResponse<InstallationRow[]>(
        response,
        `Installation insert failed for install_id=${input.install_id}`
      );

      if (!rows[0]) throw new Error(`Installation insert returned no rows for install_id=${input.install_id}`);
      return rows[0];
    },

    async updateInstallation(id, patch) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_installations`);
      url.searchParams.set('id', `eq.${id}`);

      const response = await fetchImpl(url, {
        method: 'PATCH',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(patch),
      });

      const rows = await readJsonResponse<InstallationRow[]>(
        response,
        `Installation update failed for id=${id}`
      );

      if (!rows[0]) throw new Error(`Installation update returned no rows for id=${id}`);
      return rows[0];
    },

    async findCustomerIdByLicenseInstanceId(licenseInstanceId) {
      const url = new URL(`${supabaseUrl}/rest/v1/customer_license_instances`);
      url.searchParams.set('select', 'customer_id');
      url.searchParams.set('license_instance_id', `eq.${licenseInstanceId}`);
      url.searchParams.set('limit', '1');

      const response = await fetchImpl(url, {
        headers: createHeaders(supabaseServiceKey),
      });
      const rows = await readJsonResponse<{ customer_id: string }[]>(
        response,
        `Customer license lookup failed for license_instance_id=${licenseInstanceId}`
      );
      return rows[0]?.customer_id || null;
    },

    async upsertFocusSessions(rows) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_sessions`);
      url.searchParams.set('on_conflict', 'installation_id,local_session_id');

      const response = await fetchImpl(url, {
        method: 'POST',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(rows),
      });

      return readJsonResponse<FocusSessionRow[]>(response, 'Focus session upsert failed');
    },

    async findFocusSession(installationId, localSessionId) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_sessions`);
      url.searchParams.set('select', SESSION_SELECT);
      url.searchParams.set('installation_id', `eq.${installationId}`);
      url.searchParams.set('local_session_id', `eq.${localSessionId}`);
      url.searchParams.set('limit', '1');

      const response = await fetchImpl(url, {
        headers: createHeaders(supabaseServiceKey),
      });
      const rows = await readJsonResponse<FocusSessionRow[]>(
        response,
        `Focus session lookup failed for local_session_id=${localSessionId}`
      );
      return rows[0] || null;
    },

    async upsertFocusSegments(rows) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_segments`);
      url.searchParams.set('on_conflict', 'installation_id,local_segment_id');
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(rows),
      });
      await expectMinimalResponse(response, 'Focus segment upsert failed');
    },

    async upsertFocusCheckIns(rows) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_checkins`);
      url.searchParams.set('on_conflict', 'installation_id,local_checkin_id');
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(rows),
      });
      await expectMinimalResponse(response, 'Focus check-in upsert failed');
    },
  };
}
