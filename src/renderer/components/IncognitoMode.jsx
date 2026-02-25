import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Brain, Play, Pause, Square, ClipboardList } from 'lucide-react';
import { formatTime } from '../utils/time';

// ---------------------------------------------------------------------------
// Pill width constants (px)
// ---------------------------------------------------------------------------
const H_MARGIN   = 12;  // 6px transparent drag area on each side of pill
const PILL_PAD   = 32;  // 16px left + 16px right padding inside pill
const BRAIN_W    = 16;  // brain icon width
const GAP1       = 6;   // gap between brain icon and timer
const TIMER_W    = 56;  // "MM:SS" in ui-monospace bold ~56px (conservative)
const TASK_PAD_R = 8;   // padding-right on .pill-task-text
const CTRL_W     = 90;  // 8px pad + 3×26px btns + 2×2px gaps = 90px

const DEFAULT_PILL_W = PILL_PAD + BRAIN_W + GAP1 + TIMER_W; // 110
const DEFAULT_WIN_W  = DEFAULT_PILL_W + H_MARGIN;             // 122

// Measure text width using canvas (matches .pill-task-text styles)
function measureText(text) {
  if (!text) return 0;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '500 13px Inter, -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", sans-serif';
    return Math.ceil(ctx.measureText(text).width);
  } catch {
    return text.length * 7.5; // fallback estimate
  }
}

export default function IncognitoMode({
  task,
  isRunning,
  time,
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

  const clickTimerRef    = useRef(null);
  const controlsHideRef  = useRef(null);
  const hasInitialized   = useRef(false);
  const isDraggingRef    = useRef(false);

  // Truncate task at 25 chars
  const taskLabel = task && task.length > 25 ? task.slice(0, 25) + '\u2026' : task;

  // Pre-calculate target window widths
  const taskTextW  = useMemo(() => measureText(taskLabel), [taskLabel]);
  const hoverWinW  = useMemo(
    () => DEFAULT_PILL_W + TASK_PAD_R + taskTextW + H_MARGIN,
    [taskTextW],
  );
  const ctrlWinW   = useMemo(() => hoverWinW + CTRL_W, [hoverWinW]);

  // ---------------------------------------------------------------------------
  // Sync window width with pill state via IPC
  //   Expanding: resize window first, then CSS transition fills it in (~200ms)
  //   Shrinking: CSS transition first, then resize window after (~210ms delay)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!window.electronAPI?.setPillWidth) return;

    // Initial mount — set immediately without shrink delay
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      window.electronAPI.setPillWidth(DEFAULT_WIN_W);
      return;
    }

    if (showControls) {
      window.electronAPI.setPillWidth(ctrlWinW);
    } else if (isHovered) {
      window.electronAPI.setPillWidth(hoverWinW);
    } else {
      // Shrinking: wait for CSS transition to finish before resizing
      const t = setTimeout(() => {
        window.electronAPI.setPillWidth(DEFAULT_WIN_W);
      }, 210);
      return () => clearTimeout(t);
    }
  }, [isHovered, showControls, hoverWinW, ctrlWinW]);

  // ---------------------------------------------------------------------------
  // Pulse animation — pauses when hovered
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!pulseEnabled || isHovered) return;
    const interval = setInterval(() => {
      setShouldPulse(true);
      setTimeout(() => setShouldPulse(false), 3000);
    }, 8000);
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
    console.log('[Pill] mouseenter');
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    console.log('[Pill] mouseleave');
    setIsHovered(false);
  };

  // Single click — debounced 220ms to avoid collision with double-click
  const handlePillClick = (e) => {
    if (isDraggingRef.current) return; // suppress click that follows a drag
    console.log('[Pill] click');
    e.stopPropagation();
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      console.log('[Pill] single-click confirmed → showControls');
      setShowControls(true);
      resetControlsTimer();
    }, 220);
  };

  // Double click — cancel pending single-click, exit compact mode
  const handlePillDoubleClick = (e) => {
    if (isDraggingRef.current) return; // suppress dblclick that follows a drag
    console.log('[Pill] dblclick → onDoubleClick()');
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

  const timerColor = isRunning ? '#D97706' : '#8B6F47';
  const iconColor  = isRunning ? '#D97706' : '#8B6F47';

  return (
    <div
      className={`pill${shouldPulse && pulseEnabled && !isHovered ? ' animate-pulse-incognito' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handlePillClick}
      onDoubleClick={handlePillDoubleClick}
    >
      {/* Task text — fades/slides in on hover */}
      <div className={`pill-task${isHovered ? ' pill-task--visible' : ''}`}>
        <span className="pill-task-text">{taskLabel}</span>
      </div>

      {/* Brain icon + timer — always visible */}
      <div className="pill-core">
        <Brain style={{ width: 16, height: 16, color: iconColor, flexShrink: 0, transition: 'color 0.2s' }} />
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
