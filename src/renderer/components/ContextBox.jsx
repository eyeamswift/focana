import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { Edit3, Save, X } from 'lucide-react';

const NOTES_HELPER_COPY = 'Enter your immediate next steps and/or any notes, links, or resources that will help you get started when you return.';

function combineNotes(nextSteps = '', recap = '') {
  const pieces = [nextSteps, recap]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(pieces)).join('\n\n');
}

export default function ContextBox({
  recap = '',
  nextSteps = '',
  onUpdateRecap,
  onUpdateNextSteps,
  onDismiss,
  isSessionActive = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(() => combineNotes(nextSteps, recap));
  const notes = combineNotes(nextSteps, recap);

  useEffect(() => {
    if (isEditing) return;
    setEditedNotes(combineNotes(nextSteps, recap));
  }, [isEditing, recap, nextSteps]);

  const hasContent = Boolean(notes.trim());

  const handleSave = () => {
    onUpdateRecap?.(editedNotes.trim());
    onUpdateNextSteps?.('');
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedNotes(notes);
    setIsEditing(false);
  };

  if (!hasContent && !isEditing) return null;

  const sectionLabelStyle = {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    marginBottom: '0.3rem',
  };

  return (
    <div
      className="card context-box"
      style={{
        width: '100%',
        maxWidth: 420,
        marginTop: '0.5rem',
        transition: 'opacity 0.3s',
        opacity: isSessionActive ? 0.75 : 1,
      }}
      onMouseEnter={(event) => { if (isSessionActive) event.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(event) => { if (isSessionActive) event.currentTarget.style.opacity = '0.75'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.65rem' }}>
        <div style={{ flex: 1, display: 'grid', gap: '0.75rem' }}>
          {!isEditing ? (
            <div className="context-box__notes">
              <p style={sectionLabelStyle}>Notes</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {notes}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="context-box-notes" style={{ ...sectionLabelStyle, display: 'block' }}>
                  Notes
                </label>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.45, margin: '0 0 0.45rem' }}>
                  {NOTES_HELPER_COPY}
                </p>
                <Textarea
                  id="context-box-notes"
                  value={editedNotes}
                  onChange={(event) => setEditedNotes(event.target.value)}
                  maxLength={900}
                  style={{ minHeight: 112, fontSize: '0.875rem', borderColor: 'var(--border-strong)', background: 'var(--bg-surface)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSave}
                      size="sm"
                      style={{ height: '1.9rem', padding: '0 0.65rem', background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}
                    >
                      <Save style={{ width: 12, height: 12, marginRight: '0.25rem' }} />
                      Save
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Save changes</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCancel}
                      size="sm"
                      variant="outline"
                      style={{ height: '1.9rem', padding: '0 0.65rem', borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Discard changes</p></TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>

        {!isEditing ? (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    setEditedNotes(notes);
                    setIsEditing(true);
                  }}
                  size="icon"
                  variant="ghost"
                  style={{ height: '1.6rem', width: '1.6rem', color: 'var(--text-secondary)' }}
                >
                  <Edit3 style={{ width: 12, height: 12 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Edit context</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onDismiss}
                  size="icon"
                  variant="ghost"
                  style={{ height: '1.6rem', width: '1.6rem', color: 'var(--text-secondary)' }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Dismiss saved context</p></TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </div>
    </div>
  );
}
