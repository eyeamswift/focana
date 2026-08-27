import { sendLoopsEvent } from './loops.ts';

type FetchLike = typeof fetch;

type UserRollup = {
  analytics_user_key: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  installation_id: string | null;
  sessions_count: number;
  completed_tasks_count: number;
  completed_subtasks_count: number;
  total_active_seconds: number;
  missed_checkins_count: number;
  last_focus_at: string | null;
  milestone_emails_enabled: boolean;
};

type WeeklyRollup = {
  analytics_user_key: string;
  week_start: string;
  week_end: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  installation_id: string | null;
  sessions_count: number;
  completed_tasks_count: number;
  completed_subtasks_count: number;
  total_active_seconds: number;
  missed_checkins_count: number;
  top_tasks: Array<{
    taskHash?: string;
    taskTitle?: string | null;
    activeSeconds?: number;
  }> | null;
  weekly_emails_enabled: boolean;
};

type MilestoneInsertRow = {
  analytics_user_key: string;
  installation_id: string | null;
  customer_id: string | null;
  customer_email: string;
  milestone_key: string;
  milestone_value: number;
  display_label: string;
  reached_at: string;
  metadata: Record<string, unknown>;
};

type WeeklyEmailInsertRow = {
  analytics_user_key: string;
  installation_id: string | null;
  customer_id: string | null;
  customer_email: string;
  week_start: string;
  payload: Record<string, unknown>;
};

const FOCUS_HOUR_THRESHOLDS = [10, 25, 50, 100, 250, 500];
const COMPLETED_TASK_THRESHOLDS = [1, 5, 20, 50, 100];
const COMPLETED_SESSION_THRESHOLDS = [1, 10, 25, 50, 100];

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

function toNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getPreviousIsoWeekStart(now = new Date()) {
  const day = now.getUTCDay() || 7;
  const currentWeekMonday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - day + 1
  ));
  currentWeekMonday.setUTCDate(currentWeekMonday.getUTCDate() - 7);
  return toIsoDate(currentWeekMonday);
}

function buildMilestones(row: UserRollup): MilestoneInsertRow[] {
  if (!row.customer_email) return [];
  const totalHours = Math.floor(toNumber(row.total_active_seconds) / 3600);
  const completedTasks = Math.floor(toNumber(row.completed_tasks_count));
  const completedSessions = Math.floor(toNumber(row.sessions_count));
  const reachedAt = new Date().toISOString();
  const base = {
    analytics_user_key: row.analytics_user_key,
    installation_id: row.installation_id,
    customer_id: row.customer_id,
    customer_email: row.customer_email,
    reached_at: reachedAt,
    metadata: {
      totalFocusHours: totalHours,
      completedTasks,
      completedSessions,
      completedSubtasks: toNumber(row.completed_subtasks_count),
      missedCheckins: toNumber(row.missed_checkins_count),
      lastFocusAt: row.last_focus_at,
    },
  };

  return [
    ...FOCUS_HOUR_THRESHOLDS
      .filter((threshold) => totalHours >= threshold)
      .map((threshold) => ({
        ...base,
        milestone_key: `total_focus_${threshold}_hours`,
        milestone_value: threshold,
        display_label: `${threshold} hours focused with Focana`,
      })),
    ...COMPLETED_TASK_THRESHOLDS
      .filter((threshold) => completedTasks >= threshold)
      .map((threshold) => ({
        ...base,
        milestone_key: `completed_${threshold}_tasks`,
        milestone_value: threshold,
        display_label: `${threshold} tasks completed with Focana`,
      })),
    ...COMPLETED_SESSION_THRESHOLDS
      .filter((threshold) => completedSessions >= threshold)
      .map((threshold) => ({
        ...base,
        milestone_key: `completed_${threshold}_sessions`,
        milestone_value: threshold,
        display_label: `${threshold} focus sessions with Focana`,
      })),
  ];
}

function buildWeeklyPayload(row: WeeklyRollup) {
  const topTasks = Array.isArray(row.top_tasks) ? row.top_tasks.slice(0, 3) : [];
  const payload: Record<string, unknown> = {
    weekStart: row.week_start,
    weekEnd: row.week_end,
    weeklyFocusMinutes: Math.round(toNumber(row.total_active_seconds) / 60),
    weeklyCompletedTasks: Math.floor(toNumber(row.completed_tasks_count)),
    weeklyCompletedSubtasks: Math.floor(toNumber(row.completed_subtasks_count)),
    weeklySessions: Math.floor(toNumber(row.sessions_count)),
    weeklyMissedCheckins: Math.floor(toNumber(row.missed_checkins_count)),
  };

  topTasks.forEach((task, index) => {
    const slot = index + 1;
    payload[`topTask${slot}`] = task.taskTitle || 'A focus task';
    payload[`topTask${slot}Minutes`] = Math.round(toNumber(task.activeSeconds) / 60);
  });

  return payload;
}

export function createFocusEmailAutomationStore({
  supabaseUrl,
  supabaseServiceKey,
  fetchImpl = fetch,
}: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  fetchImpl?: FetchLike;
}) {
  return {
    async fetchUserRollups() {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_user_rollups`);
      url.searchParams.set('select', 'analytics_user_key,customer_id,customer_email,customer_name,installation_id,sessions_count,completed_tasks_count,completed_subtasks_count,total_active_seconds,missed_checkins_count,last_focus_at,milestone_emails_enabled');
      url.searchParams.set('customer_email', 'not.is.null');
      url.searchParams.set('total_active_seconds', 'gt.0');
      url.searchParams.set('milestone_emails_enabled', 'eq.true');
      const response = await fetchImpl(url, {
        headers: createHeaders(supabaseServiceKey),
      });
      return readJsonResponse<UserRollup[]>(response, 'Focus user rollup lookup failed');
    },

    async insertMilestone(row: MilestoneInsertRow) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_milestones`);
      url.searchParams.set('on_conflict', 'analytics_user_key,milestone_key');
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=representation',
        }),
        body: JSON.stringify(row),
      });
      const rows = await readJsonResponse<Array<{ id: string }>>(response, 'Focus milestone insert failed');
      return rows[0] || null;
    },

    async markMilestoneSent(id: string) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_milestones`);
      url.searchParams.set('id', `eq.${id}`);
      const response = await fetchImpl(url, {
        method: 'PATCH',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({ email_sent_at: new Date().toISOString() }),
      });
      await expectMinimalResponse(response, 'Focus milestone sent patch failed');
    },

    async fetchWeeklyRollups(weekStart: string) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_weekly_rollups`);
      url.searchParams.set('select', 'analytics_user_key,week_start,week_end,customer_id,customer_email,customer_name,installation_id,sessions_count,completed_tasks_count,completed_subtasks_count,total_active_seconds,missed_checkins_count,top_tasks,weekly_emails_enabled');
      url.searchParams.set('customer_email', 'not.is.null');
      url.searchParams.set('week_start', `eq.${weekStart}`);
      url.searchParams.set('total_active_seconds', 'gt.0');
      url.searchParams.set('weekly_emails_enabled', 'eq.true');
      const response = await fetchImpl(url, {
        headers: createHeaders(supabaseServiceKey),
      });
      return readJsonResponse<WeeklyRollup[]>(response, 'Focus weekly rollup lookup failed');
    },

    async insertWeeklyEmail(row: WeeklyEmailInsertRow) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_weekly_emails`);
      url.searchParams.set('on_conflict', 'analytics_user_key,week_start');
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=representation',
        }),
        body: JSON.stringify(row),
      });
      const rows = await readJsonResponse<Array<{ id: string }>>(response, 'Focus weekly email insert failed');
      return rows[0] || null;
    },

    async markWeeklyEmailSent(id: string) {
      const url = new URL(`${supabaseUrl}/rest/v1/app_focus_weekly_emails`);
      url.searchParams.set('id', `eq.${id}`);
      const response = await fetchImpl(url, {
        method: 'PATCH',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({ email_sent_at: new Date().toISOString() }),
      });
      await expectMinimalResponse(response, 'Focus weekly email sent patch failed');
    },
  };
}

export async function sendFocusMilestones({
  store,
  loopsApiKey,
}: {
  store: ReturnType<typeof createFocusEmailAutomationStore>;
  loopsApiKey: string | undefined;
}) {
  const rollups = await store.fetchUserRollups();
  let inserted = 0;
  let sent = 0;

  for (const rollup of rollups) {
    for (const milestone of buildMilestones(rollup)) {
      const insertedRow = await store.insertMilestone(milestone);
      if (!insertedRow) continue;
      inserted += 1;
      await sendLoopsEvent(loopsApiKey, {
        email: milestone.customer_email,
        eventName: 'focus_milestone_reached',
        milestoneKey: milestone.milestone_key,
        milestoneLabel: milestone.display_label,
        milestoneValue: milestone.milestone_value,
        ...milestone.metadata,
      });
      await store.markMilestoneSent(insertedRow.id);
      sent += 1;
    }
  }

  return { ok: true, scanned: rollups.length, inserted, sent };
}

export async function sendWeeklyFocusRoadmaps({
  store,
  loopsApiKey,
  weekStart = getPreviousIsoWeekStart(),
}: {
  store: ReturnType<typeof createFocusEmailAutomationStore>;
  loopsApiKey: string | undefined;
  weekStart?: string;
}) {
  const rollups = await store.fetchWeeklyRollups(weekStart);
  let inserted = 0;
  let sent = 0;

  for (const rollup of rollups) {
    if (!rollup.customer_email) continue;
    const payload = buildWeeklyPayload(rollup);
    const insertedRow = await store.insertWeeklyEmail({
      analytics_user_key: rollup.analytics_user_key,
      installation_id: rollup.installation_id,
      customer_id: rollup.customer_id,
      customer_email: rollup.customer_email,
      week_start: rollup.week_start,
      payload,
    });
    if (!insertedRow) continue;
    inserted += 1;
    await sendLoopsEvent(loopsApiKey, {
      email: rollup.customer_email,
      eventName: 'weekly_focus_roadmap_ready',
      ...payload,
    });
    await store.markWeeklyEmailSent(insertedRow.id);
    sent += 1;
  }

  return { ok: true, weekStart, scanned: rollups.length, inserted, sent };
}
