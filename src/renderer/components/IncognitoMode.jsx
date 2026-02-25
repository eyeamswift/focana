import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Play, Pause, Square, ClipboardList } from 'lucide-react';
import { formatTime } from '../utils/time';

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
  const [isHovered, setIsHovered] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(false);

  useEffect(() => {
    if (pulseEnabled && !isHovered) {
      const interval = setInterval(() => {
        setShouldPulse(true);
        setTimeout(() => setShouldPulse(false), 3000);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [pulseEnabled, isHovered]);

  const getStatusText = () => (task && task.trim()) ? task : '';
  const taskColor = isRunning ? '#5C4033' : '#8B6F47';
  const timerColor = isRunning ? '#D97706' : '#8B6F47';

  return (
    <div
      className={`pill electron-draggable ${shouldPulse && pulseEnabled ? 'animate-pulse-incognito' : ''}`}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'default', pointerEvents: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', padding: '0.5rem 1rem' }}>
        {/* Draggable area */}
        <div
          className="pill-drag-area"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginRight: '0.75rem',
            gap: '1.5rem',
            position: 'relative',
            cursor: 'default',
            pointerEvents: 'auto',
          }}
        >
          {getStatusText() && (
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: taskColor,
                transition: 'color 0.3s',
                pointerEvents: 'none',
              }}
            >
              {getStatusText()}
            </span>
          )}

          <span
            style={{
              fontSize: '1.125rem',
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 700,
              color: timerColor,
              transition: 'color 0.3s',
              pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTime(time)}
          </span>

          <div className="pill-hover-overlay">
            <p style={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, letterSpacing: '0.025em', whiteSpace: 'nowrap' }}>
              Double-click to expand
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="electron-no-drag" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 10, flexShrink: 0 }}>
          <Button
            onClick={(e) => { e.stopPropagation(); isRunning ? onPause() : onPlay(); }}
            size="icon"
            variant="ghost"
            title={isRunning ? 'Pause Timer' : 'Resume Timer'}
            style={{ height: '1.75rem', width: '1.75rem', padding: 0, borderRadius: '9999px', color: '#8B6F47', cursor: 'pointer', pointerEvents: 'auto' }}
          >
            {isRunning ? <Pause style={{ width: 16, height: 16 }} /> : <Play style={{ width: 16, height: 16 }} />}
          </Button>

          <Button
            onClick={(e) => { e.stopPropagation(); onStop(); }}
            size="icon"
            variant="ghost"
            title="Stop & Save Session"
            disabled={!task.trim()}
            style={{ height: '1.75rem', width: '1.75rem', padding: 0, borderRadius: '9999px', color: '#8B6F47', cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <Square style={{ width: 16, height: 16 }} />
          </Button>

          <Button
            onClick={(e) => { e.stopPropagation(); onOpenDistractionJar(); }}
            size="icon"
            variant="ghost"
            title="Open Notepad"
            style={{ height: '1.75rem', width: '1.75rem', padding: 0, borderRadius: '9999px', color: '#8B6F47', cursor: 'pointer', pointerEvents: 'auto', position: 'relative', flexShrink: 0 }}
          >
            <ClipboardList style={{ width: 16, height: 16 }} />
            {thoughtCount > 0 && (
              <span className="badge">{thoughtCount}</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
