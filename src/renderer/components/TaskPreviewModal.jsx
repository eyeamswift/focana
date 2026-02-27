import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { FileText, Edit3, X } from 'lucide-react';

export default function TaskPreviewModal({
  isOpen,
  onClose,
  session,
  sessions = [],
  onUseTask,
  onUpdateNotes,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  useEffect(() => {
    setEditedNotes(session?.notes || '');
  }, [session]);

  const normalizeTask = (value) => (value || '').trim().toLowerCase();

  const relatedSessions = useMemo(() => {
    if (!session) return [];
    const taskKey = normalizeTask(session.task);
    return sessions
      .filter((item) => normalizeTask(item.task) === taskKey)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [sessions, session]);

  const lastSession = relatedSessions[0] || session || { durationMinutes: 0 };
  const totalWorkMinutes = relatedSessions.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);

  const formatMinutes = (minutes) => {
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) {
      const rounded = Math.round(minutes);
      return `${rounded} ${rounded === 1 ? 'minute' : 'minutes'}`;
    }
    const wholeMinutes = Math.round(minutes);
    const hours = Math.floor(wholeMinutes / 60);
    const mins = wholeMinutes % 60;
    if (mins === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    return `${hours}h ${mins}m`;
  };

  const handleUseTask = () => {
    if (!session) return;
    onUseTask(session);
  };

  const handleSaveNotes = () => {
    if (!session) return;
    onUpdateNotes(session.id, editedNotes.trim());
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedNotes(session?.notes || '');
    setIsEditing(false);
  };

  if (!session) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{
        background: '#FFFEF8',
        borderColor: '#D97706',
        maxWidth: '32rem',
        maxHeight: 'min(calc(100vh - 2rem), 720px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <button
          className="dialog-close-btn"
          onClick={onClose}
          aria-label="Close"
          style={{
            zIndex: 3,
            background: '#FFF9E6',
            borderColor: 'rgba(139,111,71,0.25)',
            color: '#8B6F47',
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader>
          <DialogTitle style={{ fontSize: '1.125rem', fontWeight: 700, color: '#5C4033', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText style={{ width: 20, height: 20, color: '#F59E0B' }} />
            "{session.task}"
          </DialogTitle>
          <div style={{ color: '#8B6F47', fontSize: '0.875rem', lineHeight: 1.5 }}>
            <p>Last session: {formatMinutes(lastSession.durationMinutes || 0)}</p>
            <p>Total work time: {formatMinutes(totalWorkMinutes || (session.durationMinutes || 0))}</p>
          </div>
        </DialogHeader>

        <div style={{ padding: '1rem 0.25rem 0.5rem 0', overflowY: 'auto', flex: 1, minHeight: 0 }}>
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

        <DialogFooter style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(139,111,71,0.16)' }}>
          <Button onClick={onClose} variant="outline" style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}>
            Cancel
          </Button>

          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              style={{ borderColor: '#F59E0B', color: '#F59E0B' }}
            >
              <Edit3 style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
              {session.notes ? 'Edit Notes' : 'Add Notes'}
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
