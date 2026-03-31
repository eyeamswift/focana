import React from 'react';

export default function FocusHeroCard({
  task,
  timerText = '',
  controls = null,
  onLockedInteraction,
}) {
  const taskLabel = typeof task === 'string' && task.trim()
    ? task.trim()
    : 'Current task';

  return (
    <div className="focus-hero">
      <div className="focus-hero__body">
        <button
          type="button"
          className="focus-hero__lock-surface"
          onClick={onLockedInteraction}
          aria-label="Focused task is locked while timer is running"
        >
          <div className="focus-hero__eyebrow">Focusing on</div>
          <div className="focus-hero__task">{taskLabel}</div>
        </button>
        {(timerText || controls) ? (
          <div className="focus-hero__aside">
            {timerText ? <div className="focus-hero__clock">{timerText}</div> : null}
            {controls ? <div className="focus-hero__controls">{controls}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
