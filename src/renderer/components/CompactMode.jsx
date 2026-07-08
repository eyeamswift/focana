import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUpRight, Play, Pause, Check, ClipboardList, BellOff, Info, ListPlus } from 'lucide-react';
import { formatTime } from '../utils/time';
import { Checkbox } from './ui/Checkbox';
import ReentryPrompt from './ReentryPrompt';
import AddTimeControl from './AddTimeControl';
import LongSessionNudge from './LongSessionNudge';

// ---------------------------------------------------------------------------
// Pill width constants (px)
// ---------------------------------------------------------------------------
const H_MARGIN   = 4;   // account for the stronger 2px pill frame on both sides
const PILL_PAD   = 40;  // 20px left + 20px right padding
const PILL_BASE_H = 72;
const PILL_MAX_H = 260;
const DOCK_W     = 154; // fixed right dock for timer/info or controls
const TASK_DOCK_GAP = 8;

const TASK_MIN_W = 64;
const TASK_MAX_W = 220; // max task width before wrapping
const PLAN_PREVIEW_W = 360;
const PLAN_PREVIEW_H = 320;
const PLAN_PREVIEW_LIMIT = 3;
const CHECKIN_POPUP_MIN_W = 420;
const CHECKIN_POPUP_EXTRA_H = 148;
const LONG_SESSION_POPUP_MIN_W = 420;
const LONG_SESSION_POPUP_EXTRA_H = 232;
const REENTRY_PROMPT_SIZES = {
  'task-entry': { width: 440, height: 370 },
  'resume-choice': { width: 440, height: 286 },
  'save-for-later': { width: 440, height: 560 },
  'start-chooser': { width: 440, height: 500 },
  'snooze-options': { width: 440, height: 428 },
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
  taskPlanSummary = '',
  taskPlanDetails = [],
  isRunning,
  time,
  pulseSignal = 0,
  successCueSignal = 0,
  onDoubleClick,
  onEditTaskPlan,
  onSubtaskToggle,
  onSubtaskFocus,
  onNextTaskToggle,
  onOpenDistractionJar,
  thoughtCount = 0,
  onPlay,
  onPause,
  onComplete,
  canAddTime = false,
  onAddTime,
  longSessionNudgeVisible = false,
  onLongSessionTakeBreak,
  onLongSessionKeepGoing,
  onLongSessionSnooze,
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
  reentryBreakReturnAvailable = false,
  onReentryTaskTextChange,
  onReentryMinutesChange,
  onReentryStageChange,
  onReentryStartSession,
  onReentrySaveForLaterFromResume,
  onReentryCompleteFromResume,
  onReentryOpenParkingLot,
  onReentryOpenSessionHistory,
  onReentrySnooze,
  onReentryBackToBreakMode,
  onReentryInteraction,
}) {
  const [showControls, setShowControls] = useState(false);
  const [shouldPulse, setShouldPulse]   = useState(false);
  const [showSuccessCue, setShowSuccessCue] = useState(false);
  const [successCueBurstId, setSuccessCueBurstId] = useState(0);
  const [showHelpHint, setShowHelpHint] = useState(false);
  const [showPlanPreview, setShowPlanPreview] = useState(false);
  const [planPreviewExpanded, setPlanPreviewExpanded] = useState(false);
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
  const safeTaskPlanSummary = typeof taskPlanSummary === 'string' ? taskPlanSummary.trim() : '';
  const safeTaskPlanDetails = Array.isArray(taskPlanDetails)
    ? taskPlanDetails.filter((item) => typeof item?.label === 'string' && item.label.trim())
    : [];
  const safeSubtaskDetails = safeTaskPlanDetails.filter((item) => item.type === 'subtask');
  const safeNextTaskDetails = safeTaskPlanDetails.filter((item) => item.type === 'next');
  const hasTaskPlanDetails = safeSubtaskDetails.length > 0 || safeNextTaskDetails.length > 0;
  const activePreviewSubtasks = safeSubtaskDetails.filter((item) => item.completed !== true);
  const activePreviewNextTasks = safeNextTaskDetails.filter((item) => item.completed !== true);
  const hiddenCompletedPreviewCount = safeTaskPlanDetails.filter((item) => item.completed === true).length;
  const visiblePreviewSubtasks = planPreviewExpanded ? safeSubtaskDetails : activePreviewSubtasks;
  const visiblePreviewNextTasks = planPreviewExpanded ? safeNextTaskDetails : activePreviewNextTasks;
  const planPreviewHasOverflow = visiblePreviewSubtasks.length > PLAN_PREVIEW_LIMIT || visiblePreviewNextTasks.length > PLAN_PREVIEW_LIMIT;
  const planPreviewCanExpand = planPreviewHasOverflow || hiddenCompletedPreviewCount > 0 || planPreviewExpanded;
  const planPreviewItemCount = safeSubtaskDetails.length + safeNextTaskDetails.length;
  const planPreviewToggleLabel = planPreviewExpanded
    ? 'Show less'
    : hiddenCompletedPreviewCount > 0
      ? `Show completed (${hiddenCompletedPreviewCount})`
      : `View all (${planPreviewItemCount})`;
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
  const planPreviewActive = showPlanPreview && hasTaskPlanDetails && !showControls && !checkInPromptActive;
  const reentryPromptActive = reentryPromptVisible === true;
  const activeReentryPromptSize = useMemo(
    () => REENTRY_PROMPT_SIZES[reentryPromptStage] || REENTRY_PROMPT_SIZES['task-entry'],
    [reentryPromptStage],
  );
  const baseWinW = useMemo(() => {
    const baseWidth = basePillW + H_MARGIN;
    if (checkInPromptActive) return Math.max(baseWidth, CHECKIN_POPUP_MIN_W);
    if (longSessionNudgeVisible) return Math.max(baseWidth, LONG_SESSION_POPUP_MIN_W);
    return baseWidth;
  }, [basePillW, checkInPromptActive, longSessionNudgeVisible]);
  const visibleTaskWidth = useMemo(
    () => (isTaskVisible ? taskMetrics.width + TASK_DOCK_GAP : 0),
    [isTaskVisible, taskMetrics.width],
  );
  const restWinW  = useMemo(
    () => {
      const restingWidth = basePillW + visibleTaskWidth + H_MARGIN;
      if (checkInPromptActive) return Math.max(restingWidth, CHECKIN_POPUP_MIN_W);
      if (longSessionNudgeVisible) return Math.max(restingWidth, LONG_SESSION_POPUP_MIN_W);
      return restingWidth;
    },
    [basePillW, visibleTaskWidth, checkInPromptActive, longSessionNudgeVisible],
  );
  const settledWinW = useMemo(
    () => {
      if (reentryPromptActive) return activeReentryPromptSize.width;
      const compactWidth = isTaskVisible ? restWinW : baseWinW;
      return planPreviewActive ? Math.max(compactWidth, PLAN_PREVIEW_W) : compactWidth;
    },
    [activeReentryPromptSize.width, baseWinW, isTaskVisible, planPreviewActive, reentryPromptActive, restWinW],
  );
  const pillH = useMemo(
    () => (isTaskVisible ? taskMetrics.height : PILL_BASE_H),
    [isTaskVisible, taskMetrics.height],
  );
  const winH = useMemo(
    () => {
      if (reentryPromptActive) return activeReentryPromptSize.height;
      if (checkInPromptActive) return Math.max(pillH + CHECKIN_POPUP_EXTRA_H, PILL_BASE_H + CHECKIN_POPUP_EXTRA_H);
      if (longSessionNudgeVisible) return Math.max(pillH + LONG_SESSION_POPUP_EXTRA_H, PILL_BASE_H + LONG_SESSION_POPUP_EXTRA_H);
      return planPreviewActive ? Math.max(pillH + PLAN_PREVIEW_H, PILL_BASE_H + PLAN_PREVIEW_H) : pillH;
    },
    [activeReentryPromptSize.height, checkInPromptActive, longSessionNudgeVisible, pillH, planPreviewActive, reentryPromptActive],
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
      setShowPlanPreview(false);
      window.electronAPI.beginCompactTransient('compact-controls');
      return undefined;
    }

    window.electronAPI.endCompactTransient('compact-controls', 210);
    return undefined;
  }, [showControls]);

  useEffect(() => {
    if (!hasTaskPlanDetails) {
      setShowPlanPreview(false);
    }
  }, [hasTaskPlanDetails]);

  useEffect(() => {
    if (!window.electronAPI?.beginCompactTransient || !window.electronAPI?.endCompactTransient) return undefined;

    if (planPreviewActive) {
      window.electronAPI.beginCompactTransient('compact-plan-preview');
      return () => {
        window.electronAPI.endCompactTransient('compact-plan-preview', 180);
      };
    }

    window.electronAPI.endCompactTransient('compact-plan-preview', 180);
    return undefined;
  }, [planPreviewActive]);

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
      pushPillSize(settledWinW, winH);
    } else {
      // Shrinking: wait for CSS transition to finish before resizing
      const t = setTimeout(() => {
        pushPillSize(baseWinW, winH);
      }, 210);
      return () => clearTimeout(t);
    }
  }, [activeReentryPromptSize.height, activeReentryPromptSize.width, baseWinW, isTaskVisible, reentryPromptActive, settledWinW, winH]);

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
    window.electronAPI?.endCompactTransient?.('compact-plan-preview', 0);
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
    if (e.target.closest('button, input, textarea, select, label, [role="button"], .electron-no-drag')) return;

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

  const handlePillClick = (e) => {
    if (isDraggingRef.current) return;
    e.stopPropagation();
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

  const showPlanPreviewIfAvailable = () => {
    if (!hasTaskPlanDetails) return;
    setShowControls(false);
    setShowPlanPreview(true);
  };

  const hidePlanPreview = () => {
    setShowPlanPreview(false);
    setPlanPreviewExpanded(false);
  };

  const handleTaskPlanClick = (event) => {
    if (isDraggingRef.current || !hasTaskPlanDetails) return;
    event.stopPropagation();
    setShowControls(false);
    setShowPlanPreview((prev) => !prev);
  };

  const handleTaskPlanPointerUp = (event) => {
    if (typeof event.button === 'number' && event.button > 0) return;
    handleTaskPlanClick(event);
  };

  const handleTaskPlanKeyDown = (event) => {
    if (!hasTaskPlanDetails || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    setShowControls(false);
    setShowPlanPreview((prev) => !prev);
  };

  const handleTimerClick = (event) => {
    if (isDraggingRef.current) return;
    event.stopPropagation();
    hidePlanPreview();
    setShowControls(true);
    resetControlsTimer();
  };

  const handleTimerPointerUp = (event) => {
    if (typeof event.button === 'number' && event.button > 0) return;
    handleTimerClick(event);
  };

  const stopPillDragStart = (event) => {
    event.stopPropagation();
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
          breakModeAvailable={reentryBreakReturnAvailable}
          onTaskTextChange={onReentryTaskTextChange}
          onMinutesChange={onReentryMinutesChange}
          onStageChange={onReentryStageChange}
          onStartSession={onReentryStartSession}
          onSaveForLaterFromResume={onReentrySaveForLaterFromResume}
          onCompleteFromResume={onReentryCompleteFromResume}
          onOpenParkingLot={onReentryOpenParkingLot}
          onOpenSessionHistory={onReentryOpenSessionHistory}
          onSnooze={onReentrySnooze}
          onBackToBreakMode={onReentryBackToBreakMode}
          onInteraction={onReentryInteraction}
        />
      </div>
    );
  }

  return (
    <div
      className={`pill pill--logo${planPreviewActive ? ' pill--plan-preview' : ''}${isPulseAnimating ? ' animate-pulse-compact pill--pulse-active' : ''}`}
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

      <div
        className={`pill-content${isPulseAnimating ? ' pill-content--pulse' : ''}${showControls ? ' pill-content--controls' : ''}`}
        onDoubleClick={handlePillDoubleClick}
      >
        <div
          className={`pill-task${isTaskVisible ? ' pill-task--visible' : ''}${hasTaskPlanDetails ? ' electron-no-drag' : ''}`}
          style={{ maxWidth: isTaskVisible ? taskMetrics.width : 0 }}
          tabIndex={hasTaskPlanDetails ? 0 : -1}
          role={hasTaskPlanDetails ? 'button' : undefined}
          aria-label={hasTaskPlanDetails ? (planPreviewActive ? 'Hide task plan' : 'Show task plan') : undefined}
          aria-expanded={hasTaskPlanDetails ? planPreviewActive : undefined}
          aria-describedby={planPreviewActive ? 'pill-task-plan-preview' : undefined}
          onPointerDown={hasTaskPlanDetails ? stopPillDragStart : undefined}
          onPointerUp={handleTaskPlanPointerUp}
          onKeyDown={handleTaskPlanKeyDown}
        >
          <span className="pill-task-text">{taskLabel}</span>
          {safeTaskPlanSummary ? (
            <span className="pill-task-plan-summary">{safeTaskPlanSummary}</span>
          ) : null}
        </div>

        <div className="pill-dock">
          <div className={`pill-resting${showControls ? ' pill-resting--hidden' : ''}`}>
            {dndActive && (
              <span className="pill-dnd" title="Do Not Disturb is on" aria-label="Do Not Disturb is on">
                <BellOff style={{ width: 11, height: 11 }} />
              </span>
            )}

            <button
              type="button"
              className="pill-timer-button electron-no-drag"
              onPointerDown={stopPillDragStart}
              onClick={handleTimerClick}
              onPointerUp={handleTimerPointerUp}
              title="Show controls"
              aria-label="Show compact controls"
            >
              <span className="pill-timer" style={{ color: timerColor }}>
                {formatTime(time)}
              </span>
            </button>

            <span
              className="pill-help electron-no-drag"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={handlePillDoubleClick}
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
                onClick={ctrl(onComplete)}
                title="Complete"
                disabled={!task || !task.trim()}
              >
                <Check style={{ width: 14, height: 14 }} />
              </button>

              {canAddTime ? (
                <AddTimeControl
                  variant="compact"
                  onAddTime={(minutes) => {
                    onAddTime?.(minutes);
                    resetControlsTimer();
                  }}
                />
              ) : null}

              {typeof onEditTaskPlan === 'function' && hasTaskLabel ? (
                <button
                  className="pill-btn"
                  onClick={ctrl(onEditTaskPlan)}
                  title="Edit plan"
                  aria-label="Edit plan"
                >
                  <ListPlus style={{ width: 14, height: 14 }} />
                </button>
              ) : null}

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

      {longSessionNudgeVisible ? (
        <LongSessionNudge
          variant="compact"
          taskName={taskLabel}
          onTakeBreak={onLongSessionTakeBreak}
          onKeepGoing={onLongSessionKeepGoing}
          onSnooze={onLongSessionSnooze}
        />
      ) : null}

      {planPreviewActive ? (
        <div
          id="pill-task-plan-preview"
          className="pill-task-plan-preview electron-no-drag"
          data-testid="compact-task-plan-preview"
          role="tooltip"
          onMouseEnter={showPlanPreviewIfAvailable}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className={`pill-task-plan-preview__content${planPreviewCanExpand ? ' is-scrollable' : ''}${planPreviewCanExpand && planPreviewExpanded ? ' is-expanded' : ''}`}>
            {visiblePreviewSubtasks.length ? (
              <section className="pill-task-plan-preview__section" aria-label="Subtasks">
                <div className="pill-task-plan-preview__title">Subtasks</div>
                <ul className={`pill-task-plan-preview__list${visiblePreviewSubtasks.length > PLAN_PREVIEW_LIMIT ? ' is-scrollable' : ''}${planPreviewExpanded ? ' is-expanded' : ''}`}>
                  {visiblePreviewSubtasks.map((item) => {
                    const checkboxId = `compact-plan-subtask-${item.id}`;
                    const label = item.title || item.label;
                    const canFocusSubtask = typeof onSubtaskFocus === 'function' && item.completed !== true;
                    const isFocusedSubtask = item.active === true;
                    return (
                      <li
                        key={`subtask-${item.id}`}
                        className={`pill-task-plan-preview__row${canFocusSubtask ? ' pill-task-plan-preview__row--focusable' : ''}${item.completed ? ' is-complete' : ''}${isFocusedSubtask ? ' is-active-focus' : ''}`}
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={item.completed === true}
                          onCheckedChange={(checked) => onSubtaskToggle?.(item.id, checked)}
                          onClick={(event) => event.stopPropagation()}
                          className="pill-task-plan-preview__checkbox"
                          aria-label={item.title || item.label}
                          data-testid="compact-plan-subtask-checkbox"
                        />
                        <label htmlFor={checkboxId} className="pill-task-plan-preview__label">
                          {label}
                        </label>
                        {canFocusSubtask ? (
                          <button
                            type="button"
                            className="pill-task-plan-preview__focus-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSubtaskFocus?.(item.id);
                            }}
                            disabled={isFocusedSubtask}
                            aria-label={isFocusedSubtask ? `${label} is the visible focus` : `Focus ${label}`}
                            title={isFocusedSubtask ? 'Visible focus' : 'Focus this step'}
                            data-testid="compact-plan-subtask-focus"
                          >
                            <ArrowUpRight size={13} aria-hidden="true" />
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {visiblePreviewNextTasks.length ? (
              <section className="pill-task-plan-preview__section" aria-label="Next up">
                <div className="pill-task-plan-preview__title">Next up</div>
                <ul className={`pill-task-plan-preview__list${visiblePreviewNextTasks.length > PLAN_PREVIEW_LIMIT ? ' is-scrollable' : ''}${planPreviewExpanded ? ' is-expanded' : ''}`}>
                  {visiblePreviewNextTasks.map((item) => (
                    <li
                      key={`next-${item.id}`}
                      className={`pill-task-plan-preview__row pill-task-plan-preview__row--next${item.completed ? ' is-complete' : ''}`}
                    >
                      <Checkbox
                        id={`compact-plan-next-${item.id}`}
                        checked={item.completed === true}
                        onCheckedChange={(checked) => onNextTaskToggle?.(item.id, checked)}
                        onClick={(event) => event.stopPropagation()}
                        className="pill-task-plan-preview__checkbox"
                        aria-label={item.title || item.label.replace(/^Next:\s*/i, '')}
                        data-testid="compact-plan-next-checkbox"
                      />
                      <label htmlFor={`compact-plan-next-${item.id}`} className="pill-task-plan-preview__label">
                        {item.title || item.label.replace(/^Next:\s*/i, '')}
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          {planPreviewCanExpand ? (
            <button
              type="button"
              className="pill-task-plan-preview__view-all"
              onClick={(event) => {
                event.stopPropagation();
                setPlanPreviewExpanded((prev) => !prev);
              }}
              aria-expanded={planPreviewExpanded}
            >
              {planPreviewToggleLabel}
            </button>
          ) : null}
          {typeof onEditTaskPlan === 'function' ? (
            <button
              type="button"
              className="pill-task-plan-preview__edit"
              onClick={(event) => {
                event.stopPropagation();
                hidePlanPreview();
                onEditTaskPlan();
              }}
            >
              Edit plan
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="pill-task-measure" aria-hidden="true">
        <span ref={taskMeasureInlineRef} className="pill-task-text pill-task-text--measure-inline" />
        <span ref={taskMeasureBlockRef} className="pill-task-text pill-task-text--measure-block" />
      </div>

    </div>
  );
}
