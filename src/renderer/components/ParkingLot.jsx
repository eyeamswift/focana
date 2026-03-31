import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Checkbox } from './ui/Checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { Plus, Trash2, Edit3, Save, NotebookPen, Copy, X, CheckSquare, Square, ArrowRight, ChevronsRight } from 'lucide-react';
import { track } from '../utils/analytics';

export default function ParkingLot({
  isOpen,
  onClose,
  thoughts,
  onAddThought,
  onUpdateThought,
  onRemoveThought,
  onRemoveThoughts,
  onToggleThought,
  onClearCompleted,
  onStartThoughtAsNextTask,
}) {
  const [newThought, setNewThought] = useState('');
  const [expandedThought, setExpandedThought] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedThoughtIds, setSelectedThoughtIds] = useState([]);

  const displayThoughts = useMemo(() => [...thoughts]
    .map((thought, index) => ({ thought, index }))
    .sort((a, b) => {
      const aCreatedAt = Number.isFinite(new Date(a.thought.createdAt).getTime())
        ? new Date(a.thought.createdAt).getTime()
        : -Infinity;
      const bCreatedAt = Number.isFinite(new Date(b.thought.createdAt).getTime())
        ? new Date(b.thought.createdAt).getTime()
        : -Infinity;
      if (aCreatedAt !== bCreatedAt) return bCreatedAt - aCreatedAt;
      return b.index - a.index;
    }), [thoughts]);

  useEffect(() => {
    const validIds = new Set(thoughts.map((thought) => thought.id));
    setSelectedThoughtIds((prev) => prev.filter((id) => validIds.has(id)));
    if (expandedThought !== null && !validIds.has(expandedThought)) {
      setExpandedThought(null);
      setEditingText('');
    }
  }, [thoughts, expandedThought]);

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
  const selectedCount = selectedThoughtIds.length;
  const allVisibleSelected = displayThoughts.length > 0 && displayThoughts.every(({ thought }) => selectedThoughtIds.includes(thought.id));

  const copyToClipboard = () => {
    const items = selectionMode
      ? thoughts.filter((t) => selectedThoughtIds.includes(t.id))
      : (hasChecked ? thoughts.filter((t) => t.completed) : thoughts);
    if (items.length === 0) return;
    const textToCopy = items.map((t) => `- ${t.text}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
    track('content_copied', {
      source: 'parking_lot',
      item_count: items.length,
      mode: selectionMode ? 'bulk_selected' : (hasChecked ? 'selected' : 'all'),
    });
  };

  const handleThoughtClick = (thoughtId, text) => {
    if (selectionMode) {
      setSelectedThoughtIds((prev) => (
        prev.includes(thoughtId)
          ? prev.filter((id) => id !== thoughtId)
          : [...prev, thoughtId]
      ));
      return;
    }
    setExpandedThought(thoughtId);
    setEditingText(text);
  };

  const handleSaveEdit = () => {
    if (!editingText.trim() || expandedThought === null) return;
    if (typeof onUpdateThought !== 'function') {
      console.warn('ParkingLot edit ignored because onUpdateThought is missing.');
      return;
    }
    onUpdateThought(expandedThought, editingText.trim());
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

  const handleDeleteThoughtById = (thoughtId) => {
    if (!thoughtId) return;
    onRemoveThought(thoughtId);
    track('parking_lot_item_deleted');
    if (expandedThought === thoughtId) {
      setExpandedThought(null);
      setEditingText('');
    }
  };

  const handleStartThought = () => {
    if (expandedThought === null || typeof onStartThoughtAsNextTask !== 'function') return;
    const thoughtId = expandedThought;
    setExpandedThought(null);
    setEditingText('');
    onStartThoughtAsNextTask(thoughtId);
  };

  const handleStartThoughtById = (thoughtId) => {
    if (!thoughtId || typeof onStartThoughtAsNextTask !== 'function') return;
    if (expandedThought === thoughtId) {
      setExpandedThought(null);
      setEditingText('');
    }
    onStartThoughtAsNextTask(thoughtId);
  };

  const handleCloseExpanded = () => {
    setExpandedThought(null);
    setEditingText('');
  };

  const handleToggleSelectMode = () => {
    setSelectionMode((prev) => {
      const next = !prev;
      if (!next) setSelectedThoughtIds([]);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (!selectionMode) {
      setSelectionMode(true);
    }
    if (allVisibleSelected) {
      setSelectedThoughtIds([]);
      return;
    }
    setSelectedThoughtIds(displayThoughts.map(({ thought }) => thought.id));
  };

  const handleClearSelected = () => {
    if (selectedThoughtIds.length === 0) return;
    if (typeof onRemoveThoughts === 'function') {
      onRemoveThoughts(selectedThoughtIds);
    } else {
      selectedThoughtIds.forEach((thoughtId) => onRemoveThought(thoughtId));
    }
    track('parking_lot_cleared', { cleared_count: selectedThoughtIds.length, mode: 'bulk_selected' });
    setSelectedThoughtIds([]);
    setSelectionMode(false);
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
              {displayThoughts.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0 0.125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {selectionMode && (
                      <button
                        type="button"
                        onClick={handleToggleSelectMode}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          color: 'var(--text-secondary)',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel Select
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        color: 'var(--brand-action)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {selectionMode && allVisibleSelected ? 'Clear All' : 'Select All'}
                    </button>
                  </div>
                </div>
              )}

              {displayThoughts.map(({ thought, index }) => (
                <div
                  key={thought.id || index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.5rem',
                    background: 'var(--bg-card)',
                    borderRadius: '0.375rem',
                    border: selectedThoughtIds.includes(thought.id) ? '1px solid var(--brand-action)' : '1px solid transparent',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-focus)'}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = selectedThoughtIds.includes(thought.id)
                      ? 'var(--brand-action)'
                      : 'transparent';
                  }}
                >
                  {selectionMode && (
                    <button
                      type="button"
                      aria-label={selectedThoughtIds.includes(thought.id) ? 'Deselect note' : 'Select note'}
                      onClick={() => handleThoughtClick(thought.id, thought.text)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        marginTop: '0.125rem',
                        border: 'none',
                        background: 'transparent',
                        color: selectedThoughtIds.includes(thought.id) ? 'var(--brand-action)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedThoughtIds.includes(thought.id)
                        ? <CheckSquare style={{ width: 16, height: 16 }} />
                        : <Square style={{ width: 16, height: 16 }} />}
                    </button>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: '0.125rem' }}>
                    <Checkbox
                      id={`thought-${index}`}
                      checked={thought.completed}
                      onCheckedChange={() => onToggleThought(thought.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      color: thought.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                      textDecoration: thought.completed ? 'line-through' : 'none',
                    }}
                    onClick={() => handleThoughtClick(thought.id, thought.text)}
                  >
                    <p className="line-clamp-2 break-words">{thought.text}</p>
                    {thought.text.length > 60 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Click to expand...</p>
                    )}
                  </div>
                  {!selectionMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', marginLeft: '0.25rem', flexShrink: 0 }}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label="Edit Note"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleThoughtClick(thought.id, thought.text);
                            }}
                            size="icon"
                            variant="ghost"
                            style={{ color: 'var(--text-secondary)', borderRadius: '9999px' }}
                          >
                            <Edit3 style={{ width: 16, height: 16 }} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Edit note</p></TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label="Start This Task"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartThoughtById(thought.id);
                            }}
                            size="icon"
                            variant="ghost"
                            style={{ color: 'var(--brand-primary)', borderRadius: '9999px' }}
                          >
                            <ChevronsRight style={{ width: 18, height: 18 }} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Start this task</p></TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label="Delete Note"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteThoughtById(thought.id);
                            }}
                            size="icon"
                            variant="ghost"
                            style={{ color: 'var(--error)', borderRadius: '9999px' }}
                          >
                            <Trash2 style={{ width: 16, height: 16 }} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Delete note</p></TooltipContent>
                      </Tooltip>
                    </div>
                  )}
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
                <Button
                  variant="ghost"
                  onClick={selectionMode ? handleClearSelected : onClearCompleted}
                  disabled={selectionMode && selectedCount === 0}
                  style={selectionMode ? { color: '#DC2626' } : { color: 'var(--text-secondary)' }}
                >
                  Clear
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{selectionMode ? 'Delete the selected notes' : 'Remove completed notes'}</p></TooltipContent>
            </Tooltip>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={copyToClipboard} disabled={selectionMode && selectedCount === 0}>
                    <Copy style={{ width: 16, height: 16, marginRight: '0.5rem' }} />
                    {selectionMode ? 'Copy Picked' : (hasChecked ? 'Copy Selected' : 'Copy All')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{selectionMode ? 'Copy picked notes to clipboard' : 'Copy notes to clipboard'}</p></TooltipContent>
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
        <DialogContent
          style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--brand-action)',
            maxWidth: '25rem',
            maxHeight: 'min(calc(100vh - 1.75rem), 26rem)',
            padding: '1.25rem 1.25rem 1.1rem',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit3 style={{ width: 20, height: 20, color: 'var(--brand-primary)' }} />
              Edit Note
            </DialogTitle>
          </DialogHeader>

          <div style={{ padding: '0.75rem 0 0.25rem' }}>
            <Textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              placeholder="Edit your note..."
              style={{ minHeight: 104, fontSize: '1rem', borderColor: 'var(--border-strong)', color: 'var(--text-primary)', background: 'var(--bg-input)' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'right' }}>
              {editingText.length} characters
            </p>
          </div>

          <DialogFooter
            className="dialog-footer-between"
            style={{ marginTop: '0.85rem', flexWrap: 'wrap', alignItems: 'center', rowGap: '0.75rem', columnGap: '0.75rem' }}
          >
            <Button
              onClick={handleDeleteThought}
              variant="outline"
              style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
            >
              <Trash2 style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
              Delete
            </Button>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.5rem', marginLeft: 'auto' }}>
              <Button
                onClick={handleStartThought}
                variant="outline"
                style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
              >
                <ArrowRight style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
                Start This Task
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
                disabled={!editingText.trim() || typeof onUpdateThought !== 'function'}
                style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}
              >
                <Save style={{ width: 16, height: 16, marginRight: '0.25rem' }} />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
