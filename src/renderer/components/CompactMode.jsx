import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Square, ClipboardList, BellOff, Info } from 'lucide-react';
import { formatTime } from '../utils/time';
import ReentryPrompt from './ReentryPrompt';

// ---------------------------------------------------------------------------
// Pill width constants (px)
// ---------------------------------------------------------------------------
const H_MARGIN   = 4;   // account for the stronger 2px pill frame on both sides
const PILL_PAD   = 40;  // 20px left + 20px right padding
const PILL_BASE_H = 72;
const PILL_MAX_H = 260;
const DOCK_W     = 106; // fixed right dock for timer/info or controls
const TASK_DOCK_GAP = 8;

const TASK_MIN_W = 64;
const TASK_MAX_W = 220; // max task width before wrapping
const CHECKIN_POPUP_MIN_W = 420;
const CHECKIN_POPUP_EXTRA_H = 148;
const REENTRY_PROMPT_SIZES = {
  'task-entry': { width: 440, height: 386 },
  'resume-choice': { width: 440, height: 294 },
  'save-for-later': { width: 440, height: 620 },
  'start-chooser': { width: 440, height: 390 },
  'snooze-options': { width: 440, height: 444 },
};
const COMPACT_PULSE_CYCLE_MS = 4500;
const COMPACT_PULSE_REPEAT_COUNT = 1;
const COMPACT_SUCCESS_CUE_MS = 820;
const COMPACT_SUCCESS_SPARKS = [
  { top: '18%', left: '10%', width: 16, driftX: 32, driftY: -12, delay: 0, duration: 720 },
  { top: '34%', left: '22%', width: 12, driftX: 24, driftY: 10, delay: 70, duration: 760 },
  { top: '58%', left: '18%', width: 18, driftX: 30, driftY: -8, delay: 120, duration: 780 },
  { top: '26%', left: '48%', width: 14, driftX: 28, driftY: -10, delay: 90, duration: 700 },
  { top: '52%', left: '54%', width: 12, driftX: 34, driftY: 8, delay: 150, duration: 760 },
  { top: '20%', left: '76%', width: 10, driftX: 24, driftY: 12, delay: 200, duration: 700 },
  { top: '62%', left: '72%', width: 16, driftX: 26, driftY: -14, delay: 240, duration: 780 },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function CompactMode({
  task,
  isRunning,
  time,
  pulseSignal = 0,
  successCueSignal = 0,
  onDoubleClick,
  onOpenDistractionJar,
  thoughtCount = 0,
  onPlay,
  onPause,
  onStop,
  pulseEnabled = true,
  dndActive = false,
  checkInState = 'idle',
  reentryPromptVisible = false,
  reentryPromptStrongActive = false,
  reentryPromptKind = 'start',
  reentryPromptStage = 'task-entry',
  reentryPromptTaskText = '',
  reentryPromptMinutes = '25',
  reentryResumeTaskName = '',
  reentryResumeRecap = '',
  reentryResumeNextSteps = '',
  onReentryTaskTextChange,
  onReentryMinutesChange,
  onReentryStageChange,
  onReentryStartSession,
  onReentrySaveForLaterFromResume,
  onReentryOpenParkingLot,
  onReentryOpenSessionHistory,
  onReentrySnooze,
}) {
  const [showControls, setShowControls] = useState(false);
  const [shouldPulse, setShouldPulse]   = useState(false);
  const [showSuccessCue, setShowSuccessCue] = useState(false);
  const [successCueBurstId, setSuccessCueBurstId] = useState(0);
  const [showHelpHint, setShowHelpHint] = useState(false);
  const [taskMetrics, setTaskMetrics]   = useState({ width: TASK_MIN_W, height: PILL_BASE_H });

  const clickTimerRef    = useRef(null);
  const controlsHideRef  = useRef(null);
  const pulseResetTimeoutRef = useRef(null);
  const successCueTimeoutRef = useRef(null);
  const taskMeasureInlineRef = useRef(null);
  const taskMeasureBlockRef = useRef(null);
  const dragMoveHandlerRef = useRef(null);
  const dragUpHandlerRef = useRef(null);
  const dragBlurHandlerRef = useRef(null);
  const hasInitialized   = useRef(false);
  const isDraggingRef    = useRef(false);
  const lastPulseSignalRef = useRef(pulseSignal);
  const lastSuccessCueSignalRef = useRef(successCueSignal);

  const taskLabel = task || '';
  const hasTaskLabel = taskLabel.trim().length > 0;
  const isTaskVisible = hasTaskLabel;

  useEffect(() => {
    const label = (taskLabel || '').trim();
    const inlineMeasure = taskMeasureInlineRef.current;
    const blockMeasure = taskMeasureBlockRef.current;
    if (!isTaskVisible || !label || !inlineMeasure || !blockMeasure) {
      setTaskMetrics({ width: TASK_MIN_W, height: PILL_BASE_H });
      return;
    }

    inlineMeasure.textContent = label;
    blockMeasure.textContent = label;

    const measuredWidth = Math.ceil(
      inlineMeasure.scrollWidth || inlineMeasure.getBoundingClientRect().width || TASK_MIN_W,
    );
    const taskWidth = clamp(Math.max(measuredWidth, TASK_MIN_W), TASK_MIN_W, TASK_MAX_W);
    blockMeasure.style.width = `${taskWidth}px`;
    const taskHeight = clamp(
      Math.max(
        PILL_BASE_H,
        Math.ceil(blockMeasure.scrollHeight || blockMeasure.getBoundingClientRect().height || PILL_BASE_H),
      ),
      PILL_BASE_H,
      PILL_MAX_H,
    );

    setTaskMetrics({ width: taskWidth, height: taskHeight });
  }, [isTaskVisible, taskLabel]);

  // Pre-calculate target window widths
  const basePillW = useMemo(
    () => PILL_PAD + DOCK_W,
    [],
  );
  const checkInPromptActive = checkInState === 'prompting';
  const reentryPromptActive = reentryPromptVisible === true;
  const activeReentryPromptSize = useMemo(
    () => REENTRY_PROMPT_SIZES[reentryPromptStage] || REENTRY_PROMPT_SIZES['task-entry'],
    [reentryPromptStage],
  );
  const baseWinW = useMemo(() => {
    const baseWidth = basePillW + H_MARGIN;
    return checkInPromptActive ? Math.max(baseWidth, CHECKIN_POPUP_MIN_W) : baseWidth;
  }, [basePillW, checkInPromptActive]);
  const visibleTaskWidth = useMemo(
    () => (isTaskVisible ? taskMetrics.width + TASK_DOCK_GAP : 0),
    [isTaskVisible, taskMetrics.width],
  );
  const restWinW  = useMemo(
    () => {
      const restingWidth = basePillW + visibleTaskWidth + H_MARGIN;
      return checkInPromptActive ? Math.max(restingWidth, CHECKIN_POPUP_MIN_W) : restingWidth;
    },
    [basePillW, visibleTaskWidth, checkInPromptActive],
  );
  const settledWinW = useMemo(
    () => (reentryPromptActive ? activeReentryPromptSize.width : (isTaskVisible ? restWinW : baseWinW)),
    [activeReentryPromptSize.width, baseWinW, isTaskVisible, reentryPromptActive, restWinW],
  );
  const pillH = useMemo(
    () => (isTaskVisible ? taskMetrics.height : PILL_BASE_H),
    [isTaskVisible, taskMetrics.height],
  );
  const winH = useMemo(
    () => {
      if (reentryPromptActive) return activeReentryPromptSize.height;
      return checkInPromptActive ? Math.max(pillH + CHECKIN_POPUP_EXTRA_H, PILL_BASE_H + CHECKIN_POPUP_EXTRA_H) : pillH;
    },
    [activeReentryPromptSize.height, checkInPromptActive, pillH, reentryPromptActive],
  );
  const isPulseAnimating = shouldPulse && pulseEnabled && !dndActive;

  useEffect(() => {
    if (!window.electronAPI?.beginCompactTransient || !window.electronAPI?.endCompactTransient) return undefined;

    if (checkInPromptActive) {
      window.electronAPI.beginCompactTransient('checkin-prompt');
      return () => {
        window.electronAPI.endCompactTransient('checkin-prompt', 260);
      };
    }

    window.electronAPI.endCompactTransient('checkin-prompt', 260);
    return undefined;
  }, [checkInPromptActive]);

  useEffect(() => {
    if (!window.electronAPI?.beginCompactTransient || !window.electronAPI?.endCompactTransient) return undefined;

    if (reentryPromptActive) {
      setShowControls(false);
      setShowHelpHint(false);
      window.electronAPI.beginCompactTransient('reentry-prompt');
      return () => {
        window.electronAPI.endCompactTransient('reentry-prompt', 260);
      };
    }

    window.electronAPI.endCompactTransient('reentry-prompt', 260);
    return undefined;
  }, [reentryPromptActive]);

  useEffect(() => {
    return () => {
      window.electronAPI?.endCompactTransient?.('compact-controls', 0);
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.beginCompactTransient || !window.electronAPI?.endCompactTransient) return undefined;

    if (showControls) {
      window.electronAPI.beginCompactTransient('compact-controls');
      return undefined;
    }

    window.electronAPI.endCompactTransient('compact-controls', 210);
    return undefined;
  }, [showControls]);

  // ---------------------------------------------------------------------------
  // Sync window size with pill state via IPC
  //   Expanding: resize window first, then CSS transition fills it in (~200ms)
  //   Shrinking: CSS transition first, then resize window after (~210ms delay)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!window.electronAPI?.setPillWidth && !window.electronAPI?.setPillSize) return;

    const pushPillSize = (width, height) => {
      if (window.electronAPI?.setPillSize) {
        window.electronAPI.setPillSize({ width, height, source: 'compact-layout' });
      } else {
        window.electronAPI.setPillWidth(width);
      }
    };

    // Initial mount — size to the settled compact width immediately so a
    // running task does not get stuck in the timer-only shell.
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      pushPillSize(settledWinW, winH);
      const retryTimer = setTimeout(() => {
        pushPillSize(settledWinW, winH);
      }, 80);
      return () => clearTimeout(retryTimer);
    }

    if (reentryPromptActive) {
      pushPillSize(activeReentryPromptSize.width, activeReentryPromptSize.height);
    } else if (isTaskVisible) {
      pushPillSize(restWinW, winH);
    } else {
      // Shrinking: wait for CSS transition to finish before resizing
      const t = setTimeout(() => {
        pushPillSize(baseWinW, winH);
      }, 210);
      return () => clearTimeout(t);
    }
  }, [activeReentryPromptSize.height, activeReentryPromptSize.width, baseWinW, isTaskVisible, reentryPromptActive, restWinW, settledWinW, winH]);

  useEffect(() => {
    if (pulseSignal === lastPulseSignalRef.current) return;
    lastPulseSignalRef.current = pulseSignal;
    if (!pulseSignal || !pulseEnabled || dndActive) return;
    setShouldPulse(true);
    if (pulseResetTimeoutRef.current) clearTimeout(pulseResetTimeoutRef.current);
    pulseResetTimeoutRef.current = setTimeout(() => {
      setShouldPulse(false);
      pulseResetTimeoutRef.current = null;
    }, COMPACT_PULSE_CYCLE_MS * COMPACT_PULSE_REPEAT_COUNT);
  }, [pulseSignal, pulseEnabled, dndActive]);

  useEffect(() => {
    if (successCueSignal === lastSuccessCueSignalRef.current) return;
    lastSuccessCueSignalRef.current = successCueSignal;
    if (!successCueSignal) return;
    setSuccessCueBurstId((prev) => prev + 1);
    setShowSuccessCue(true);
    if (successCueTimeoutRef.current) clearTimeout(successCueTimeoutRef.current);
    successCueTimeoutRef.current = setTimeout(() => {
      setShowSuccessCue(false);
      successCueTimeoutRef.current = null;
    }, COMPACT_SUCCESS_CUE_MS);
  }, [successCueSignal]);

  useEffect(() => {
    if (showControls) {
      setShowHelpHint(false);
    }
  }, [showControls]);

  useEffect(() => () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    if (controlsHideRef.current) clearTimeout(controlsHideRef.current);
    if (pulseResetTimeoutRef.current) clearTimeout(pulseResetTimeoutRef.current);
    if (successCueTimeoutRef.current) clearTimeout(successCueTimeoutRef.current);
    if (dragMoveHandlerRef.current) document.removeEventListener('pointermove', dragMoveHandlerRef.current);
    if (dragUpHandlerRef.current) document.removeEventListener('pointerup', dragUpHandlerRef.current);
    if (dragBlurHandlerRef.current) window.removeEventListener('blur', dragBlurHandlerRef.current);
  }, []);

  // Reset controls auto-hide timer (call after any button interaction)
  const resetControlsTimer = () => {
    if (controlsHideRef.current) clearTimeout(controlsHideRef.current);
    controlsHideRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  // ---------------------------------------------------------------------------
  // JS drag — move window by tracking mouse delta and sending IPC
  // (CSS -webkit-app-region:drag blocks mouse events, so we do this in JS)
  // ---------------------------------------------------------------------------
  // Use pointerdown + setPointerCapture so the pill keeps receiving pointer
  // events even when the cursor escapes this small window during a fast drag.
  const handlePointerDown = (e) => {
    if (e.button !== 0) return;           // left button only
    if (e.target.closest('button')) return; // let button clicks through

    if (dragMoveHandlerRef.current) document.removeEventListener('pointermove', dragMoveHandlerRef.current);
    if (dragUpHandlerRef.current) document.removeEventListener('pointerup', dragUpHandlerRef.current);
    if (dragBlurHandlerRef.current) window.removeEventListener('blur', dragBlurHandlerRef.current);
    dragMoveHandlerRef.current = null;
    dragUpHandlerRef.current = null;
    dragBlurHandlerRef.current = null;

    // Capture the pointer so we keep tracking even outside the small window
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    const capturedPointerId = e.pointerId;
    const captureTarget = e.target;

    const startX = e.screenX;
    const startY = e.screenY;
    let started = false;

    const releaseCaptureIfNeeded = () => {
      try { captureTarget.releasePointerCapture(capturedPointerId); } catch (_) {}
    };

    const onMove = (ev) => {
      const dx = ev.screenX - startX;
      const dy = ev.screenY - startY;

      if (!started && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        started = true;
        isDraggingRef.current = true;
        // Cancel any pending click debounce so drag doesn't also show controls
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        window.electronAPI.pillDragStart();
      }

      if (started) {
        window.electronAPI.pillDragMove(dx, dy);
      }
    };

    const onUp = () => {
      releaseCaptureIfNeeded();
      if (started) window.electronAPI.pillDragEnd();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onUp);
      dragMoveHandlerRef.current = null;
      dragUpHandlerRef.current = null;
      dragBlurHandlerRef.current = null;
      // Reset after the click event has had a chance to fire (if any)
      setTimeout(() => { isDraggingRef.current = false; }, 0);
    };

    dragMoveHandlerRef.current = onMove;
    dragUpHandlerRef.current = onUp;
    dragBlurHandlerRef.current = onUp;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onUp);
  };

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI?.openCompactContextMenu?.();
  };

  // Single click — debounced 220ms to avoid collision with double-click
  const handlePillClick = (e) => {
    if (isDraggingRef.current) return; // suppress click that follows a drag
    e.stopPropagation();
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      setShowControls(true);
      resetControlsTimer();
    }, 220);
  };

  // Double click — cancel pending single-click, exit compact mode
  const handlePillDoubleClick = (e) => {
    if (isDraggingRef.current) return; // suppress dblclick that follows a drag
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    onDoubleClick();
  };

  // Wrap a control button: stop propagation + reset auto-hide timer
  const ctrl = (fn) => (e) => {
    e.stopPropagation();
    if (typeof fn === 'function') fn();
    resetControlsTimer();
  };

  const timerColor = isRunning ? 'var(--timer-running)' : 'var(--compact-text)';
  const pillGlowStyle = checkInPromptActive
    ? { boxShadow: '0 0 0 2px rgba(217, 119, 6, 0.35), var(--shadow-minimal)', borderColor: '#D97706' }
    : undefined;
  const pillStyle = { height: pillH, '--compact-dock-width': `${DOCK_W}px`, ...(pillGlowStyle || {}) };

  if (reentryPromptActive) {
    return (
      <div className="compact-reentry-shell">
        <ReentryPrompt
          isOpen
          surface="compact"
          promptKind={reentryPromptKind}
          stage={reentryPromptStage}
          strongActive={reentryPromptStrongActive}
          taskText={reentryPromptTaskText}
          minutes={reentryPromptMinutes}
          resumeTaskName={reentryResumeTaskName}
          resumeRecap={reentryResumeRecap}
          resumeNextSteps={reentryResumeNextSteps}
          onTaskTextChange={onReentryTaskTextChange}
          onMinutesChange={onReentryMinutesChange}
          onStageChange={onReentryStageChange}
          onStartSession={onReentryStartSession}
          onSaveForLaterFromResume={onReentrySaveForLaterFromResume}
          onOpenParkingLot={onReentryOpenParkingLot}
          onOpenSessionHistory={onReentryOpenSessionHistory}
          onSnooze={onReentrySnooze}
        />
      </div>
    );
  }

  return (
    <div
      className={`pill pill--logo${isPulseAnimating ? ' animate-pulse-compact pill--pulse-active' : ''}`}
      style={pillStyle}
      onPointerDown={handlePointerDown}
      onDragStart={(e) => e.preventDefault()}
      onClick={handlePillClick}
      onDoubleClick={handlePillDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <span className="pill-pulse-border" aria-hidden="true" />
      <span className="pill-pulse-wash" aria-hidden="true" />
      <span className="pill-pulse-ripple" aria-hidden="true" />
      {showSuccessCue ? (
        <span key={successCueBurstId} className="pill-success-cue pill-success-cue--active" aria-hidden="true">
          <span className="pill-success-wash" />
          {COMPACT_SUCCESS_SPARKS.map((spark, index) => (
            <span
              key={`${successCueBurstId}-${index}`}
              className="pill-success-spark"
              style={{
                '--spark-top': spark.top,
                '--spark-left': spark.left,
                '--spark-width': `${spark.width}px`,
                '--spark-drift-x': `${spark.driftX}px`,
                '--spark-drift-y': `${spark.driftY}px`,
                '--spark-delay': `${spark.delay}ms`,
                '--spark-duration': `${spark.duration}ms`,
              }}
            />
          ))}
        </span>
      ) : null}

      <div className={`pill-content${isPulseAnimating ? ' pill-content--pulse' : ''}${showControls ? ' pill-content--controls' : ''}`}>
        <div
          className={`pill-task${isTaskVisible ? ' pill-task--visible' : ''}`}
          style={{ maxWidth: isTaskVisible ? taskMetrics.width : 0 }}
        >
          <span className="pill-task-text">{taskLabel}</span>
        </div>

        <div className="pill-dock">
          <div className={`pill-resting${showControls ? ' pill-resting--hidden' : ''}`}>
            {dndActive && (
              <span className="pill-dnd" title="Do Not Disturb is on" aria-label="Do Not Disturb is on">
                <BellOff style={{ width: 11, height: 11 }} />
              </span>
            )}

            <span className="pill-timer" style={{ color: timerColor }}>
              {formatTime(time)}
            </span>

            <span
              className="pill-help electron-no-drag"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setShowHelpHint(true)}
              onMouseLeave={() => setShowHelpHint(false)}
            >
              <button
                type="button"
                className="pill-help-btn"
                title="Compact mode help"
                aria-label="Compact mode help"
                tabIndex={-1}
              >
                <Info style={{ width: 16, height: 16 }} />
              </button>
            </span>
          </div>

          <div
            className={`pill-controls electron-no-drag${showControls ? ' pill-controls--visible' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pill-controls-inner">
              <button
                className="pill-btn"
                onClick={ctrl(isRunning ? onPause : onPlay)}
                title={isRunning ? 'Pause' : 'Resume'}
                style={isRunning ? { background: 'var(--pause-bg)', color: 'var(--pause-fg)' } : undefined}
              >
                {isRunning
                  ? <Pause  style={{ width: 14, height: 14 }} />
                  : <Play   style={{ width: 14, height: 14 }} />}
              </button>

              <button
                className="pill-btn"
                onClick={ctrl(onStop)}
                title="Stop &amp; Save"
                disabled={!task || !task.trim()}
              >
                <Square style={{ width: 14, height: 14 }} />
              </button>

              <button
                className="pill-btn pill-btn--notepad"
                onClick={ctrl(onOpenDistractionJar)}
                title="Open Parking Lot"
              >
                <ClipboardList style={{ width: 14, height: 14 }} />
                {thoughtCount > 0 && (
                  <span className="pill-badge">{thoughtCount}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {showHelpHint && !showControls && (
          <span className="pill-help-hint">
            Single click for controls. Double-click for fullscreen.
          </span>
        )}
      </div>

      <div className="pill-task-measure" aria-hidden="true">
        <span ref={taskMeasureInlineRef} className="pill-task-text pill-task-text--measure-inline" />
        <span ref={taskMeasureBlockRef} className="pill-task-text pill-task-text--measure-block" />
      </div>

    </div>
  );
}
