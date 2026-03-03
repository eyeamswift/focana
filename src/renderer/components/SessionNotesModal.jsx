import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CheckCircle, X } from 'lucide-react';

export default function SessionNotesModal({
  isOpen,
  onClose,
  onSave,
  sessionDuration,
  taskName,
}) {
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    onSave(notes.trim());
    setNotes('');
  };

  const handleSkip = () => {
    onClose();
    setNotes('');
  };

  const formatDuration = (minutes) => {
    if (minutes < 1) return 'less than a minute';
    return minutes === 1 ? '1 minute' : `${Math.round(minutes)} minutes`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent style={{ background: 'var(--bg-card)', borderColor: 'var(--brand-action)', maxWidth: '28rem' }}>
        <button className="dialog-close-btn" onClick={onClose} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
          <div style={{
            margin: '0 auto',
            width: '3rem',
            height: '3rem',
            background: 'var(--brand-primary)',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
          }}>
            <CheckCircle style={{ width: 24, height: 24, color: 'var(--text-on-brand)' }} />
          </div>
          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Great focus session!
          </DialogTitle>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {formatDuration(sessionDuration)} on "{taskName}"
          </p>
        </DialogHeader>

        <div className="space-y-4" style={{ padding: '0.5rem 0' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.5rem' }}>
              Where did you leave off? <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 400 }}>(optional)</span>
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick note about where to pick up next time..."
              maxLength={500}
              className="no-resize"
              style={{ minHeight: 100, borderColor: 'var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'right' }}>
              {notes.length}/500 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSkip}
                variant="outline"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
              >
                Skip
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Finish session without saving notes</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleSave} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Save notes and finish session</p></TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
