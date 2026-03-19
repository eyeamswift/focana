import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { AlarmClock, Plus, Pause, X } from 'lucide-react';

export default function TimeUpModal({
  isOpen,
  taskName,
  onKeepGoing,
  onEndSession,
  onResumeLater,
}) {
  const [extraMinutes, setExtraMinutes] = useState('5');

  useEffect(() => {
    if (isOpen) {
      setExtraMinutes('5');
    }
  }, [isOpen]);

  const handleKeepGoing = () => {
    const parsed = parseInt(extraMinutes, 10);
    const safeMinutes = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 240) : 5;
    onKeepGoing(safeMinutes);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (open) return;
      onEndSession();
    }}>
      <DialogContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)', maxWidth: '30rem' }}>
        <button className="dialog-close-btn" onClick={onEndSession} aria-label="Close">
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
            <AlarmClock style={{ width: 20, height: 20, color: 'var(--brand-action)' }} />
          </div>
          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Time is up
          </DialogTitle>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            "{taskName || 'Untitled task'}"
          </p>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            Keep going? How much more time do you want?
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Input
              type="number"
              min="1"
              max="240"
              value={extraMinutes}
              onChange={(e) => setExtraMinutes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleKeepGoing();
                }
              }}
              style={{
                width: '6rem',
                textAlign: 'center',
                borderColor: 'var(--border-strong)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>minutes</span>
          </div>
        </div>

        <DialogFooter>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onEndSession}
                variant="outline"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
              >
                End Session
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Save this session and close the timer</p></TooltipContent>
          </Tooltip>

          {onResumeLater && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onResumeLater}
                  variant="outline"
                  style={{ borderColor: 'var(--brand-action)', color: 'var(--text-primary)' }}
                >
                  <Pause style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
                  Resume Later
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Take a break — your task stays ready</p></TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleKeepGoing} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
                <Plus style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
                Keep Going
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Add more time and continue this session</p></TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
