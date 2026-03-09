import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { ArrowRight, Copy, NotebookPen, Trash2, X } from 'lucide-react';

export default function PostSessionParkingLotModal({
  isOpen,
  thoughts,
  onDone,
  onDismissThought,
  onKeepThoughtForLater,
  onCopyThought,
  onStartThoughtAsNextTask,
  onCopyAll,
  onClearAll,
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onDone?.(); }}>
      <DialogContent style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--brand-action)',
        maxWidth: '34rem',
        maxHeight: 'min(calc(100vh - 2rem), 760px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <button className="dialog-close-btn" onClick={() => onDone?.()} aria-label="Close post-session parking lot">
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <NotebookPen style={{ width: 24, height: 24, color: 'var(--brand-action)' }} />
            These came up while you were in the zone
          </DialogTitle>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
            Decide what to keep, clear, or turn into your next task.
          </p>
        </DialogHeader>

        <div style={{ padding: '1rem 0', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {thoughts.map((thought) => (
            <div
              key={thought.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                padding: '0.85rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-default)',
              }}
            >
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {thought.text}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <Button
                  onClick={() => onDismissThought?.(thought.id)}
                  variant="outline"
                  style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
                >
                  <Trash2 style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
                  Dismiss
                </Button>
                <Button
                  onClick={() => onKeepThoughtForLater?.(thought.id)}
                  variant="outline"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                >
                  Keep for later
                </Button>
                <Button
                  onClick={() => onCopyThought?.(thought.id)}
                  variant="outline"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
                >
                  <Copy style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
                  Copy
                </Button>
                <Button
                  onClick={() => onStartThoughtAsNextTask?.(thought.id)}
                  style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}
                >
                  <ArrowRight style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
                  Start as next task
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="dialog-footer-between" style={{
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={onCopyAll}>
                  <Copy style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
                  Copy all
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Copy all visible items</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onClearAll}
                  style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
                >
                  <Trash2 style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
                  Clear all
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Dismiss all visible items</p></TooltipContent>
            </Tooltip>
          </div>
          <Button onClick={onDone} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
