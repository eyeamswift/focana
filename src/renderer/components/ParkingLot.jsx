import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Checkbox } from './ui/Checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { Plus, Trash2, Edit3, Save, NotebookPen, Copy, X } from 'lucide-react';
import { track } from '../utils/analytics';

export default function ParkingLot({
  isOpen,
  onClose,
  thoughts,
  onAddThought,
  onUpdateThought,
  onRemoveThought,
  onToggleThought,
  onClearCompleted,
}) {
  const [newThought, setNewThought] = useState('');
  const [expandedThought, setExpandedThought] = useState(null);
  const [editingText, setEditingText] = useState('');

  const handleAdd = () => {
    if (newThought.trim()) {
      onAddThought(newThought.trim());
      setNewThought('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const hasChecked = thoughts.some((t) => t.completed);

  const copyToClipboard = () => {
    const items = hasChecked ? thoughts.filter((t) => t.completed) : thoughts;
    const textToCopy = items.map((t) => `- ${t.text}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
    track('content_copied', { source: 'parking_lot', item_count: items.length, mode: hasChecked ? 'selected' : 'all' });
  };

  const handleThoughtClick = (index) => {
    setExpandedThought(index);
    setEditingText(thoughts[index].text);
  };

  const handleSaveEdit = () => {
    if (editingText.trim() && expandedThought !== null) {
      if (typeof onUpdateThought === 'function') {
        onUpdateThought(expandedThought, editingText.trim());
      } else {
        onRemoveThought(expandedThought);
        onAddThought(editingText.trim());
      }
    }
    setExpandedThought(null);
    setEditingText('');
  };

  const handleDeleteThought = () => {
    if (expandedThought !== null) {
      onRemoveThought(expandedThought);
      track('parking_lot_item_deleted');
      setExpandedThought(null);
      setEditingText('');
    }
  };

  const handleCloseExpanded = () => {
    setExpandedThought(null);
    setEditingText('');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--brand-action)',
          maxWidth: '32rem',
          maxHeight: 'min(calc(100vh - 2rem), 720px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <button className="dialog-close-btn" onClick={() => onClose(false)} aria-label="Close Parking Lot">
            <X style={{ width: 16, height: 16 }} />
          </button>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <NotebookPen style={{ width: 24, height: 24, color: 'var(--brand-action)' }} />
              Parking Lot
            </DialogTitle>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>Park distracting thoughts here.</p>
          </DialogHeader>

          <div style={{
            padding: '1rem 0',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Textarea
                value={newThought}
                onChange={(e) => setNewThought(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Capture a thought... (Enter to add)"
                style={{ flex: 1, minHeight: 40, fontSize: '1rem', borderColor: 'var(--border-strong)', color: 'var(--text-primary)', background: 'var(--bg-input)' }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleAdd}
                    size="icon"
                    disabled={!newThought.trim()}
                    aria-label="Add Note"
                    style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)', flexShrink: 0 }}
                  >
                    <Plus style={{ width: 20, height: 20 }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Add note</p></TooltipContent>
              </Tooltip>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.5rem' }} className="space-y-2">
              {thoughts.map((thought, index) => (
                <div
                  key={thought.id || index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.5rem',
                    background: 'var(--bg-card)',
                    borderRadius: '0.375rem',
                    border: '1px solid transparent',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-focus)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: '0.125rem' }}>
                    <Checkbox
                      id={`thought-${index}`}
                      checked={thought.completed}
                      onCheckedChange={() => onToggleThought(index)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      color: thought.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                      textDecoration: thought.completed ? 'line-through' : 'none',
                    }}
                    onClick={() => handleThoughtClick(index)}
                  >
                    <p className="line-clamp-2 break-words">{thought.text}</p>
                    {thought.text.length > 60 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Click to expand...</p>
                    )}
                  </div>
                </div>
              ))}
              {thoughts.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)', padding: '1rem 0' }}>No notes yet.</p>
              )}
            </div>
          </div>

          <DialogFooter className="dialog-footer-between" style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={onClearCompleted} style={{ color: 'var(--text-secondary)' }}>
                  Clear Completed
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Remove all completed notes</p></TooltipContent>
            </Tooltip>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={copyToClipboard}>
                    <Copy style={{ width: 16, height: 16, marginRight: '0.5rem' }} />
                    {hasChecked ? 'Copy Selected' : 'Copy All'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Copy all notes to clipboard</p></TooltipContent>
              </Tooltip>
              <Button onClick={() => onClose(false)} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expanded Note Modal */}
      <Dialog open={expandedThought !== null} onOpenChange={(open) => !open && handleCloseExpanded()}>
        <DialogContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)', maxWidth: '28rem' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit3 style={{ width: 20, height: 20, color: 'var(--brand-primary)' }} />
              Edit Note
            </DialogTitle>
          </DialogHeader>

          <div style={{ padding: '1rem 0' }}>
            <Textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              placeholder="Edit your note..."
              style={{ minHeight: 120, fontSize: '1rem', borderColor: 'var(--border-strong)', color: 'var(--text-primary)', background: 'var(--bg-input)' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'right' }}>
              {editingText.length} characters
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={handleDeleteThought}
              variant="outline"
              style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
            >
              <Trash2 style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
              Delete
            </Button>
            <Button
              onClick={handleCloseExpanded}
              variant="outline"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editingText.trim()}
              style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}
            >
              <Save style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
