import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CheckCircle2, CircleDot, X } from 'lucide-react';

export default function TaskCompletionModal({
  isOpen,
  taskName,
  sessionDuration = 0,
  onCompleted,
  onNotCompleted,
  onDismiss,
}) {
  const formatDuration = (minutes) => {
    if (minutes < 1) return 'less than a minute';
    return minutes === 1 ? '1 minute' : `${Math.round(minutes)} minutes`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onDismiss?.(); }}>
      <DialogContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)', maxWidth: '28rem' }}>
        <button className="dialog-close-btn" onClick={onDismiss} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>

        <DialogHeader style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
          <div style={{
            margin: '0 auto',
            width: '3rem',
            height: '3rem',
            background: 'var(--bg-card)',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            border: '1px solid var(--border-default)',
          }}>
            <CircleDot style={{ width: 20, height: 20, color: 'var(--brand-action)' }} />
          </div>

          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Did you finish?</DialogTitle>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            You spent {formatDuration(sessionDuration)} on "{taskName || 'Untitled task'}".
          </p>
        </DialogHeader>

        <DialogFooter style={{ justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onNotCompleted}
                variant="outline"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
              >
                No
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Add an optional note on where to pick up</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onCompleted} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
                <CheckCircle2 style={{ width: 16, height: 16, marginRight: '0.4rem' }} />
                Yes
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Save as completed and return home</p></TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
