import { getActiveSubtask, getActiveTask, normalizeTaskPlan } from './taskPlan';

export const DEFAULT_FOCUS_INSIGHTS_SETTINGS = {
  enabled: false,
  includeTaskTitles: false,
  weeklyEmails: true,
  milestoneEmails: true,
  backfillCompletedAt: null,
};

function clampText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function normalizeIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeSeconds(value) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0;
}

export function normalizeFocusInsightsSettings(rawSettings) {
  const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  return {
    enabled: source.enabled === true,
    includeTaskTitles: source.includeTaskTitles === true,
    weeklyEmails: source.weeklyEmails !== false,
    milestoneEmails: source.milestoneEmails !== false,
    backfillCompletedAt: normalizeIso(source.backfillCompletedAt),
  };
}

export function hashLedgerText(value, fallback = 'unknown') {
  const normalized = clampText(value).toLowerCase() || fallback;
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

export function getFocusLedgerDescriptor(taskText, rawTaskPlan) {
  const safeTask = clampText(taskText);
  const plan = normalizeTaskPlan(rawTaskPlan, safeTask);
  const activeTask = getActiveTask(plan);
  const activeSubtask = getActiveSubtask(plan);
  const parentTitle = clampText(activeTask?.title) || safeTask || 'Untitled task';
  const focusTitle = clampText(activeSubtask?.title) || parentTitle;

  return {
    parentTaskId: activeTask?.id || null,
    parentTaskTitle: parentTitle,
    parentTaskHash: hashLedgerText(parentTitle),
    focusType: activeSubtask ? 'subtask' : 'main_task',
    focusId: activeSubtask?.id || activeTask?.id || null,
    focusTitle,
    focusHash: hashLedgerText(focusTitle),
    subtaskLocalId: activeSubtask?.id || null,
    focusKey: activeSubtask ? `subtask:${activeSubtask.id}` : `main:${activeTask?.id || parentTitle}`,
  };
}

function maybeTitle(title, settings) {
  return settings?.includeTaskTitles === true ? clampText(title) : '';
}

function commonRuntime(runtimeInfo = {}, licenseStatus = {}) {
  return {
    appVersion: runtimeInfo?.version || 'unknown',
    osVersion: runtimeInfo?.osVersion || '',
    channel: runtimeInfo?.channel || 'latest',
    installId: licenseStatus?.installId || '',
    licenseInstanceId: licenseStatus?.instanceId || null,
  };
}

export function makeSessionLedgerPayload({
  localSessionId,
  taskText,
  taskPlan,
  mode,
  startedAt,
  endedAt = null,
  activeSeconds = 0,
  wallClockSeconds = 0,
  pausedSeconds = 0,
  breakSeconds = 0,
  outcome = 'started',
  completed = false,
  kept = false,
  precision = 'segment_v1',
  runtimeInfo,
  licenseStatus,
  settings,
  clientUpdatedAt = new Date().toISOString(),
}) {
  const descriptor = getFocusLedgerDescriptor(taskText, taskPlan);
  return {
    localSessionId,
    ...commonRuntime(runtimeInfo, licenseStatus),
    precision,
    mode,
    startedAt,
    endedAt,
    activeSeconds: normalizeSeconds(activeSeconds),
    wallClockSeconds: normalizeSeconds(wallClockSeconds),
    pausedSeconds: normalizeSeconds(pausedSeconds),
    breakSeconds: normalizeSeconds(breakSeconds),
    outcome,
    completed: completed === true,
    kept: kept === true,
    taskTitle: maybeTitle(descriptor.parentTaskTitle, settings),
    taskHash: descriptor.parentTaskHash,
    taskTitleIncluded: settings?.includeTaskTitles === true,
    weeklyEmails: settings?.weeklyEmails !== false,
    milestoneEmails: settings?.milestoneEmails !== false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    clientUpdatedAt,
  };
}

export function makeSegmentLedgerPayload({
  localSegmentId,
  localSessionId,
  descriptor,
  startedAt,
  endedAt,
  activeSeconds,
  completed = false,
  completionEventAt = null,
  runtimeInfo,
  licenseStatus,
  settings,
}) {
  return {
    localSegmentId,
    localSessionId,
    installId: licenseStatus?.installId || '',
    licenseInstanceId: licenseStatus?.instanceId || null,
    segmentType: descriptor.focusType,
    parentTaskTitle: maybeTitle(descriptor.parentTaskTitle, settings),
    parentTaskHash: descriptor.parentTaskHash,
    focusTitle: maybeTitle(descriptor.focusTitle, settings),
    focusHash: descriptor.focusHash,
    focusTitleIncluded: settings?.includeTaskTitles === true,
    subtaskLocalId: descriptor.subtaskLocalId,
    startedAt,
    endedAt,
    activeSeconds: normalizeSeconds(activeSeconds),
    completed: completed === true,
    completionEventAt,
    appVersion: runtimeInfo?.version || 'unknown',
    channel: runtimeInfo?.channel || 'latest',
  };
}

export function makeCheckInLedgerPayload({
  checkIn,
  taskText,
  taskPlan,
  elapsedSeconds,
  runtimeInfo,
  licenseStatus,
  settings,
}) {
  const descriptor = getFocusLedgerDescriptor(taskText, taskPlan);
  const shownAt = normalizeIso(checkIn?.timestamp) || new Date().toISOString();
  const status = ['focused', 'completed', 'detour', 'missed'].includes(checkIn?.status)
    ? checkIn.status
    : 'missed';
  const respondedAt = status === 'missed' ? null : shownAt;

  return {
    localCheckinId: checkIn?.id || `checkin-${Date.now().toString(36)}`,
    localSessionId: checkIn?.sessionId,
    installId: licenseStatus?.installId || '',
    licenseInstanceId: licenseStatus?.instanceId || null,
    shownAt,
    respondedAt,
    missedAt: status === 'missed' ? shownAt : null,
    status,
    elapsedActiveSeconds: normalizeSeconds(elapsedSeconds),
    taskTitle: maybeTitle(descriptor.parentTaskTitle, settings),
    taskHash: descriptor.parentTaskHash,
    subtaskTitle: descriptor.focusType === 'subtask' ? maybeTitle(descriptor.focusTitle, settings) : '',
    subtaskHash: descriptor.focusType === 'subtask' ? descriptor.focusHash : null,
    focusTitleIncluded: settings?.includeTaskTitles === true,
    detourNotePresent: Boolean(checkIn?.detourNote),
  };
}

export function buildFocusInsightSummary(sessions = []) {
  const taskTotals = new Map();
  let totalSeconds = 0;
  let completedTasks = 0;

  for (const session of Array.isArray(sessions) ? sessions : []) {
    const seconds = normalizeSeconds(Number(session?.durationMinutes || 0) * 60);
    if (seconds <= 0) continue;
    totalSeconds += seconds;
    if (session?.completed === true) completedTasks += 1;
    const title = clampText(session?.task) || 'Untitled task';
    taskTotals.set(title, (taskTotals.get(title) || 0) + seconds);
  }

  return {
    totalSeconds,
    completedTasks,
    topTasks: Array.from(taskTotals.entries())
      .map(([title, seconds]) => ({ title, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5),
  };
}
