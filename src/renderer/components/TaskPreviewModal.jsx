import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { FileText, Edit3, Undo2, X } from 'lucide-react';
import SessionBuilderComposer from './SessionBuilderComposer';
import { prepareTaskPlanForStart } from '../utils/taskPlan';

const NOTES_HELPER_COPY = 'Enter your immediate next steps and/or any notes, links, or resources that will help you get started when you return.';

function getSessionRecap(session) {
  if (!session || typeof session !== 'object') return '';
  if (typeof session.recap === 'string') return session.recap;
  if (typeof session.notes === 'string') return session.notes;
  if (typeof session.contextNote === 'string') return session.contextNote;
  return '';
}

function getSessionNextSteps(session) {
  if (!session || typeof session !== 'object') return '';
  return typeof session.nextSteps === 'string' ? session.nextSteps : '';
}

function combineNotes(nextSteps = '', recap = '') {
  const pieces = [nextSteps, recap]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(pieces)).join('\n\n');
}

function getSessionNotes(session) {
  return combineNotes(getSessionNextSteps(session), getSessionRecap(session));
}

export default function TaskPreviewModal({
  isOpen,
  onClose,
  session,
  sessions = [],
  onUseTask,
  onRestoreSession,
  onUpdateNotes,
  canUseTask = true,
  canRestore = false,
}) {
  const [editingField, setEditingField] = useState(null);
  const [editedNotes, setEditedNotes] = useState('');
  const [editedTaskPlan, setEditedTaskPlan] = useState(() => prepareTaskPlanForStart(null, ''));

  useEffect(() => {
    setEditedNotes(getSessionNotes(session));
    setEditedTaskPlan(prepareTaskPlanForStart(session?.taskPlan, session?.task || ''));
    setEditingField(null);
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
  const notes = getSessionNotes(session);
  const savedTaskPlan = useMemo(
    () => prepareTaskPlanForStart(session?.taskPlan, session?.task || ''),
    [session?.taskPlan, session?.task],
  );
  const preparedEditedTaskPlan = useMemo(
    () => prepareTaskPlanForStart(editedTaskPlan, session?.task || ''),
    [editedTaskPlan, session?.task],
  );
  const taskPlanChanged = JSON.stringify(preparedEditedTaskPlan) !== JSON.stringify(savedTaskPlan);
  const hasUnsavedChanges = Boolean(editingField) || taskPlanChanged;

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
    const normalizedNotes = editedNotes.trim();
    onUseTask({
      ...session,
      recap: normalizedNotes,
      notes: normalizedNotes,
      nextSteps: '',
      taskPlan: preparedEditedTaskPlan,
    });
  };

  const handleRestoreSession = () => {
    if (!session || !canRestore) return;
    const normalizedNotes = editedNotes.trim();
    onRestoreSession?.({
      ...session,
      recap: normalizedNotes,
      notes: normalizedNotes,
      nextSteps: '',
      taskPlan: preparedEditedTaskPlan,
    });
  };

  const handleSaveChanges = () => {
    if (!session || !hasUnsavedChanges) return;
    const normalizedNotes = editedNotes.trim();
    onUpdateNotes(session.id, {
      recap: normalizedNotes,
      nextSteps: '',
      taskPlan: preparedEditedTaskPlan,
    });
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditedNotes(notes);
    setEditedTaskPlan(savedTaskPlan);
    setEditingField(null);
  };

  if (!session) return null;

  const renderField = ({
    key,
    label,
    value,
    editedValue,
    onChange,
    placeholder,
    hint = '',
    maxLength = 500,
  }) => {
    const isEditing = editingField === key;
    const hasValue = value.trim().length > 0;

    return (
      <div className="space-y-3">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0 }}>
              {label}
            </p>
            {hint ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.45, maxWidth: '26rem' }}>
                {hint}
              </p>
            ) : null}
          </div>
          {!isEditing ? (
            <Button
              onClick={() => setEditingField(key)}
              variant="outline"
              size="sm"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
            >
              <Edit3 style={{ width: 14, height: 14, marginRight: '0.25rem' }} />
              {hasValue ? 'Edit' : 'Add'}
            </Button>
          ) : null}
        </div>

        {isEditing ? (
          <>
            <Textarea
              value={editedValue}
              onChange={onChange}
              maxLength={maxLength}
              placeholder={placeholder}
              style={{ minHeight: 142, borderColor: 'var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right', margin: 0 }}>
              {editedValue.length}/{maxLength} characters
            </p>
          </>
        ) : hasValue ? (
          <div style={{ padding: '0.8rem', background: 'var(--bg-card)', borderRadius: '0.6rem', border: '1px solid var(--border-subtle)' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.89rem', lineHeight: 1.6, margin: 0 }}>{value}</p>
          </div>
        ) : (
          <div style={{ padding: '0.8rem', background: 'var(--bg-card)', borderRadius: '0.6rem', border: '1px dashed var(--border-default)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>No saved text yet</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--brand-action)',
        maxWidth: '34rem',
        maxHeight: 'min(calc(100vh - 2rem), 760px)',
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

        <div style={{ padding: '1rem 0.25rem 0.5rem 0', overflowY: 'auto', flex: 1, minHeight: 0, display: 'grid', gap: '1rem' }}>
          {renderField({
            key: 'notes',
            label: 'Notes',
            value: notes,
            editedValue: editedNotes,
            onChange: (event) => setEditedNotes(event.target.value),
            placeholder: 'Next steps, links, resources, or reminders...',
            hint: NOTES_HELPER_COPY,
            maxLength: 900,
          })}

          <div className="task-preview__plan-builder">
            <SessionBuilderComposer
              taskPlan={editedTaskPlan}
              primaryTask={session.task || ''}
              showPrimaryTask
              variant="separate"
              testId="task-preview-session-builder"
              onTaskPlanChange={setEditedTaskPlan}
            />
          </div>
        </div>

        <DialogFooter style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-default)' }}>
          <Button onClick={onClose} variant="outline" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
            Cancel
          </Button>

          {hasUnsavedChanges ? (
            <>
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
              >
                Cancel Edit
              </Button>
              <Button onClick={handleSaveChanges} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
                Save Changes
              </Button>
            </>
          ) : null}

          {!editingField && canRestore ? (
            <Button
              onClick={handleRestoreSession}
              variant="outline"
              style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
            >
              <Undo2 style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
              Restore to Resume
            </Button>
          ) : null}

          {!editingField && canUseTask ? (
            <Button onClick={handleUseTask} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
              Start This Task
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
