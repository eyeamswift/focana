import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { X } from 'lucide-react';

export default function QuickCaptureModal({ isOpen, onClose, onSave }) {
  const [thought, setThought] = useState('');

  useEffect(() => {
    if (isOpen) {
      setThought('');
      setTimeout(() => {
        const textarea = document.querySelector('[data-quick-capture-textarea]');
        if (textarea) textarea.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (thought.trim()) {
      // Save to thoughts in electron-store
      const thoughts = await window.electronAPI.storeGet('thoughts') || [];
      thoughts.push({ text: thought.trim(), completed: false });
      await window.electronAPI.storeSet('thoughts', thoughts);
      onSave();
      setThought('');
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ background: '#FFFEF8', borderColor: '#D97706', maxWidth: '28rem' }}>
        <button className="dialog-close-btn" onClick={onClose} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader>
          <DialogTitle style={{ fontSize: '1.125rem', fontWeight: 700, color: '#5C4033', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Quick Capture to Parking Lot
          </DialogTitle>
          <p style={{ fontSize: '0.875rem', color: '#8B6F47' }}>Capture a thought without losing focus</p>
        </DialogHeader>

        <div style={{ padding: '1rem 0' }}>
          <Textarea
            data-quick-capture-textarea
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind? Press Enter to save, Esc to cancel..."
            maxLength={500}
            className="no-resize"
            style={{ minHeight: 100, borderColor: 'rgba(139,111,71,0.3)', background: '#FFF9E6', color: '#5C4033' }}
          />
          <p style={{ fontSize: '0.75rem', color: '#8B6F47', marginTop: '0.25rem', textAlign: 'right' }}>
            {thought.length}/500 characters
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClose} variant="outline" style={{ borderColor: 'rgba(139,111,71,0.3)', color: '#8B6F47' }}>
            Cancel (Esc)
          </Button>
          <Button onClick={handleSave} disabled={!thought.trim()} style={{ background: '#F59E0B', color: 'white' }}>
            Save to Parking Lot (Enter)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
