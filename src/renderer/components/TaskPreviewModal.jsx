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
  canUseTask = true,
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
    if (!session || !canUseTask) return;
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
        background: 'var(--bg-surface)',
        borderColor: 'var(--brand-action)',
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
            background: 'var(--bg-surface)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text-primary)',
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader>
          <DialogTitle style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText style={{ width: 20, height: 20, color: 'var(--brand-primary)' }} />
            "{session.task}"
          </DialogTitle>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            <p>Last session: {formatMinutes(lastSession.durationMinutes || 0)}</p>
            <p>Total work time: {formatMinutes(totalWorkMinutes || (session.durationMinutes || 0))}</p>
          </div>
        </DialogHeader>

        <div style={{ padding: '1rem 0.25rem 0.5rem 0', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {session.notes && !isEditing ? (
            <div className="space-y-3">
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Last notes:
              </p>
              <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{session.notes}</p>
              </div>
            </div>
          ) : isEditing ? (
            <div className="space-y-3">
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Edit your notes:</p>
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                maxLength={500}
                placeholder="Where did you leave off?"
                style={{ minHeight: 100, borderColor: 'var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                {editedNotes.length}/500 characters
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button onClick={handleSaveNotes} size="sm" style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
                  Save Changes
                </Button>
                <Button onClick={handleCancelEdit} size="sm" variant="outline" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No notes from your last session</p>
            </div>
          )}
        </div>

        <DialogFooter style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-default)' }}>
          <Button onClick={onClose} variant="outline" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
            Cancel
          </Button>

          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
            >
              <Edit3 style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
              {session.notes ? 'Edit Notes' : 'Add Notes'}
            </Button>
          )}

          {!isEditing && canUseTask && (
            <Button onClick={handleUseTask} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
              Use This Task
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
