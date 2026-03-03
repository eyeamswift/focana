import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { X } from 'lucide-react';

export default function StartSessionModal({ isOpen, onClose, task, onStart }) {
  const [minutes, setMinutes] = useState('25');

  const handleStart = (selectedMode) => {
    if (selectedMode === 'freeflow') {
      onStart('freeflow', 0);
    } else {
      const numMinutes = parseInt(minutes);
      if (numMinutes >= 1 && numMinutes <= 240) {
        onStart('timed', numMinutes);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ background: 'var(--bg-card)', borderColor: 'var(--brand-action)', maxWidth: '24rem' }}>
        <button className="dialog-close-btn" onClick={onClose} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Ready to focus on:
          </DialogTitle>
          <p style={{ color: 'var(--brand-action)', fontWeight: 600, padding: '0 1rem', wordBreak: 'break-word' }}>
            "{task}"
          </p>
        </DialogHeader>

        <div className="space-y-3" style={{ padding: '1rem 0' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => handleStart('freeflow')}
                style={{
                  width: '100%',
                  height: '3rem',
                  fontSize: '1.125rem',
                  background: 'var(--brand-primary)',
                  color: 'var(--text-on-brand)',
                  borderRadius: '0.5rem',
                }}
              >
                Start Freeflow
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Timer will count up from 00:00.</p></TooltipContent>
          </Tooltip>

          <div className="divider">
            <span className="divider-line" />
            <span className="divider-text">OR</span>
            <span className="divider-line" />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            padding: '0.5rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '0.5rem',
          }}>
            <Input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="minutes"
              min="1"
              max="240"
              onKeyDown={(e) => { if (e.key === 'Enter') handleStart('timed'); }}
              style={{
                width: '6rem',
                height: '2.25rem',
                textAlign: 'center',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
                background: 'var(--bg-input)',
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleStart('timed')}
                  variant="outline"
                  style={{
                    flex: 1,
                    height: '2.25rem',
                    background: 'var(--bg-input)',
                    color: 'var(--brand-action)',
                    border: '1px solid var(--brand-action)',
                  }}
                >
                  Set Timer
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Start a countdown from the specified minutes.</p></TooltipContent>
            </Tooltip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
