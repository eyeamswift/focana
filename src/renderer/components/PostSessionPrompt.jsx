import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Button } from './ui/Button';

const BREAK_PRESETS = [5, 15, 25];

export default function PostSessionPrompt({
  isOpen,
  taskName = '',
  selectedBreakMinutes = null,
  hasBreakSelection = false,
  showTimerDuringBreak = false,
  onBreakMinutesChange,
  onBreakTimerVisibilityChange,
  onTakeBreak,
  onStartAnotherSession,
  onDoneForNow,
}) {
  const safeTaskName = typeof taskName === 'string' ? taskName.trim() : '';
  const [hasLocalBreakSelection, setHasLocalBreakSelection] = useState(false);
  const canTakeBreak = hasLocalBreakSelection && hasBreakSelection === true && BREAK_PRESETS.includes(selectedBreakMinutes);

  useEffect(() => {
    if (!isOpen) return;
    setHasLocalBreakSelection(false);
  }, [isOpen, taskName]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--brand-action)',
          maxWidth: '34rem',
          padding: '1.3rem 1.3rem 1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <DialogHeader style={{ textAlign: 'left' }}>
          <DialogTitle style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Session wrapped
          </DialogTitle>
          {safeTaskName ? (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.45 }}>
              {safeTaskName}
            </p>
          ) : null}
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(8.9rem, 9.5rem) minmax(0, 1fr)',
              gap: '0.75rem',
              alignItems: 'stretch',
            }}
          >
            <Button
              type="button"
              onClick={onTakeBreak}
              variant="outline"
              disabled={!canTakeBreak}
              style={{
                minHeight: '2.95rem',
                justifyContent: 'flex-start',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
                fontWeight: 700,
                opacity: canTakeBreak ? 1 : 0.6,
              }}
            >
              Take a break
            </Button>
            <div
              style={{
                minWidth: 0,
                borderRadius: '1rem',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                padding: '0.7rem 0.8rem',
                display: 'grid',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Break length
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.45rem',
                  }}
                >
                  {BREAK_PRESETS.map((minutes) => {
                    const isActive = selectedBreakMinutes === minutes;
                    return (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => {
                          setHasLocalBreakSelection(true);
                          onBreakMinutesChange?.(minutes);
                        }}
                        style={{
                          height: '2rem',
                          minWidth: '3.3rem',
                          borderRadius: '9999px',
                          border: `1px solid ${isActive ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                          background: isActive ? 'color-mix(in srgb, var(--brand-primary) 16%, var(--bg-card))' : 'var(--bg-card)',
                          color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {minutes}m
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Floating timer
                </div>
                <div
                  role="radiogroup"
                  aria-label="Floating timer visibility"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}
                >
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.38rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="post-session-break-timer"
                      checked={showTimerDuringBreak === true}
                      onChange={() => onBreakTimerVisibilityChange?.(true)}
                    />
                    Show
                  </label>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.38rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="post-session-break-timer"
                      checked={showTimerDuringBreak !== true}
                      onChange={() => onBreakTimerVisibilityChange?.(false)}
                    />
                    Hide
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.7rem' }}>
            <Button
              type="button"
              onClick={onStartAnotherSession}
              variant="outline"
              style={{
                minHeight: '3.35rem',
                justifyContent: 'flex-start',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
                fontWeight: 700,
              }}
            >
              Start another session
            </Button>
            <Button
              type="button"
              onClick={onDoneForNow}
              variant="outline"
              style={{
                minHeight: '3.35rem',
                justifyContent: 'flex-start',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
                fontWeight: 700,
              }}
            >
              Done for now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
