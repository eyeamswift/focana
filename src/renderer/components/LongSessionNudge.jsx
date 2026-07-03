import React from 'react';
import { Coffee, TimerReset, X } from 'lucide-react';

export default function LongSessionNudge({
  taskName = '',
  onTakeBreak,
  onKeepGoing,
  onSnooze,
  variant = 'full',
}) {
  const safeTaskName = typeof taskName === 'string' && taskName.trim()
    ? taskName.trim()
    : 'this focus';
  const safeVariant = variant === 'compact' ? 'compact' : 'full';

  return (
    <section className={`long-session-nudge long-session-nudge--${safeVariant} electron-no-drag`} data-testid="long-session-nudge">
      <div className="long-session-nudge__icon" aria-hidden="true">
        <Coffee size={17} />
      </div>
      <div className="long-session-nudge__body">
        <p className="long-session-nudge__eyebrow">Gentle break check</p>
        <h2 className="long-session-nudge__title">You've been at it for 90 minutes.</h2>
        <p className="long-session-nudge__copy">
          Want to take a real break from {safeTaskName}, or keep this focus going?
        </p>
      </div>
      <div className="long-session-nudge__actions">
        <button type="button" className="long-session-nudge__primary" onClick={onTakeBreak}>
          <Coffee size={14} aria-hidden="true" />
          Take a break
        </button>
        <button type="button" className="long-session-nudge__secondary" onClick={onKeepGoing}>
          <TimerReset size={14} aria-hidden="true" />
          Keep going
        </button>
        <button type="button" className="long-session-nudge__ghost" onClick={onSnooze}>
          <X size={13} aria-hidden="true" />
          Later
        </button>
      </div>
    </section>
  );
}
