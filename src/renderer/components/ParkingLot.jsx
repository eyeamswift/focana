import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Checkbox } from './ui/Checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { Plus, Trash2, Edit3, Save, NotebookPen, Copy, X } from 'lucide-react';

export default function ParkingLot({
  isOpen,
  onClose,
  thoughts,
  onAddThought,
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const copyAllToClipboard = () => {
    const textToCopy = thoughts.map((t) => `- ${t.text}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
  };

  const handleThoughtClick = (index) => {
    setExpandedThought(index);
    setEditingText(thoughts[index].text);
  };

  const handleSaveEdit = () => {
    if (editingText.trim() && expandedThought !== null) {
      onRemoveThought(expandedThought);
      onAddThought(editingText.trim());
    }
    setExpandedThought(null);
    setEditingText('');
  };

  const handleDeleteThought = () => {
    if (expandedThought !== null) {
      onRemoveThought(expandedThought);
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
          background: '#FFFEF8',
          borderColor: '#D97706',
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
              <NotebookPen style={{ width: 24, height: 24, color: '#D97706' }} />
              Parking Lot
            </DialogTitle>
            <p style={{ fontSize: '0.8rem', color: '#8B6F47', marginTop: '0.125rem' }}>Park distracting thoughts here.</p>
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
                onKeyPress={handleKeyPress}
                placeholder="Capture a thought... (Enter to add)"
                style={{ flex: 1, minHeight: 40, fontSize: '1rem', borderColor: 'rgba(139,111,71,0.3)', color: '#5C4033', background: 'white' }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleAdd}
                    size="icon"
                    disabled={!newThought.trim()}
                    aria-label="Add Note"
                    style={{ background: '#F59E0B', color: 'white', flexShrink: 0 }}
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
                    background: '#FFF9E6',
                    borderRadius: '0.375rem',
                    border: '1px solid transparent',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'}
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
                      color: thought.completed ? '#8B6F47' : '#5C4033',
                      textDecoration: thought.completed ? 'line-through' : 'none',
                    }}
                    onClick={() => handleThoughtClick(index)}
                  >
                    <p className="line-clamp-2 break-words">{thought.text}</p>
                    {thought.text.length > 60 && (
                      <p style={{ fontSize: '0.75rem', color: '#8B6F47', marginTop: '0.25rem' }}>Click to expand...</p>
                    )}
                  </div>
                </div>
              ))}
              {thoughts.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#8B6F47', padding: '1rem 0' }}>No notes yet.</p>
              )}
            </div>
          </div>

          <DialogFooter className="dialog-footer-between" style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(139,111,71,0.16)',
            background: '#FFFEF8',
            flexShrink: 0,
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={onClearCompleted} style={{ color: '#8B6F47' }}>
                  Clear Completed
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Remove all completed notes</p></TooltipContent>
            </Tooltip>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={copyAllToClipboard}>
                    <Copy style={{ width: 16, height: 16, marginRight: '0.5rem' }} />
                    Copy All
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Copy all notes to clipboard</p></TooltipContent>
              </Tooltip>
              <Button onClick={() => onClose(false)} style={{ background: '#F59E0B', color: 'white' }}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expanded Note Modal */}
      <Dialog open={expandedThought !== null} onOpenChange={(open) => !open && handleCloseExpanded()}>
        <DialogContent style={{ background: '#FFFEF8', borderColor: '#D97706', maxWidth: '28rem' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit3 style={{ width: 20, height: 20, color: '#F59E0B' }} />
              Edit Note
            </DialogTitle>
          </DialogHeader>

          <div style={{ padding: '1rem 0' }}>
            <Textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              placeholder="Edit your note..."
              style={{ minHeight: 120, fontSize: '1rem', borderColor: 'rgba(139,111,71,0.3)', color: '#5C4033', background: 'white' }}
            />
            <p style={{ fontSize: '0.75rem', color: '#8B6F47', marginTop: '0.25rem', textAlign: 'right' }}>
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
              style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editingText.trim()}
              style={{ background: '#F59E0B', color: 'white' }}
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
