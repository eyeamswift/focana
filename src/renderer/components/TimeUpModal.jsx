import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { AlarmClock, Plus, Play, X } from 'lucide-react';

export default function TimeUpModal({
  isOpen,
  taskName,
  onAddTime,
  onSwitchToFreeflow,
  onEndSession,
}) {
  const [extraMinutes, setExtraMinutes] = useState('5');
  const parsedMinutes = parseInt(extraMinutes, 10);
  const safeMinutes = Number.isFinite(parsedMinutes) ? Math.min(Math.max(parsedMinutes, 1), 240) : 5;
  const minuteLabel = safeMinutes === 1 ? 'minute' : 'minutes';

  useEffect(() => {
    if (isOpen) {
      setExtraMinutes('5');
    }
  }, [isOpen]);

  const handleAddTime = () => {
    const parsed = parseInt(extraMinutes, 10);
    const safe = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 240) : 5;
    onAddTime(safe);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (open) return;
      onEndSession();
    }}>
      <DialogContent className="time-up-modal" style={{ maxWidth: '22rem' }}>
        <button className="dialog-close-btn" onClick={onEndSession} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>

        <DialogHeader style={{ textAlign: 'center', paddingBottom: '0.25rem' }}>
          <div className="time-up-icon">
            <AlarmClock style={{ width: 20, height: 20, color: 'var(--brand-action)' }} />
          </div>
          <DialogTitle style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Time's up
          </DialogTitle>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.125rem' }}>
            {taskName || 'Untitled task'}
          </p>
        </DialogHeader>

        {/* ── Keep going ── */}
        <div className="time-up-section">
          <span className="time-up-section-label">Keep going</span>

          <div className="time-up-add-row">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleAddTime} className="time-up-btn-primary">
                  <Plus style={{ width: 14, height: 14 }} />
                  Add {safeMinutes} {minuteLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Continue this session for {safeMinutes} more {minuteLabel}</p></TooltipContent>
            </Tooltip>
            <Input
              type="number"
              min="1"
              max="240"
              value={extraMinutes}
              onChange={(e) => setExtraMinutes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTime();
                }
              }}
              className="time-up-minutes-input"
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onSwitchToFreeflow}
                variant="outline"
                className="time-up-btn-freeflow"
              >
                <Play style={{ width: 13, height: 13 }} />
                Switch to Freeflow
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Continue without a timer</p></TooltipContent>
          </Tooltip>
        </div>

        {/* ── Or stop ── */}
        <div className="time-up-section">
          <span className="time-up-section-label">Or stop</span>

          <div className="time-up-stop-row">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onEndSession}
                  variant="outline"
                  className="time-up-btn-secondary"
                >
                  Wrap here
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Move into Session Wrap</p></TooltipContent>
            </Tooltip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
