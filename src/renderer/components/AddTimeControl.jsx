import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

const PRESETS = [5, 10, 25];

function clampMinutes(value) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(parsed, 1), 240);
}

export default function AddTimeControl({
  onAddTime,
  disabled = false,
  variant = 'full',
}) {
  const [open, setOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('5');
  const rootRef = useRef(null);
  const customInputRef = useRef(null);
  const safeVariant = variant === 'compact' ? 'compact' : 'full';

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const addMinutes = (minutes) => {
    const safeMinutes = clampMinutes(minutes);
    if (!safeMinutes) return;
    onAddTime?.(safeMinutes);
    setOpen(false);
  };

  const addCustom = () => {
    addMinutes(customMinutes);
  };

  return (
    <div ref={rootRef} className={`add-time-control add-time-control--${safeVariant}`}>
      <button
        type="button"
        className="add-time-control__trigger"
        aria-label="Add time"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={safeVariant === 'compact' ? 13 : 14} aria-hidden="true" />
        <span>Time</span>
      </button>
      {open ? (
        <div className="add-time-control__panel" role="menu" aria-label="Add time">
          <div className="add-time-control__presets">
            {PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="add-time-control__preset"
                onClick={() => addMinutes(minutes)}
              >
                +{minutes}
              </button>
            ))}
          </div>
          <div className="add-time-control__custom">
            <input
              ref={customInputRef}
              type="number"
              min="1"
              max="240"
              step="1"
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addCustom();
              }}
              aria-label="Custom minutes"
            />
            <button type="button" onClick={addCustom}>
              Add
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
