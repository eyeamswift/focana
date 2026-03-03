import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Square, ClipboardList } from 'lucide-react';
import { formatTime } from '../utils/time';

// ---------------------------------------------------------------------------
// Pill width constants (px)
// ---------------------------------------------------------------------------
const H_MARGIN   = 0;   // no extra side margin; window matches visible pill
const PILL_PAD   = 40;  // 20px left + 20px right padding
const PILL_BASE_H = 72;
const PILL_MAX_H = 260;
const TIMER_W    = 56;  // "MM:SS" in ui-monospace bold ~56px (conservative)
const TASK_PAD_R = 8;   // padding-right on .pill-task-text
const CTRL_W     = 90;  // 8px pad + 3×26px btns + 2×2px gaps = 90px

const TASK_MIN_W = 120;
const TASK_MAX_W = 260; // max task width before wrapping
const TASK_LINE_H = 15;
const TASK_V_PAD  = 26;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function IncognitoMode({
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
}) {
  const [isHovered, setIsHovered]       = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [shouldPulse, setShouldPulse]   = useState(false);
  const [taskMetrics, setTaskMetrics]   = useState({ width: TASK_MIN_W, height: PILL_BASE_H });

  const clickTimerRef    = useRef(null);
  const controlsHideRef  = useRef(null);
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
    () => PILL_PAD + TIMER_W,
    [],
  );
  const baseWinW = useMemo(() => basePillW + H_MARGIN, [basePillW]);
  const hoverWinW  = useMemo(
    () => basePillW + TASK_PAD_R + taskMetrics.width + H_MARGIN,
    [basePillW, taskMetrics.width],
  );
  const ctrlWinW   = useMemo(() => hoverWinW + CTRL_W, [hoverWinW]);
  const pillH = useMemo(
    () => (isTaskVisible ? taskMetrics.height : PILL_BASE_H),
    [isTaskVisible, taskMetrics.height],
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
      pushPillSize(baseWinW, pillH);
      return;
    }

    if (showControls) {
      pushPillSize(ctrlWinW, pillH);
    } else if (isTaskVisible) {
      pushPillSize(hoverWinW, pillH);
    } else {
      // Shrinking: wait for CSS transition to finish before resizing
      const t = setTimeout(() => {
        pushPillSize(baseWinW, pillH);
      }, 210);
      return () => clearTimeout(t);
    }
  }, [isTaskVisible, showControls, hoverWinW, ctrlWinW, baseWinW, pillH]);

  // ---------------------------------------------------------------------------
  // Pulse animation — pauses when hovered
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!pulseEnabled || isHovered) return;
    const interval = setInterval(() => {
      setShouldPulse(true);
      setTimeout(() => setShouldPulse(false), 3000);
    }, 60000);
    return () => clearInterval(interval);
  }, [pulseEnabled, isHovered]);

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
      // Reset after the click event has had a chance to fire (if any)
      setTimeout(() => { isDraggingRef.current = false; }, 0);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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
    fn();
    resetControlsTimer();
  };

  const timerColor = isRunning ? 'var(--timer-running)' : 'var(--text-secondary)';

  return (
    <div
      className={`pill pill--logo${shouldPulse && pulseEnabled && !isHovered ? ' animate-pulse-incognito' : ''}`}
      style={{ height: pillH }}
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
