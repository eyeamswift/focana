import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CheckCircle2, CircleDot, X } from 'lucide-react';

export default function TaskCompletionModal({
  isOpen,
  taskName,
  onCompleted,
  onNotCompleted,
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onNotCompleted(); }}>
      <DialogContent style={{ background: '#FFFEF8', borderColor: '#D97706', maxWidth: '28rem' }}>
        <button className="dialog-close-btn" onClick={onNotCompleted} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>

        <DialogHeader style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
          <div style={{
            margin: '0 auto',
            width: '3rem',
            height: '3rem',
            background: '#FFF9E6',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            border: '1px solid rgba(139,111,71,0.2)',
          }}>
            <CircleDot style={{ width: 20, height: 20, color: '#D97706' }} />
          </div>

          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: '#5C4033' }}>
            Did you complete this task?
          </DialogTitle>
          <p style={{ color: '#8B6F47', fontSize: '0.875rem' }}>
            "{taskName || 'Untitled task'}"
          </p>
        </DialogHeader>

        <DialogFooter style={{ justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onNotCompleted}
                variant="outline"
                style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}
              >
                No
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Save session and keep task active</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onCompleted} style={{ background: '#F59E0B', color: 'white' }}>
                <CheckCircle2 style={{ width: 16, height: 16, marginRight: '0.4rem' }} />
                Yes
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Mark complete and apply keep-text setting</p></TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
