import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Square, ClipboardList, BellOff, Info } from 'lucide-react';
import { formatTime } from '../utils/time';

// ---------------------------------------------------------------------------
// Pill width constants (px)
// ---------------------------------------------------------------------------
const H_MARGIN   = 0;   // no extra side margin; window matches visible pill
const PILL_PAD   = 40;  // 20px left + 20px right padding
const PILL_BASE_H = 72;
const PILL_MAX_H = 260;
const TIMER_W    = 56;  // "MM:SS" in ui-monospace bold ~56px (conservative)
const INFO_W     = 24;  // info icon + spacing
const TASK_PAD_R = 8;   // padding-right on .pill-task-text
const CTRL_W     = 90;  // 8px pad + 3×26px btns + 2×2px gaps = 90px

const TASK_MIN_W = 120;
const TASK_MAX_W = 260; // max task width before wrapping
const TASK_LINE_H = 15;
const TASK_V_PAD  = 26;
const CHECKIN_POPUP_MIN_W = 360;
const CHECKIN_POPUP_EXTRA_H = 104;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function CompactMode({
  task,
  isRunning,
  time,
  showTaskByDefault = true,
  onDoubleClick,
  onOpenDistractionJar,
  thoughtCount = 0,
  onPlay,
  onPause,
  onStop,
  pulseEnabled = true,
  dndActive = false,
  checkInState = 'idle',
}) {
  const [isHovered, setIsHovered]       = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [shouldPulse, setShouldPulse]   = useState(false);
  const [showHelpHint, setShowHelpHint] = useState(false);
  const [taskMetrics, setTaskMetrics]   = useState({ width: TASK_MIN_W, height: PILL_BASE_H });

  const clickTimerRef    = useRef(null);
  const controlsHideRef  = useRef(null);
  const pulseResetTimeoutRef = useRef(null);
  const dragMoveHandlerRef = useRef(null);
  const dragUpHandlerRef = useRef(null);
  const dragBlurHandlerRef = useRef(null);
  const hasInitialized   = useRef(false);
  const isDraggingRef    = useRef(false);

  const taskLabel = task || '';
  const isTaskVisible = isHovered || showTaskByDefault;

  useEffect(() => {
    const label = (taskLabel || '').trim();
    if (!isTaskVisible || !label) {
      setTaskMetrics({ width: TASK_MIN_W, height: PILL_BASE_H });
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const bodyFont = window.getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    const font = `500 13px ${bodyFont}`;
    let measuredTextWidth = TASK_MIN_W;
    if (ctx) {
      ctx.font = font;
      measuredTextWidth = Math.ceil(ctx.measureText(label).width);
    }

    const taskWidth = clamp(measuredTextWidth, TASK_MIN_W, TASK_MAX_W);
    const lines = Math.max(1, Math.ceil(measuredTextWidth / taskWidth));
    const neededHeight = Math.ceil(lines * TASK_LINE_H + TASK_V_PAD);
    const taskHeight = clamp(Math.max(PILL_BASE_H, neededHeight), PILL_BASE_H, PILL_MAX_H);

    setTaskMetrics({ width: taskWidth, height: taskHeight });
  }, [isTaskVisible, taskLabel]);

  // Pre-calculate target window widths
  const basePillW = useMemo(
    () => PILL_PAD + TIMER_W + INFO_W,
    [],
  );
  const checkInPromptActive = checkInState === 'prompting';
  const baseWinW = useMemo(() => {
    const baseWidth = basePillW + H_MARGIN;
    return checkInPromptActive ? Math.max(baseWidth, CHECKIN_POPUP_MIN_W) : baseWidth;
  }, [basePillW, checkInPromptActive]);
  const hoverWinW  = useMemo(
    () => {
      const hoverWidth = basePillW + TASK_PAD_R + taskMetrics.width + H_MARGIN;
      return checkInPromptActive ? Math.max(hoverWidth, CHECKIN_POPUP_MIN_W) : hoverWidth;
    },
    [basePillW, taskMetrics.width, checkInPromptActive],
  );
  const ctrlWinW   = useMemo(() => hoverWinW + CTRL_W, [hoverWinW]);
  const pillH = useMemo(
    () => (isTaskVisible ? taskMetrics.height : PILL_BASE_H),
    [isTaskVisible, taskMetrics.height],
  );
  const winH = useMemo(
    () => (checkInPromptActive ? Math.max(pillH + CHECKIN_POPUP_EXTRA_H, PILL_BASE_H + CHECKIN_POPUP_EXTRA_H) : pillH),
    [checkInPromptActive, pillH],
  );

  // ---------------------------------------------------------------------------
  // Sync window size with pill state via IPC
  //   Expanding: resize window first, then CSS transition fills it in (~200ms)
  //   Shrinking: CSS transition first, then resize window after (~210ms delay)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!window.electronAPI?.setPillWidth && !window.electronAPI?.setPillSize) return;

    const pushPillSize = (width, height) => {
      if (window.electronAPI?.setPillSize) {
        window.electronAPI.setPillSize({ width, height });
      } else {
        window.electronAPI.setPillWidth(width);
      }
    };

    // Initial mount — set immediately without shrink delay
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      pushPillSize(baseWinW, winH);
      return;
    }

    if (showControls) {
      pushPillSize(ctrlWinW, winH);
    } else if (isTaskVisible) {
      pushPillSize(hoverWinW, winH);
    } else {
      // Shrinking: wait for CSS transition to finish before resizing
      const t = setTimeout(() => {
        pushPillSize(baseWinW, winH);
      }, 210);
      return () => clearTimeout(t);
    }
  }, [isTaskVisible, showControls, hoverWinW, ctrlWinW, baseWinW, winH]);

  // ---------------------------------------------------------------------------
  // Pulse animation — pauses when hovered
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!pulseEnabled || dndActive || isHovered) return;
    const interval = setInterval(() => {
      setShouldPulse(true);
      if (pulseResetTimeoutRef.current) clearTimeout(pulseResetTimeoutRef.current);
      pulseResetTimeoutRef.current = setTimeout(() => {
        setShouldPulse(false);
        pulseResetTimeoutRef.current = null;
      }, 3000);
    }, 60000);
    return () => {
      clearInterval(interval);
      if (pulseResetTimeoutRef.current) {
        clearTimeout(pulseResetTimeoutRef.current);
        pulseResetTimeoutRef.current = null;
      }
    };
  }, [pulseEnabled, dndActive, isHovered]);

  useEffect(() => () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    if (controlsHideRef.current) clearTimeout(controlsHideRef.current);
    if (pulseResetTimeoutRef.current) clearTimeout(pulseResetTimeoutRef.current);
    if (dragMoveHandlerRef.current) document.removeEventListener('mousemove', dragMoveHandlerRef.current);
    if (dragUpHandlerRef.current) document.removeEventListener('mouseup', dragUpHandlerRef.current);
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
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;           // left button only
    if (e.target.closest('button')) return; // let button clicks through

    if (dragMoveHandlerRef.current) document.removeEventListener('mousemove', dragMoveHandlerRef.current);
    if (dragUpHandlerRef.current) document.removeEventListener('mouseup', dragUpHandlerRef.current);
    if (dragBlurHandlerRef.current) window.removeEventListener('blur', dragBlurHandlerRef.current);
    dragMoveHandlerRef.current = null;
    dragUpHandlerRef.current = null;
    dragBlurHandlerRef.current = null;

    const startX = e.screenX;
    const startY = e.screenY;
    let started = false;

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
      if (started) window.electronAPI.pillDragEnd();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
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
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onUp);
  };

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
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

  const timerColor = isRunning ? 'var(--timer-running)' : 'var(--text-secondary)';
  const pillGlowStyle = checkInPromptActive
    ? { boxShadow: '0 0 0 2px rgba(217, 119, 6, 0.35), var(--shadow-minimal)', borderColor: '#D97706' }
    : undefined;
  const pillStyle = { height: pillH, ...(pillGlowStyle || {}) };

  return (
    <div
      className={`pill pill--logo${shouldPulse && pulseEnabled && !dndActive && !isHovered ? ' animate-pulse-compact' : ''}`}
      style={pillStyle}
      onMouseDown={handleMouseDown}
      onDragStart={(e) => e.preventDefault()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handlePillClick}
      onDoubleClick={handlePillDoubleClick}
    >
      {/* Task text — fades/slides in on hover */}
      <div
        className={`pill-task${isTaskVisible ? ' pill-task--visible' : ''}`}
        style={{ maxWidth: isTaskVisible ? taskMetrics.width : 0 }}
      >
        <span className="pill-task-text">{taskLabel}</span>
      </div>

      {/* Timer */}
      <div className="pill-core">
        <span className="pill-timer" style={{ color: timerColor }}>
          {formatTime(time)}
        </span>
      </div>

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
      {showHelpHint && (
        <span className="pill-help-hint">
          Single click to see pause/play controls. Double click to enter fullscreen mode.
        </span>
      )}

      {/* DND indicator */}
      {dndActive && (
        <span style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.45, marginLeft: 2 }}>
          <BellOff style={{ width: 11, height: 11, color: 'var(--compact-text)' }} />
        </span>
      )}

      {/* Controls — fade/slide in on single click, auto-hide after 3s */}
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
  );
}
