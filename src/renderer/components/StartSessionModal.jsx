import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';

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
      <DialogContent style={{ background: '#FFF9E6', borderColor: '#D97706', maxWidth: '24rem' }}>
        <DialogHeader style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: '#5C4033' }}>
            Ready to focus on:
          </DialogTitle>
          <p style={{ color: '#D97706', fontWeight: 600, padding: '0 1rem', wordBreak: 'break-word' }}>
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
                  background: '#F59E0B',
                  color: 'white',
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
            background: '#FFFEF8',
            border: '1px solid rgba(139, 111, 71, 0.2)',
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
                borderColor: 'rgba(139, 111, 71, 0.3)',
                color: '#5C4033',
                background: 'white',
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
                    background: 'white',
                    color: '#D97706',
                    border: '1px solid #D97706',
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
