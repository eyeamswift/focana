import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';

const BREAK_OPTIONS = [5, 15, 25];

function clampMinutes(value, fallback = 25) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 240);
}

function formatWrappedCopy(minutes, taskText) {
  const safeMinutes = Math.max(1, Math.round(Number(minutes) || 0));
  return `You wrapped ${safeMinutes} min on ${taskText}.`;
}

function formatSaveTitle(taskText) {
  return `Save “${taskText}” for later`;
}

export default function PostSessionPrompt({
  isOpen,
  candidate,
  feedbackEnabled = false,
  onLayoutChange,
  onKeepWorking,
  onTakeBreak,
  onStartNewTaskMarkComplete,
  onStartNewTaskSaveForLater,
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

  const [stage, setStage] = useState('hub');
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [breakShowsTimer, setBreakShowsTimer] = useState(true);
  const [timedMinutes, setTimedMinutes] = useState(String(suggestedTimedMinutes));
  const [nextSteps, setNextSteps] = useState('');
  const [recap, setRecap] = useState('');
  const [feedbackState, setFeedbackState] = useState('hidden');
  const frameRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setStage('hub');
    setBreakMinutes(5);
    setBreakShowsTimer(true);
    setTimedMinutes(String(suggestedTimedMinutes));
    setNextSteps(typeof candidate?.nextSteps === 'string' ? candidate.nextSteps : '');
    setRecap(typeof candidate?.recap === 'string' ? candidate.recap : '');
    setFeedbackState(feedbackEnabled ? 'waiting' : 'hidden');
  }, [
    candidate?.nextSteps,
    candidate?.recap,
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

  if (!isOpen || !candidate?.taskText) {
    return null;
  }

  const feedbackVisible = stage === 'hub' && feedbackEnabled && ['ready', 'saved', 'dimmed'].includes(feedbackState);
  const bodyCopy = formatWrappedCopy(completedMinutes, safeTaskText);
  const isChildStage = stage !== 'hub';

  const startTimedKeepWorking = () => {
    onKeepWorking?.({
      mode: 'timed',
      minutes: clampMinutes(timedMinutes, suggestedTimedMinutes),
    });
  };

  const renderHub = () => (
    <>
      <div className="post-session-panel__header">
        <span className="post-session-panel__eyebrow" data-testid="post-session-eyebrow">Session wrap</span>
        <h2 className="post-session-panel__heading" data-testid="post-session-heading">Nice work.</h2>
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
          onClick={() => moveToStage('new-task-decision')}
          data-testid="post-session-new-task"
        >
          <span>Start a new task</span>
          <ChevronRight style={{ width: 18, height: 18, flexShrink: 0 }} />
        </Button>
      </div>

      <button
        type="button"
        className="post-session-link"
        onClick={() => {
          dismissFeedbackIfNeeded();
          setStage('done-notes');
        }}
        data-testid="post-session-done"
      >
        Done for now
      </button>
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
            aria-label="Back to Session Wrap"
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
              className={`post-session-break-option${breakMinutes === option ? ' is-selected' : ''}`}
              onClick={() => setBreakMinutes(option)}
            >
              {option} min
            </button>
          ))}
        </div>
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
          onClick={() => onTakeBreak?.({
            minutes: breakMinutes,
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
            <span className="post-session-notes-grid__label">First step back in</span>
            <Textarea
              name="next-steps"
              value={nextSteps}
              onChange={(event) => setNextSteps(event.target.value)}
              placeholder="What should you do first when you come back?"
              maxLength={500}
              className="post-session-notes-grid__textarea"
            />
          </label>

          <label className="post-session-notes-grid__field">
            <span className="post-session-notes-grid__label">Helpful context</span>
            <Textarea
              name="recap"
              value={recap}
              onChange={(event) => setRecap(event.target.value)}
              placeholder="Links, completed pieces, reminders, useful details..."
              maxLength={500}
              className="post-session-notes-grid__textarea"
            />
          </label>
        </div>

        <Button
          type="button"
          className="post-session-pill-button"
          onClick={() => onSubmit?.({
            nextSteps: nextSteps.trim(),
            recap: recap.trim(),
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
  } else if (stage === 'done-notes') {
    content = renderNotes({
      title: 'Done for now',
      ctaLabel: 'Done for now',
      onClose: null,
      onSubmit: onDoneForNow,
    });
  }

  return (
    <section
      className={`post-session-panel${isChildStage ? ' post-session-panel--child-stage' : ' post-session-panel--hub-stage'}`}
      role="region"
      aria-label="Session Wrap"
    >
      <div
        ref={frameRef}
        className={`post-session-panel__frame${isChildStage ? ' post-session-panel__frame--child' : ''}`}
      >
        {content}
      </div>
    </section>
  );
}
