import React from 'react';
import { Coffee, Play, Square } from 'lucide-react';
import { formatTime } from '../utils/time';

export default function PomodoroBreakPanel({
  time = 0,
  completedCycles = 0,
  status = 'timer',
  breakIntention = '',
  onBreakIntentionChange,
  onStartBreak,
  onKeepGoing,
  onEnd,
}) {
  const cycleCopy = completedCycles > 1
    ? `${completedCycles} focus rounds saved`
    : '1 focus round saved';
  const normalizedStatus = status === 'ready' || status === 'handoff' ? status : 'timer';
  const canStartBreak = breakIntention.trim().length > 0;
  const title = normalizedStatus === 'ready' ? 'Ready to resume?' : 'Break time';
  const copy = normalizedStatus === 'handoff'
    ? 'Work time is up. Name the break you are taking before you step away.'
    : normalizedStatus === 'ready'
      ? 'Your break is done. Start the next focus round when you feel set.'
      : 'You are on break. Focana will wait for you when the timer ends.';

  return (
    <section className="pomodoro-break-panel electron-no-drag" data-testid="pomodoro-break-panel">
      <div className="pomodoro-break-panel__icon" aria-hidden="true">
        <Coffee size={18} />
      </div>
      <div className="pomodoro-break-panel__body">
        <p className="pomodoro-break-panel__eyebrow">{cycleCopy}</p>
        <h2 className="pomodoro-break-panel__title">{title}</h2>
        <p className="pomodoro-break-panel__copy">{copy}</p>
        {normalizedStatus === 'handoff' ? (
          <label className="pomodoro-break-panel__field">
            <span>How are you going to break?</span>
            <textarea
              className="pomodoro-break-panel__textarea"
              value={breakIntention}
              maxLength={160}
              rows={3}
              onChange={(event) => onBreakIntentionChange?.(event.target.value)}
              placeholder="Water, stretch, breathe, step outside..."
            />
          </label>
        ) : (
          <>
            {breakIntention.trim() && (
              <p className="pomodoro-break-panel__intention">
                Break plan: {breakIntention.trim()}
              </p>
            )}
            {normalizedStatus === 'timer' && (
              <div className="pomodoro-break-panel__timer" aria-label={`Break time remaining ${formatTime(time)}`}>
                {formatTime(time)}
              </div>
            )}
          </>
        )}
      </div>
      <div className="pomodoro-break-panel__actions">
        {normalizedStatus === 'handoff' ? (
          <button
            type="button"
            className="pomodoro-break-panel__primary"
            onClick={onStartBreak}
            disabled={!canStartBreak}
          >
            <Coffee size={14} aria-hidden="true" />
            Start break
          </button>
        ) : (
          <button type="button" className="pomodoro-break-panel__primary" onClick={onKeepGoing}>
            <Play size={14} aria-hidden="true" />
            {normalizedStatus === 'ready' ? 'Start focus' : 'Keep going'}
          </button>
        )}
        {normalizedStatus === 'handoff' && (
          <button type="button" className="pomodoro-break-panel__secondary" onClick={onKeepGoing}>
            <Play size={14} aria-hidden="true" />
            Keep going
          </button>
        )}
        <button type="button" className="pomodoro-break-panel__secondary" onClick={onEnd}>
          <Square size={13} aria-hidden="true" />
          Wrap up
        </button>
      </div>
    </section>
  );
}
