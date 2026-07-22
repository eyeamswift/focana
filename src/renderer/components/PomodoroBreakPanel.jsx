import React from 'react';
import { Coffee, Play, Plus, Square } from 'lucide-react';
import { formatTime } from '../utils/time';

function formatFocusDuration(seconds = 0) {
  const totalMinutes = Math.max(1, Math.round(Math.max(0, Number(seconds) || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'}`;
  }

  const hourText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  if (minutes <= 0) return hourText;
  return `${hourText} ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export default function PomodoroBreakPanel({
  taskName = '',
  focusSeconds = 0,
  time = 0,
  breakPlan = '',
  breakState = 'prompt',
  onBreakPlanChange,
  onStartBreak,
  onExtendBreak,
  onStartFocus,
  onEnd,
}) {
  const normalizedBreakState = breakState === 'running' || breakState === 'ready'
    ? breakState
    : 'prompt';
  const isRunning = normalizedBreakState === 'running';
  const isReady = normalizedBreakState === 'ready';
  const trimmedTaskName = typeof taskName === 'string' ? taskName.trim() : '';
  const title = isReady ? 'Ready to resume?' : 'Break time';
  const focusSummary = trimmedTaskName
    ? `That's ${formatFocusDuration(focusSeconds)} on "${trimmedTaskName}"`
    : `That's ${formatFocusDuration(focusSeconds)}`;

  return (
    <section
      className={`pomodoro-break-panel pomodoro-break-panel--${normalizedBreakState} electron-no-drag`}
      data-testid="pomodoro-break-panel"
    >
      <div className="pomodoro-break-panel__icon" aria-hidden="true">
        <Coffee size={18} />
      </div>
      <div className="pomodoro-break-panel__body">
        <h2 className="pomodoro-break-panel__title">{title}</h2>
        {isReady ? (
          <p className="pomodoro-break-panel__task">{focusSummary}</p>
        ) : null}
        {isRunning ? (
          <div className="pomodoro-break-panel__timer" aria-label={`Break time remaining ${formatTime(time)}`}>
            {formatTime(time)}
          </div>
        ) : null}
        {!isRunning && !isReady ? (
          <>
            <label className="pomodoro-break-panel__label" htmlFor="pomodoro-break-plan">
              How are you going to break?
            </label>
            <textarea
              id="pomodoro-break-plan"
              className="pomodoro-break-panel__textarea"
              value={breakPlan}
              onChange={(event) => onBreakPlanChange?.(event.target.value)}
              placeholder="Water, stretch, breathe, step outside..."
              rows={3}
            />
          </>
        ) : null}
      </div>
      <div className="pomodoro-break-panel__actions">
        {isReady ? (
          <>
            <button type="button" className="pomodoro-break-panel__primary" onClick={onStartFocus}>
              <Play size={14} aria-hidden="true" />
              Keep going
            </button>
            <button type="button" className="pomodoro-break-panel__secondary" onClick={onExtendBreak}>
              <Plus size={14} aria-hidden="true" />
              Add break time
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="pomodoro-break-panel__primary"
              onClick={isRunning ? onStartFocus : onStartBreak}
            >
              {isRunning ? <Play size={14} aria-hidden="true" /> : <Coffee size={14} aria-hidden="true" />}
              {isRunning ? 'Keep going' : 'Start break'}
            </button>
            {isRunning ? (
              <button type="button" className="pomodoro-break-panel__secondary" onClick={onExtendBreak}>
                <Plus size={14} aria-hidden="true" />
                Add break time
              </button>
            ) : (
              <button type="button" className="pomodoro-break-panel__secondary" onClick={onStartFocus}>
                <Play size={14} aria-hidden="true" />
                Keep going
              </button>
            )}
          </>
        )}
        <button type="button" className="pomodoro-break-panel__secondary" onClick={onEnd}>
          <Square size={13} aria-hidden="true" />
          Wrap up
        </button>
      </div>
    </section>
  );
}
