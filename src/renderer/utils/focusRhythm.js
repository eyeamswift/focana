export const TIMER_MODES = {
  FREEFLOW: 'freeflow',
  TIMED: 'timed',
  POMODORO: 'pomodoro',
};

export const POMODORO_PRESETS = [
  { id: '25-5', label: '25 / 5', workMinutes: 25, breakMinutes: 5 },
  { id: '50-10', label: '50 / 10', workMinutes: 50, breakMinutes: 10 },
];

export const DEFAULT_POMODORO_PRESET = POMODORO_PRESETS[0];
export const LONG_SESSION_NUDGE_SECONDS = 90 * 60;
export const LONG_SESSION_NUDGE_SNOOZE_SECONDS = 15 * 60;

export function normalizeTimerMode(value) {
  if (value === TIMER_MODES.TIMED) return TIMER_MODES.TIMED;
  if (value === TIMER_MODES.POMODORO) return TIMER_MODES.POMODORO;
  return TIMER_MODES.FREEFLOW;
}

export function isCountdownMode(value) {
  return normalizeTimerMode(value) !== TIMER_MODES.FREEFLOW;
}

export function clampFocusMinutes(value, fallback = 25) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 240);
}

export function clampBreakMinutes(value, fallback = 5) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 120);
}

export function normalizePomodoroConfig(config = {}) {
  return {
    workMinutes: clampFocusMinutes(config.workMinutes, DEFAULT_POMODORO_PRESET.workMinutes),
    breakMinutes: clampBreakMinutes(config.breakMinutes, DEFAULT_POMODORO_PRESET.breakMinutes),
  };
}

export function shouldShowLongSessionNudge({
  mode,
  elapsedSeconds,
  thresholdSeconds = LONG_SESSION_NUDGE_SECONDS,
  acknowledged = false,
  snoozeUntilElapsed = null,
  dnd = false,
  blocking = false,
  activeTextEntry = false,
  running = true,
} = {}) {
  if (!running) return false;
  if (normalizeTimerMode(mode) === TIMER_MODES.POMODORO) return false;
  if (acknowledged) return false;
  if (dnd || blocking || activeTextEntry) return false;

  const elapsed = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));
  const threshold = Math.max(1, Math.floor(Number(thresholdSeconds) || LONG_SESSION_NUDGE_SECONDS));
  const snoozeTarget = Number.isFinite(Number(snoozeUntilElapsed))
    ? Math.max(0, Math.floor(Number(snoozeUntilElapsed)))
    : null;

  if (snoozeTarget !== null && elapsed < snoozeTarget) return false;
  return elapsed >= threshold;
}
