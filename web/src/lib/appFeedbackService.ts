export const MAX_BATCH_SIZE = 25;

export type RawFeedbackItem = {
  id?: unknown;
  sessionId?: unknown;
  feedback?: unknown;
  surface?: unknown;
  completionType?: unknown;
  sessionMode?: unknown;
  sessionDurationMinutes?: unknown;
  clientCreatedAt?: unknown;
  appVersion?: unknown;
  osVersion?: unknown;
  channel?: unknown;
  installId?: unknown;
  licenseInstanceId?: unknown;
};

export type FeedbackInsertRow = {
  id: string;
  session_id: string | null;
  feedback: 'up' | 'down';
  surface: string;
  completion_type: string;
  session_mode: 'freeflow' | 'timed';
  session_duration_minutes: number;
  client_created_at: string;
  app_version: string;
  os_version: string;
  channel: string;
  install_id: string;
  license_instance_id: string | null;
};

export type FeedbackWriteRow = FeedbackInsertRow & {
  installation_id: string | null;
};

export type InstallationRow = {
  id: string;
  install_id: string;
  license_instance_id: string | null;
  app_version: string | null;
  os_version: string | null;
  channel: string;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

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

type FetchLike = typeof fetch;

export type LoggerLike = {
  warn?: (...args: unknown[]) => void;
};

export type AppFeedbackStore = {
  findInstallationByInstallId: (installId: string) => Promise<InstallationRow | null>;
  findInstallationByLicenseInstanceId: (licenseInstanceId: string) => Promise<InstallationRow | null>;
  createInstallation: (input: InstallationCreateInput) => Promise<InstallationRow>;
  updateInstallation: (id: string, patch: InstallationUpdateInput) => Promise<InstallationRow>;
  upsertFeedbackRows: (rows: FeedbackWriteRow[]) => Promise<void>;
};

const INSTALLATION_SELECT =
  'id,install_id,license_instance_id,app_version,os_version,channel,first_seen_at,last_seen_at,created_at,updated_at';

export function clampText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function safeIso(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeFeedbackItem(rawItem: RawFeedbackItem): FeedbackInsertRow | null {
  const id = clampText(rawItem.id, 160);
  const feedback = rawItem.feedback === 'down' ? 'down' : (rawItem.feedback === 'up' ? 'up' : null);
  if (!id || !feedback) return null;

  const sessionId = clampText(rawItem.sessionId, 160) || null;
  const surface = clampText(rawItem.surface, 80) || 'unknown';
  const completionType = clampText(rawItem.completionType, 40) || 'unknown';
  const sessionMode = rawItem.sessionMode === 'timed' ? 'timed' : 'freeflow';
  const sessionDurationMinutes = Number.isFinite(Number(rawItem.sessionDurationMinutes))
    ? Math.max(0, Number(rawItem.sessionDurationMinutes))
    : 0;
  const clientCreatedAt = safeIso(rawItem.clientCreatedAt) || new Date().toISOString();
  const appVersion = clampText(rawItem.appVersion, 40) || 'unknown';
  const osVersion = clampText(rawItem.osVersion, 120);
  const channel = clampText(rawItem.channel, 40) || 'latest';
  const installId = clampText(rawItem.installId, 160);
  const licenseInstanceId = clampText(rawItem.licenseInstanceId, 160) || null;

  return {
    id,
    session_id: sessionId,
    feedback,
    surface,
    completion_type: completionType,
    session_mode: sessionMode,
    session_duration_minutes: sessionDurationMinutes,
    client_created_at: clientCreatedAt,
    app_version: appVersion,
    os_version: osVersion,
    channel,
    install_id: installId,
    license_instance_id: licenseInstanceId,
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
  row: FeedbackInsertRow,
  {
    allowLicenseFill = false,
    allowInstallIdRewrite = false,
  }: {
    allowLicenseFill?: boolean;
    allowInstallIdRewrite?: boolean;
  } = {}
) {
  const patch: InstallationUpdateInput = {};
  const eventAtMs = parseIsoToMs(row.client_created_at);
  const firstSeenMs = parseIsoToMs(existing.first_seen_at);
  const lastSeenMs = parseIsoToMs(existing.last_seen_at);

  if (eventAtMs !== null && (firstSeenMs === null || eventAtMs < firstSeenMs)) {
    patch.first_seen_at = row.client_created_at;
  }

  if (eventAtMs !== null && (lastSeenMs === null || eventAtMs >= lastSeenMs)) {
    patch.last_seen_at = row.client_created_at;
    patch.app_version = row.app_version;
    patch.os_version = row.os_version;
    patch.channel = row.channel;
  }

  if (allowLicenseFill && row.license_instance_id && !existing.license_instance_id) {
    patch.license_instance_id = row.license_instance_id;
  }

  if (allowInstallIdRewrite && row.install_id && row.install_id !== existing.install_id) {
    patch.install_id = row.install_id;
  }

  return patch;
}

async function resolveInstallationForRow(
  row: FeedbackInsertRow,
  store: AppFeedbackStore,
  logger: LoggerLike
) {
  if (!row.install_id) {
    return null;
  }

  const installMatch = await store.findInstallationByInstallId(row.install_id);
  const licenseMatch = row.license_instance_id
    ? await store.findInstallationByLicenseInstanceId(row.license_instance_id)
    : null;

  if (installMatch && licenseMatch && installMatch.id !== licenseMatch.id) {
    logger.warn?.(
      `[app-feedback] Installation conflict for install_id=${row.install_id} license_instance_id=${row.license_instance_id}; keeping install_id match ${installMatch.id} and leaving rows separate for manual cleanup.`
    );

    const patch = buildInstallationPatch(installMatch, row);
    return hasKeys(patch) ? store.updateInstallation(installMatch.id, patch) : installMatch;
  }

  if (installMatch) {
    const patch = buildInstallationPatch(installMatch, row, {
      allowLicenseFill: true,
    });
    return hasKeys(patch) ? store.updateInstallation(installMatch.id, patch) : installMatch;
  }

  if (licenseMatch) {
    if (licenseMatch.install_id !== row.install_id) {
      logger.warn?.(
        `[app-feedback] Rebinding installation ${licenseMatch.id} from install_id=${licenseMatch.install_id} to install_id=${row.install_id} via shared license_instance_id=${row.license_instance_id}.`
      );
    }

    const patch = buildInstallationPatch(licenseMatch, row, {
      allowInstallIdRewrite: true,
    });
    return hasKeys(patch) ? store.updateInstallation(licenseMatch.id, patch) : licenseMatch;
  }

  try {
    return await store.createInstallation({
      install_id: row.install_id,
      license_instance_id: row.license_instance_id,
      app_version: row.app_version,
      os_version: row.os_version,
      channel: row.channel,
      first_seen_at: row.client_created_at,
      last_seen_at: row.client_created_at,
    });
  } catch (error) {
    const recoveredByInstall = await store.findInstallationByInstallId(row.install_id);
    if (recoveredByInstall) {
      return recoveredByInstall;
    }

    if (row.license_instance_id) {
      const recoveredByLicense = await store.findInstallationByLicenseInstanceId(row.license_instance_id);
      if (recoveredByLicense) {
        return recoveredByLicense;
      }
    }

    throw error;
  }
}

export async function storeFeedbackRows(
  rows: FeedbackInsertRow[],
  {
    store,
    logger = {},
  }: {
    store: AppFeedbackStore;
    logger?: LoggerLike;
  }
) {
  const writeRows: FeedbackWriteRow[] = [];

  for (const row of rows) {
    const installation = await resolveInstallationForRow(row, store, logger);
    writeRows.push({
      ...row,
      installation_id: installation?.id || null,
    });
  }

  await store.upsertFeedbackRows(writeRows);
  return writeRows;
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

export function createSupabaseAppFeedbackStore({
  supabaseUrl,
  supabaseServiceKey,
  fetchImpl = fetch,
}: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  fetchImpl?: FetchLike;
}): AppFeedbackStore {
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

      if (!rows[0]) {
        throw new Error(`Installation insert returned no rows for install_id=${input.install_id}`);
      }

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

      if (!rows[0]) {
        throw new Error(`Installation update returned no rows for id=${id}`);
      }

      return rows[0];
    },

    async upsertFeedbackRows(rows) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_session_feedback`);
      url.searchParams.set('on_conflict', 'id');

      const response = await fetchImpl(url, {
        method: 'POST',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(rows),
      });

      await expectMinimalResponse(response, 'Feedback insert failed');
    },
  };
}
