import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Button } from './ui/Button';

const BREAK_PRESETS = [5, 15, 25];

export default function PostSessionPrompt({
  isOpen,
  taskName = '',
  selectedBreakMinutes = BREAK_PRESETS[0],
  onBreakMinutesChange,
  onTakeBreak,
  onStartAnotherSession,
  onDoneForNow,
}) {
  const safeTaskName = typeof taskName === 'string' ? taskName.trim() : '';

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--brand-action)',
          maxWidth: '30rem',
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
                  onClick={() => onBreakMinutesChange?.(minutes)}
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

          <div style={{ display: 'grid', gap: '0.7rem' }}>
            <Button
              type="button"
              onClick={onTakeBreak}
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
              Take a break
            </Button>
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
