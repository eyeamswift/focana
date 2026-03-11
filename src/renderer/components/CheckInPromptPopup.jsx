import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from './ui/Button';

const COMPACT_BURST_COUNT = 3;
const COMPACT_INITIAL_DELAY_MS = 3000;
const COMPACT_BURST_BREAK_MS = 30000;
const COMPACT_PULSE_STEP_MS = 1000;
const COMPACT_PULSE_ACTIVE_MS = 650;
const COMPACT_PULSE_SEQUENCE = ['yes', 'no', 'yes', 'no'];
const COMPACT_BURST_DURATION_MS = ((COMPACT_PULSE_SEQUENCE.length - 1) * COMPACT_PULSE_STEP_MS) + COMPACT_PULSE_ACTIVE_MS;
const COMPACT_BURST_INTERVAL_MS = COMPACT_BURST_DURATION_MS + COMPACT_BURST_BREAK_MS;

export default function CheckInPromptPopup({
  isOpen,
  onFocused,
  onDetour,
  taskName = '',
  variant = 'full',
}) {
  const [activePulse, setActivePulse] = useState(null);
  const timeoutRefs = useRef([]);
  const isCompact = variant === 'compact';

  useEffect(() => {
    const clearPulseTimers = () => {
      timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutRefs.current = [];
      setActivePulse(null);
    };

    clearPulseTimers();

    if (!isOpen || !isCompact) {
      return undefined;
    }

    const schedule = (fn, delay) => {
      const timeoutId = setTimeout(fn, delay);
      timeoutRefs.current.push(timeoutId);
    };

    for (let burstIndex = 0; burstIndex < COMPACT_BURST_COUNT; burstIndex += 1) {
      const burstOffset = COMPACT_INITIAL_DELAY_MS + (burstIndex * COMPACT_BURST_INTERVAL_MS);

      COMPACT_PULSE_SEQUENCE.forEach((step, stepIndex) => {
        const stepOffset = burstOffset + (stepIndex * COMPACT_PULSE_STEP_MS);
        schedule(() => setActivePulse(step), stepOffset);
        schedule(() => setActivePulse((current) => (current === step ? null : current)), stepOffset + COMPACT_PULSE_ACTIVE_MS);
      });
    }

    return clearPulseTimers;
  }, [isCompact, isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;
  const trimmedTaskName = typeof taskName === 'string' ? taskName.trim() : '';

  return createPortal(
    <div className="checkin-popup-overlay electron-no-drag">
      <div className={`checkin-popup ${isCompact ? 'checkin-popup-compact' : 'checkin-popup-full'}`}>
        <h3 className="checkin-popup-title">
          Still focused on
          <span className="checkin-popup-task">{trimmedTaskName || 'this task'}?</span>
        </h3>
        <div className="checkin-popup-actions">
          <Button
            variant="outline"
            onClick={onFocused}
            className={`checkin-popup-btn${isCompact ? ' checkin-popup-btn--compact' : ''}${activePulse === 'yes' ? ' checkin-popup-btn--pulse-active checkin-popup-btn--pulse-yes' : ''}`}
            title="Still focused"
          >
            <ThumbsUp style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
            Yes
          </Button>
          <Button
            variant="outline"
            onClick={onDetour}
            className={`checkin-popup-btn${isCompact ? ' checkin-popup-btn--compact' : ''}${activePulse === 'no' ? ' checkin-popup-btn--pulse-active checkin-popup-btn--pulse-no' : ''}`}
            title="Not focused"
          >
            <ThumbsDown style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
            No
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
