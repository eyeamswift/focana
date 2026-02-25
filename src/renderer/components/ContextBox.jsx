import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { Edit3, X, Save } from 'lucide-react';

export default function ContextBox({ notes, onUpdateNotes, onDismiss, isSessionActive = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notes);

  const handleSave = () => {
    onUpdateNotes(editedNotes.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedNotes(notes);
    setIsEditing(false);
  };

  if (!notes && !isEditing) return null;

  return (
    <div
      className="card"
      style={{
        width: '100%',
        maxWidth: 380,
        marginTop: '0.5rem',
        transition: 'opacity 0.3s',
        opacity: isSessionActive ? 0.75 : 1,
      }}
      onMouseEnter={(e) => { if (isSessionActive) e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { if (isSessionActive) e.currentTarget.style.opacity = '0.75'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, color: '#8B6F47', marginBottom: '0.25rem' }}>
            Where you left off:
          </p>
          {!isEditing ? (
            <p style={{ fontSize: '0.875rem', color: '#5C4033', lineHeight: 1.6 }}>{notes}</p>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                maxLength={500}
                style={{ minHeight: 60, fontSize: '0.875rem', borderColor: 'rgba(139,111,71,0.3)', background: '#FFFEF8' }}
              />
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSave}
                      size="sm"
                      style={{ height: '1.75rem', padding: '0 0.5rem', background: '#F59E0B', color: 'white' }}
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
                      style={{ height: '1.75rem', padding: '0 0.5rem', borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}
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

        {!isEditing && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setIsEditing(true)}
                  size="icon"
                  variant="ghost"
                  style={{ height: '1.5rem', width: '1.5rem', color: '#8B6F47' }}
                >
                  <Edit3 style={{ width: 12, height: 12 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Edit notes</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onDismiss}
                  size="icon"
                  variant="ghost"
                  style={{ height: '1.5rem', width: '1.5rem', color: '#8B6F47' }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Dismiss notes</p></TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
