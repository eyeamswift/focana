import React from 'react';
import { Coffee, Play, Square } from 'lucide-react';
import { formatTime } from '../utils/time';

export default function PomodoroBreakPanel({
  taskName = '',
  time = 0,
  completedCycles = 0,
  onKeepGoing,
  onEnd,
}) {
  const safeTaskName = typeof taskName === 'string' && taskName.trim()
    ? taskName.trim()
    : 'this focus';
  const cycleCopy = completedCycles > 1
    ? `${completedCycles} focus rounds saved`
    : '1 focus round saved';

  return (
    <section className="pomodoro-break-panel electron-no-drag" data-testid="pomodoro-break-panel">
      <div className="pomodoro-break-panel__icon" aria-hidden="true">
        <Coffee size={18} />
      </div>
      <div className="pomodoro-break-panel__body">
        <p className="pomodoro-break-panel__eyebrow">{cycleCopy}</p>
        <h2 className="pomodoro-break-panel__title">Break time</h2>
        <p className="pomodoro-break-panel__copy">
          Step away for a bit. Your work on {safeTaskName} is saved in this Pomodoro run.
        </p>
        <div className="pomodoro-break-panel__timer" aria-label={`Break time remaining ${formatTime(time)}`}>
          {formatTime(time)}
        </div>
      </div>
      <div className="pomodoro-break-panel__actions">
        <button type="button" className="pomodoro-break-panel__primary" onClick={onKeepGoing}>
          <Play size={14} aria-hidden="true" />
          Keep going
        </button>
        <button type="button" className="pomodoro-break-panel__secondary" onClick={onEnd}>
          <Square size={13} aria-hidden="true" />
          Wrap up
        </button>
      </div>
    </section>
  );
}
