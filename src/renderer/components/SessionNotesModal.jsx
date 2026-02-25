import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CheckCircle } from 'lucide-react';

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
      <DialogContent style={{ background: '#FFF9E6', borderColor: '#D97706', maxWidth: '28rem' }}>
        <DialogHeader style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
          <div style={{
            margin: '0 auto',
            width: '3rem',
            height: '3rem',
            background: '#F59E0B',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
          }}>
            <CheckCircle style={{ width: 24, height: 24, color: 'white' }} />
          </div>
          <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: '#5C4033' }}>
            Great focus session!
          </DialogTitle>
          <p style={{ color: '#8B6F47', fontSize: '0.875rem' }}>
            {formatDuration(sessionDuration)} on "{taskName}"
          </p>
        </DialogHeader>

        <div className="space-y-4" style={{ padding: '0.5rem 0' }}>
          <div>
            <p style={{ color: '#5C4033', fontWeight: 500, marginBottom: '0.5rem' }}>
              Where did you leave off? <span style={{ color: '#8B6F47', fontSize: '0.875rem', fontWeight: 400 }}>(optional)</span>
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick note about where to pick up next time..."
              maxLength={500}
              className="no-resize"
              style={{ minHeight: 100, borderColor: 'rgba(139,111,71,0.3)', background: '#FFFEF8', color: '#5C4033' }}
            />
            <p style={{ fontSize: '0.75rem', color: '#8B6F47', marginTop: '0.25rem', textAlign: 'right' }}>
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
                style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}
              >
                Skip
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Finish session without saving notes</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleSave} style={{ background: '#F59E0B', color: 'white' }}>
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
