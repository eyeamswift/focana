import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { getNextUnfinishedTask } from '../utils/taskPlan';

const BREAK_OPTIONS = [5, 15, 25];
const BREAK_MIN_MINUTES = 1;
const BREAK_MAX_MINUTES = 240;

function clampMinutes(value, fallback = 25) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, BREAK_MIN_MINUTES), BREAK_MAX_MINUTES);
}

function parseWholeMinutes(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < BREAK_MIN_MINUTES || parsed > BREAK_MAX_MINUTES) {
    return null;
  }
  return parsed;
}

function formatResumeAround(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const resumeAt = new Date(Date.now() + (minutes * 60 * 1000));
  return resumeAt.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatWrappedCopy(minutes, taskText) {
  const safeMinutes = Math.max(1, Math.round(Number(minutes) || 0));
  return `You wrapped ${safeMinutes} min on ${taskText}.`;
}

function formatPausedCopy(minutes, taskText) {
  const safeMinutes = Math.max(1, Math.round(Number(minutes) || 0));
  return `Paused after ${safeMinutes} min on ${taskText}.`;
}

function formatSaveTitle(taskText) {
  return `Save “${taskText}” for later`;
}

function combineNotes(nextSteps = '', recap = '') {
  const pieces = [nextSteps, recap]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(pieces)).join('\n\n');
}

export default function PostSessionPrompt({
  isOpen,
  candidate,
  dismissible = false,
  surfaceKind = 'post-session',
  feedbackEnabled = false,
  onLayoutChange,
  onDismiss,
  onKeepWorking,
  onTakeBreak,
  onStartNewTaskMarkComplete,
  onStartNewTaskSaveForLater,
  onMoveToNextTask,
  onDoneForNow,
  onFeedbackSelect,
  onFeedbackDismiss,
}) {
  const safeTaskText = useMemo(() => {
    const raw = typeof candidate?.taskText === 'string' ? candidate.taskText.trim() : '';
    return raw || 'this task';
  }, [candidate?.taskText]);
  const completedMinutes = Math.max(1, Math.round(Number(candidate?.completedMinutes) || 0));
  const suggestedTimedMinutes = candidate?.completedMode === 'timed'
    ? clampMinutes(candidate?.completedMinutes, 25)
    : 25;
  const taskAlreadyCompleted = candidate?.resolution === 'completed';
  const isPauseSurface = surfaceKind === 'pause' || candidate?.source === 'paused-current' || dismissible;
  const nextUpTask = useMemo(() => getNextUnfinishedTask(candidate?.taskPlan), [candidate?.taskPlan]);
  const safeNextUpTaskText = useMemo(() => {
    const raw = typeof nextUpTask?.title === 'string' ? nextUpTask.title.trim() : '';
    return raw || 'your next task';
  }, [nextUpTask?.title]);
  const showNextUpTimerWrap = !isPauseSurface
    && !taskAlreadyCompleted
    && candidate?.completedMode === 'timed'
    && Boolean(nextUpTask?.id && safeNextUpTaskText);

  const [stage, setStage] = useState('hub');
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [breakDurationMode, setBreakDurationMode] = useState('preset');
  const [customBreakMinutes, setCustomBreakMinutes] = useState('');
  const [breakShowsTimer, setBreakShowsTimer] = useState(true);
  const [timedMinutes, setTimedMinutes] = useState(String(suggestedTimedMinutes));
  const [notes, setNotes] = useState('');
  const [feedbackState, setFeedbackState] = useState('hidden');
  const frameRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setStage('hub');
    setBreakMinutes(5);
    setBreakDurationMode('preset');
    setCustomBreakMinutes('');
    setBreakShowsTimer(true);
    setTimedMinutes(String(suggestedTimedMinutes));
    setNotes(combineNotes(candidate?.nextSteps, candidate?.recap));
    setFeedbackState(feedbackEnabled ? 'waiting' : 'hidden');
  }, [
    candidate?.recap,
    candidate?.nextSteps,
    feedbackEnabled,
    isOpen,
    suggestedTimedMinutes,
  ]);

  useEffect(() => {
    if (!isOpen || !feedbackEnabled || stage !== 'hub' || feedbackState !== 'waiting') return undefined;
    const timeout = window.setTimeout(() => {
      setFeedbackState('ready');
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [feedbackEnabled, feedbackState, isOpen, stage]);

  useEffect(() => {
    if (!isOpen || feedbackState !== 'saved') return undefined;
    const timeout = window.setTimeout(() => {
      setFeedbackState('dimmed');
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [feedbackState, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || typeof onLayoutChange !== 'function') return undefined;

    let frameId = 0;
    const notifyLayoutChange = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        onLayoutChange();
      });
    };

    notifyLayoutChange();

    if (typeof ResizeObserver === 'undefined' || !frameRef.current) {
      return () => {
        if (frameId) window.cancelAnimationFrame(frameId);
      };
    }

    const observer = new ResizeObserver(() => {
      notifyLayoutChange();
    });
    observer.observe(frameRef.current);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [feedbackState, isOpen, onLayoutChange, stage]);

  const dismissFeedbackIfNeeded = () => {
    if (!feedbackEnabled) return;
    if (feedbackState === 'hidden' || feedbackState === 'dismissed' || feedbackState === 'saved' || feedbackState === 'dimmed') {
      return;
    }
    setFeedbackState('dismissed');
    onFeedbackDismiss?.();
  };

  const moveToStage = (nextStage) => {
    dismissFeedbackIfNeeded();
    setStage(nextStage);
  };

  const handleFeedback = (value) => {
    if (!feedbackEnabled) return;
    if (feedbackState !== 'ready') return;
    setFeedbackState('saved');
    onFeedbackSelect?.(value);
  };

  const handleDismiss = () => {
    if (!dismissible) return;
    dismissFeedbackIfNeeded();
    onDismiss?.();
  };

  useEffect(() => {
    if (!isOpen || !dismissible) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      handleDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissible, feedbackEnabled, feedbackState, isOpen, onDismiss]);

  if (!isOpen || !candidate?.taskText) {
    return null;
  }

  const feedbackVisible = stage === 'hub' && feedbackEnabled && ['ready', 'saved', 'dimmed'].includes(feedbackState);
  const bodyCopy = isPauseSurface
    ? formatPausedCopy(completedMinutes, safeTaskText)
    : formatWrappedCopy(completedMinutes, safeTaskText);
  const eyebrowCopy = isPauseSurface ? 'Paused session' : 'Session wrap';
  const headingCopy = isPauseSurface ? "You're paused." : 'Nice work.';
  const dismissLabel = isPauseSurface ? 'Close paused session options' : 'Dismiss Session Wrap';
  const regionLabel = isPauseSurface ? 'Paused Session' : 'Session Wrap';
  const isChildStage = stage !== 'hub';

  const startTimedKeepWorking = () => {
    onKeepWorking?.({
      mode: 'timed',
      minutes: clampMinutes(timedMinutes, suggestedTimedMinutes),
    });
  };

  const parsedCustomBreakMinutes = parseWholeMinutes(customBreakMinutes);
  const resolvedBreakMinutes = breakDurationMode === 'custom'
    ? parsedCustomBreakMinutes
    : breakMinutes;
  const canStartBreak = Number.isInteger(resolvedBreakMinutes)
    && resolvedBreakMinutes >= BREAK_MIN_MINUTES
    && resolvedBreakMinutes <= BREAK_MAX_MINUTES;
  const resumeAroundCopy = canStartBreak
    ? `Resume around ${formatResumeAround(resolvedBreakMinutes)}`
    : `Enter ${BREAK_MIN_MINUTES}-${BREAK_MAX_MINUTES} minutes.`;

  const renderHub = () => (
    <>
      {dismissible ? (
        <button
          type="button"
          className="post-session-panel__dismiss"
          onClick={handleDismiss}
          aria-label={dismissLabel}
          data-testid="post-session-dismiss"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      ) : null}

      <div className="post-session-panel__header">
        <span className="post-session-panel__eyebrow" data-testid="post-session-eyebrow">{eyebrowCopy}</span>
        <h2 className="post-session-panel__heading" data-testid="post-session-heading">{headingCopy}</h2>
        <div className="post-session-panel__body-row">
          <p className="post-session-panel__body line-clamp-2" data-testid="post-session-body">
            {bodyCopy}
          </p>
          {feedbackVisible ? (
            <div
              className={`post-session-feedback${feedbackState === 'dimmed' ? ' post-session-feedback--dimmed' : ''}`}
              data-testid="post-session-feedback-row"
              aria-live="polite"
            >
              {feedbackState === 'saved' || feedbackState === 'dimmed' ? (
                <span data-testid="post-session-feedback-confirmation">Thanks — saved.</span>
              ) : (
                <>
                  <button
                    type="button"
                    className="post-session-feedback__button"
                    data-testid="post-session-feedback-up"
                    aria-label="Thumbs up"
                    onClick={() => handleFeedback('up')}
                  >
                    <span aria-hidden="true">👍🏾</span>
                  </button>
                  <button
                    type="button"
                    className="post-session-feedback__button"
                    data-testid="post-session-feedback-down"
                    aria-label="Thumbs down"
                    onClick={() => handleFeedback('down')}
                  >
                    <span aria-hidden="true">👎🏾</span>
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="post-session-panel__actions">
        {showNextUpTimerWrap ? (
          <>
            <Button
              type="button"
              className="post-session-action post-session-action--primary"
              onClick={() => moveToStage('keep-working')}
              data-testid="post-session-primary"
            >
              <span className="truncate">Continue current task</span>
              <ChevronRight style={{ width: 18, height: 18, flexShrink: 0 }} />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="post-session-action post-session-action--secondary"
              onClick={() => {
                dismissFeedbackIfNeeded();
                setStage('move-next-notes');
              }}
              data-testid="post-session-move-next"
            >
              <span className="line-clamp-2">Move onto {safeNextUpTaskText}</span>
              <ChevronRight style={{ width: 18, height: 18, flexShrink: 0 }} />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="post-session-action post-session-action--secondary"
              onClick={() => {
                dismissFeedbackIfNeeded();
                setStage('done-notes');
              }}
              data-testid="post-session-done"
            >
              <span>Done for now</span>
              <ChevronRight style={{ width: 18, height: 18, flexShrink: 0 }} />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              className="post-session-action post-session-action--primary"
              onClick={() => moveToStage('keep-working')}
              data-testid="post-session-primary"
            >
              <span className="truncate">Keep working on {safeTaskText}</span>
              <ChevronRight style={{ width: 18, height: 18, flexShrink: 0 }} />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="post-session-action post-session-action--secondary"
              onClick={() => moveToStage('break')}
              data-testid="post-session-break"
            >
              <span>Take a break</span>
              <ChevronRight style={{ width: 18, height: 18, flexShrink: 0 }} />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="post-session-action post-session-action--secondary"
              onClick={() => {
                dismissFeedbackIfNeeded();
                setStage('done-notes');
              }}
              data-testid="post-session-done"
            >
              <span>Save and continue later</span>
              <ChevronRight style={{ width: 18, height: 18, flexShrink: 0 }} />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="post-session-action post-session-action--secondary"
              onClick={() => {
                if (taskAlreadyCompleted) {
                  dismissFeedbackIfNeeded();
                  onStartNewTaskMarkComplete?.({ alreadyCompleted: true });
                  return;
                }
                moveToStage('new-task-decision');
              }}
              data-testid="post-session-new-task"
            >
              <span>Start a new task</span>
              <ChevronRight style={{ width: 18, height: 18, flexShrink: 0 }} />
            </Button>

            {!taskAlreadyCompleted ? (
              <Button
                type="button"
                variant="outline"
                className="post-session-action post-session-action--secondary post-session-action--terminal"
                onClick={() => onStartNewTaskMarkComplete?.()}
                data-testid="post-session-mark-complete"
              >
                <span>Mark complete</span>
              </Button>
            ) : null}
          </>
        )}
      </div>
    </>
  );

  const renderChildShell = ({ title, children, onClose }) => (
    <>
      <div className="post-session-child__header">
        <h2 className="post-session-child__title">{title}</h2>
        {onClose ? (
          <button
            type="button"
            className="post-session-child__close"
            onClick={onClose}
            aria-label={isPauseSurface ? 'Back to paused session options' : 'Back to Session Wrap'}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        ) : null}
      </div>
      {children}
    </>
  );

  const renderKeepWorking = () => renderChildShell({
    title: `Keep working on ${safeTaskText}.`,
    onClose: () => setStage('hub'),
    children: (
      <div className="post-session-child__body">
        <div className="post-session-fieldset">
          <span className="post-session-fieldset__label">Set timer</span>
          <div className="post-session-timer-row">
            <Input
              type="number"
              min="1"
              max="240"
              step="1"
              value={timedMinutes}
              onChange={(event) => setTimedMinutes(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                startTimedKeepWorking();
              }}
              className="post-session-timer-row__input"
              data-testid="post-session-keep-working-minutes"
            />
            <span className="post-session-timer-row__unit">min</span>
          </div>
        </div>

        <div className="post-session-child__cta-group">
          <Button
            type="button"
            className="post-session-pill-button"
            onClick={startTimedKeepWorking}
          >
            Start timed session
          </Button>
          <Button
            type="button"
            variant="outline"
            className="post-session-pill-button post-session-pill-button--ghost"
            onClick={() => onKeepWorking?.({ mode: 'freeflow', minutes: 0 })}
          >
            Freeflow
          </Button>
        </div>
      </div>
    ),
  });

  const renderBreak = () => renderChildShell({
    title: 'You deserve a break.',
    onClose: () => setStage('hub'),
    children: (
      <div className="post-session-child__body">
        <p className="post-session-child__subcopy">See you soon.</p>
        <div className="post-session-break-options">
          {BREAK_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`post-session-break-option${breakDurationMode === 'preset' && breakMinutes === option ? ' is-selected' : ''}`}
              onClick={() => {
                setBreakMinutes(option);
                setBreakDurationMode('preset');
                setCustomBreakMinutes('');
              }}
            >
              {option} min
            </button>
          ))}
        </div>
        <label className="post-session-break-custom">
          <span className="post-session-fieldset__label">Custom</span>
          <span className="post-session-break-custom__row">
            <Input
              type="number"
              min={BREAK_MIN_MINUTES}
              max={BREAK_MAX_MINUTES}
              step="1"
              inputMode="numeric"
              value={customBreakMinutes}
              onChange={(event) => {
                setBreakDurationMode('custom');
                setCustomBreakMinutes(event.target.value);
              }}
              className="post-session-break-custom__input"
              placeholder="10"
              aria-label="Custom break length in minutes"
              data-testid="post-session-break-custom-minutes"
            />
            <span className="post-session-break-custom__unit">min</span>
          </span>
        </label>
        <p className="post-session-break-duration__hint">{resumeAroundCopy}</p>
        <div className="post-session-break-visibility">
          <span className="post-session-fieldset__label">Break window</span>
          <div
            className="post-session-toggle-group"
            role="group"
            aria-label="Break timer visibility"
          >
            <button
              type="button"
              className={`post-session-toggle${breakShowsTimer ? ' is-active' : ''}`}
              aria-pressed={breakShowsTimer}
              onClick={() => setBreakShowsTimer(true)}
            >
              Show timer
            </button>
            <button
              type="button"
              className={`post-session-toggle${!breakShowsTimer ? ' is-active' : ''}`}
              aria-pressed={!breakShowsTimer}
              onClick={() => setBreakShowsTimer(false)}
            >
              Hide timer
            </button>
          </div>
          <p className="post-session-break-visibility__hint">
            {breakShowsTimer ? 'Minimize to the countdown timer.' : 'Minimize to the Focana logo.'}
          </p>
        </div>
        <Button
          type="button"
          className="post-session-pill-button"
          disabled={!canStartBreak}
          onClick={() => onTakeBreak?.({
            minutes: resolvedBreakMinutes,
            showTimer: breakShowsTimer,
          })}
        >
          BRB
        </Button>
      </div>
    ),
  });

  const renderNewTaskDecision = () => renderChildShell({
    title: 'Start a new task',
    onClose: () => setStage('hub'),
    children: (
      <div className="post-session-child__body">
        <p className="post-session-child__question">What should happen to “{safeTaskText}”?</p>
        <div className="post-session-inline-actions">
          <Button
            type="button"
            variant="outline"
            className="post-session-pill-button post-session-pill-button--ghost"
            onClick={() => setStage('new-task-notes')}
          >
            Save for later
          </Button>
          <Button
            type="button"
            className="post-session-pill-button"
            onClick={() => onStartNewTaskMarkComplete?.()}
          >
            Mark complete
          </Button>
        </div>
      </div>
    ),
  });

  const renderNotes = ({ title, ctaLabel, onClose, onSubmit }) => renderChildShell({
    title,
    onClose,
    children: (
      <div className="post-session-child__body">
        <p className="post-session-child__question">Where did you leave off?</p>

        <div className="post-session-notes-grid">
          <label className="post-session-notes-grid__field">
            <span className="post-session-notes-grid__label">Notes</span>
            <span className="post-session-notes-grid__hint">
              Enter your immediate next steps and/or any notes, links, or resources that will help you get started when you return.
            </span>
            <Textarea
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Next steps, links, resources, or reminders..."
              maxLength={900}
              className="post-session-notes-grid__textarea"
            />
          </label>
        </div>

        <Button
          type="button"
          className="post-session-pill-button"
          onClick={() => onSubmit?.({
            nextSteps: '',
            recap: notes.trim(),
          })}
        >
          {ctaLabel}
        </Button>
      </div>
    ),
  });

  let content = renderHub();
  if (stage === 'keep-working') {
    content = renderKeepWorking();
  } else if (stage === 'break') {
    content = renderBreak();
  } else if (stage === 'new-task-decision') {
    content = renderNewTaskDecision();
  } else if (stage === 'new-task-notes') {
    content = renderNotes({
      title: formatSaveTitle(safeTaskText),
      ctaLabel: 'Save and continue',
      onClose: () => setStage('hub'),
      onSubmit: onStartNewTaskSaveForLater,
    });
  } else if (stage === 'move-next-notes') {
    content = renderNotes({
      title: 'Leave a pickup note',
      ctaLabel: `Move onto ${safeNextUpTaskText}`,
      onClose: () => setStage('hub'),
      onSubmit: onMoveToNextTask,
    });
  } else if (stage === 'done-notes') {
    content = renderNotes({
      title: showNextUpTimerWrap ? 'Leave a pickup note' : 'Save and continue later',
      ctaLabel: showNextUpTimerWrap ? 'Done for now' : 'Save for later',
      onClose: () => setStage('hub'),
      onSubmit: onDoneForNow,
    });
  }

  return (
    <section
      className={`post-session-panel${isChildStage ? ' post-session-panel--child-stage' : ' post-session-panel--hub-stage'}`}
      role="region"
      aria-label={regionLabel}
    >
      <div
        ref={frameRef}
        className={`post-session-panel__frame${isChildStage ? ' post-session-panel__frame--child' : ''}${dismissible ? ' post-session-panel__frame--dismissible' : ''}`}
      >
        {content}
      </div>
    </section>
  );
}
