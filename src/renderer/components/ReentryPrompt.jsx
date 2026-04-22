import React, { useEffect, useMemo, useRef, useState } from 'react';

const QUICK_MINUTES = [15, 25, 45];

function clampMinutes(rawValue) {
  const parsed = Number.parseInt(String(rawValue || '').trim(), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(parsed, 1), 240);
}

export default function ReentryPrompt({
  isOpen = false,
  surface = 'full',
  promptKind = 'start',
  stage = 'task-entry',
  strongActive = false,
  taskText = '',
  minutes = '25',
  maxTaskLength = 96,
  resumeTaskName = '',
  resumeRecap = '',
  resumeNextSteps = '',
  onTaskTextChange,
  onMinutesChange,
  onStageChange,
  onStartSession,
  onSaveForLaterFromResume,
  onCompleteFromResume,
  onOpenParkingLot,
  onOpenSessionHistory,
  onSnooze,
}) {
  const textareaRef = useRef(null);
  const minutesInputRef = useRef(null);
  const nextStepsRef = useRef(null);
  const previousStageRef = useRef(promptKind === 'resume-choice' ? 'resume-choice' : 'task-entry');
  const [resumeRecapDraft, setResumeRecapDraft] = useState('');
  const [resumeNextStepsDraft, setResumeNextStepsDraft] = useState('');

  const safeTaskText = typeof taskText === 'string' ? taskText : '';
  const trimmedTaskText = safeTaskText.trim();
  const safeMinutes = useMemo(() => clampMinutes(minutes), [minutes]);
  const safeResumeTaskName = typeof resumeTaskName === 'string' ? resumeTaskName.trim() : '';
  const safeResumeRecap = typeof resumeRecap === 'string' ? resumeRecap : '';
  const safeResumeNextSteps = typeof resumeNextSteps === 'string' ? resumeNextSteps : '';
  const effectiveTaskName = (promptKind === 'resume-choice' ? safeResumeTaskName : trimmedTaskText) || 'Untitled task';
  const canAdvance = trimmedTaskText.length > 0;
  const showBack = stage === 'start-chooser' || stage === 'save-for-later' || stage === 'snooze-options';
  const showCompleteFromResume = stage === 'save-for-later' && promptKind === 'resume-choice';
  const showDismiss = stage !== 'snooze-options' && !showCompleteFromResume;

  useEffect(() => {
    if (!isOpen) return;
    setResumeRecapDraft(safeResumeRecap);
    setResumeNextStepsDraft(safeResumeNextSteps);
  }, [isOpen, safeResumeNextSteps, safeResumeRecap, safeResumeTaskName]);

  useEffect(() => {
    if (stage !== 'snooze-options') {
      previousStageRef.current = stage;
    }
  }, [stage]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(() => {
      if (stage === 'task-entry') {
        const input = textareaRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }

      if (stage === 'start-chooser') {
        const input = minutesInputRef.current;
        if (!input) return;
        input.focus();
        input.select();
        return;
      }

      if (stage === 'save-for-later') {
        const input = nextStepsRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 30);

    return () => window.clearTimeout(timer);
  }, [isOpen, stage]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      const primaryHeld = /Mac/i.test(navigator.platform || '') ? event.metaKey : event.ctrlKey;
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (!primaryHeld || !event.shiftKey || event.altKey || key !== 's') return;
      event.preventDefault();
      onSnooze?.('10m');
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSnooze]);

  if (!isOpen) return null;

  const handleBack = () => {
    if (stage === 'start-chooser') {
      onStageChange?.(promptKind === 'resume-choice' ? 'resume-choice' : 'task-entry');
      return;
    }

    if (stage === 'save-for-later') {
      onStageChange?.('resume-choice');
      return;
    }

    if (stage === 'snooze-options') {
      const fallbackStage = promptKind === 'resume-choice' ? 'resume-choice' : 'task-entry';
      const restoreStage = previousStageRef.current === 'snooze-options'
        ? fallbackStage
        : previousStageRef.current;
      onStageChange?.(restoreStage || fallbackStage);
    }
  };

  const handleAdvanceToChooser = () => {
    if (!canAdvance) return;
    onStageChange?.('start-chooser');
  };

  const handleStartTimed = () => {
    if (!safeMinutes) return;
    onStartSession?.({
      promptKind,
      mode: 'timed',
      minutes: safeMinutes,
      taskText: trimmedTaskText,
    });
  };

  const handleStartFreeflow = () => {
    onStartSession?.({
      promptKind,
      mode: 'freeflow',
      minutes: 0,
      taskText: trimmedTaskText,
    });
  };

  return (
    <div className={`reentry-prompt reentry-prompt--${surface}${strongActive ? ' reentry-prompt--attention' : ''}`}>
      <div className="reentry-prompt__header electron-no-drag">
        {showBack ? (
          <button type="button" className="reentry-prompt__header-btn" onClick={handleBack}>
            Back
          </button>
        ) : (
          <span className="reentry-prompt__header-spacer" aria-hidden="true" />
        )}
        {showDismiss ? (
          <button type="button" className="reentry-prompt__header-btn" onClick={() => onStageChange?.('snooze-options')}>
            Snooze
          </button>
        ) : showCompleteFromResume ? (
          <button
            type="button"
            className="reentry-prompt__header-btn reentry-prompt__header-btn--complete"
            data-testid="reentry-mark-complete"
            onClick={() => onCompleteFromResume?.({
              recap: resumeRecapDraft.trim(),
              nextSteps: resumeNextStepsDraft.trim(),
            })}
          >
            Mark complete
          </button>
        ) : (
          <span className="reentry-prompt__header-spacer" aria-hidden="true" />
        )}
      </div>

      <div className="reentry-prompt__body electron-no-drag">
        {stage === 'task-entry' ? (
          <section className="reentry-prompt__step reentry-prompt__step--task-entry">
            <h2 className="reentry-prompt__title">What&apos;s next?</h2>
            <p className="reentry-prompt__copy">Start something new, or pull from Parking Lot or History.</p>
            <textarea
              ref={textareaRef}
              className="reentry-prompt__textarea"
              rows={2}
              maxLength={maxTaskLength}
              value={safeTaskText}
              onChange={(event) => onTaskTextChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || !canAdvance) return;
                event.preventDefault();
                handleAdvanceToChooser();
              }}
              placeholder="What are we focusing on next?"
            />
            <div className="reentry-prompt__source-row">
              <button
                type="button"
                className="reentry-prompt__btn reentry-prompt__btn--ghost reentry-prompt__btn--shortcut"
                onClick={() => onOpenParkingLot?.()}
                data-testid="reentry-open-parking"
              >
                Parking Lot
              </button>
              <button
                type="button"
                className="reentry-prompt__btn reentry-prompt__btn--ghost reentry-prompt__btn--shortcut"
                onClick={() => onOpenSessionHistory?.()}
                data-testid="reentry-open-history"
              >
                Session History
              </button>
            </div>
            <div className="reentry-prompt__actions">
              <button
                type="button"
                className="reentry-prompt__btn reentry-prompt__btn--primary"
                onClick={handleAdvanceToChooser}
                disabled={!canAdvance}
              >
                Next
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'resume-choice' ? (
          <section className="reentry-prompt__step reentry-prompt__step--resume-choice">
            <h2 className="reentry-prompt__title">Ready to resume?</h2>
            <p className="reentry-prompt__copy">
              Pick up <span className="reentry-prompt__task-name">{safeResumeTaskName || 'this task'}</span>,
              {' '}or wrap it up first and start something new.
            </p>
            <div className="reentry-prompt__actions reentry-prompt__actions--column">
              <button
                type="button"
                className="reentry-prompt__btn reentry-prompt__btn--primary"
                onClick={() => onStageChange?.('start-chooser')}
              >
                Resume Previous Task
              </button>
              <button
                type="button"
                className="reentry-prompt__btn reentry-prompt__btn--ghost"
                onClick={() => onStageChange?.('save-for-later')}
              >
                Start Something New
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'save-for-later' ? (
          <section className="reentry-prompt__step reentry-prompt__step--save-for-later">
            <h2 className="reentry-prompt__title">Save “{safeResumeTaskName || 'this task'}” for later</h2>
            <p className="reentry-prompt__copy">Where did you leave off?</p>

            <label className="reentry-prompt__field">
              <span className="reentry-prompt__field-label">First step back in</span>
              <textarea
                ref={nextStepsRef}
                className="reentry-prompt__textarea reentry-prompt__textarea--notes"
                rows={4}
                maxLength={500}
                name="next-steps"
                value={resumeNextStepsDraft}
                onChange={(event) => setResumeNextStepsDraft(event.target.value)}
                placeholder="What should you do first when you come back?"
              />
            </label>

            <label className="reentry-prompt__field">
              <span className="reentry-prompt__field-label">Helpful context</span>
              <textarea
                className="reentry-prompt__textarea reentry-prompt__textarea--notes"
                rows={4}
                maxLength={500}
                name="recap"
                value={resumeRecapDraft}
                onChange={(event) => setResumeRecapDraft(event.target.value)}
                placeholder="Links, completed pieces, reminders, useful details..."
              />
            </label>

            <div className="reentry-prompt__actions">
              <button
                type="button"
                className="reentry-prompt__btn reentry-prompt__btn--primary"
                onClick={() => onSaveForLaterFromResume?.({
                  recap: resumeRecapDraft.trim(),
                  nextSteps: resumeNextStepsDraft.trim(),
                })}
              >
                Save and continue
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'start-chooser' ? (
          <section className="reentry-prompt__step reentry-prompt__step--chooser">
            <div className="reentry-prompt__task-card">
              <span className="reentry-prompt__task-label">Focusing on:</span>
              <span className="reentry-prompt__task-value">{effectiveTaskName}</span>
            </div>

            <div className="reentry-prompt__chip-row">
              {QUICK_MINUTES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`reentry-prompt__chip${safeMinutes === value ? ' is-active' : ''}`}
                  onClick={() => onMinutesChange?.(String(value))}
                >
                  {value}m
                </button>
              ))}
              <button
                type="button"
                className={`reentry-prompt__chip${safeMinutes !== 15 && safeMinutes !== 25 && safeMinutes !== 45 ? ' is-active' : ''}`}
                onClick={() => minutesInputRef.current?.focus()}
              >
                Custom
              </button>
            </div>

            <div className="reentry-prompt__inline-row">
              <input
                ref={minutesInputRef}
                className="reentry-prompt__minutes-input"
                type="number"
                min="1"
                max="240"
                step="1"
                value={minutes}
                onChange={(event) => onMinutesChange?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  handleStartTimed();
                }}
              />
              <button
                type="button"
                className="reentry-prompt__btn reentry-prompt__btn--primary"
                onClick={handleStartTimed}
                disabled={!safeMinutes}
              >
                Start Timer
              </button>
            </div>

            <div className="reentry-prompt__actions">
              <button
                type="button"
                className="reentry-prompt__btn reentry-prompt__btn--ghost"
                onClick={handleStartFreeflow}
              >
                Freeflow
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'snooze-options' ? (
          <section className="reentry-prompt__step reentry-prompt__step--snooze">
            <h2 className="reentry-prompt__title">Snooze reminder</h2>
            <p className="reentry-prompt__copy">Pick when this should come back.</p>
            <div className="reentry-prompt__actions reentry-prompt__actions--column">
              <button type="button" className="reentry-prompt__btn reentry-prompt__btn--soft" onClick={() => onSnooze?.('10m')}>
                10 minutes
              </button>
              <button type="button" className="reentry-prompt__btn reentry-prompt__btn--soft" onClick={() => onSnooze?.('30m')}>
                30 minutes
              </button>
              <button type="button" className="reentry-prompt__btn reentry-prompt__btn--soft" onClick={() => onSnooze?.('60m')}>
                1 hour
              </button>
              <button type="button" className="reentry-prompt__btn reentry-prompt__btn--soft" onClick={() => onSnooze?.('120m')}>
                2 hours
              </button>
              <button type="button" className="reentry-prompt__btn reentry-prompt__btn--ghost" onClick={() => onSnooze?.('reopen')}>
                Until I reopen
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
