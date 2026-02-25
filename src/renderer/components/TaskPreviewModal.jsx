import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { FileText, Edit3 } from 'lucide-react';

export default function TaskPreviewModal({
  isOpen,
  onClose,
  session,
  onUseTask,
  onUpdateNotes,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  useEffect(() => {
    if (session) {
      setEditedNotes(session.notes || '');
    }
  }, [session]);

  if (!session) return null;

  const handleUseTask = () => {
    onUseTask(session);
    onClose();
  };

  const handleSaveNotes = () => {
    onUpdateNotes(session.id, editedNotes.trim());
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedNotes(session.notes || '');
    setIsEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ background: '#FFFEF8', borderColor: '#D97706', maxWidth: '28rem' }}>
        <DialogHeader>
          <DialogTitle style={{ fontSize: '1.125rem', fontWeight: 700, color: '#5C4033', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText style={{ width: 20, height: 20, color: '#F59E0B' }} />
            "{session.task}"
          </DialogTitle>
          <p style={{ color: '#8B6F47', fontSize: '0.875rem' }}>
            Last session: {Math.round(session.durationMinutes)} minutes
          </p>
        </DialogHeader>

        <div style={{ padding: '1rem 0' }}>
          {session.notes && !isEditing ? (
            <div className="space-y-3">
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#8B6F47' }}>
                Last notes:
              </p>
              <div style={{ padding: '0.75rem', background: '#FFF9E6', borderRadius: '0.5rem', border: '1px solid rgba(139,111,71,0.1)' }}>
                <p style={{ color: '#5C4033', fontSize: '0.875rem', lineHeight: 1.6 }}>{session.notes}</p>
              </div>
            </div>
          ) : isEditing ? (
            <div className="space-y-3">
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#8B6F47' }}>Edit your notes:</p>
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                maxLength={500}
                placeholder="Where did you leave off?"
                style={{ minHeight: 100, borderColor: 'rgba(139,111,71,0.3)', background: '#FFF9E6', color: '#5C4033' }}
              />
              <p style={{ fontSize: '0.75rem', color: '#8B6F47', textAlign: 'right' }}>
                {editedNotes.length}/500 characters
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button onClick={handleSaveNotes} size="sm" style={{ background: '#F59E0B', color: 'white' }}>
                  Save Changes
                </Button>
                <Button onClick={handleCancelEdit} size="sm" variant="outline" style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: '#8B6F47', fontSize: '0.875rem' }}>No notes from your last session</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline" style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}>
            Cancel
          </Button>

          {session.notes && !isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              style={{ borderColor: '#F59E0B', color: '#F59E0B' }}
            >
              <Edit3 style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
              Edit Notes
            </Button>
          )}

          {!isEditing && (
            <Button onClick={handleUseTask} style={{ background: '#F59E0B', color: 'white' }}>
              Use This Task
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
