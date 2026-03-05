import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { X } from 'lucide-react';
import { track } from '../utils/analytics';

export default function QuickCaptureModal({ isOpen, onClose, onSave }) {
  const [thought, setThought] = useState('');

  useEffect(() => {
    if (isOpen) {
      track('parking_lot_opened', { source: 'quick_capture' });
      setThought('');
      setTimeout(() => {
        const textarea = document.querySelector('[data-quick-capture-textarea]');
        if (textarea) textarea.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (thought.trim()) {
      onSave?.(thought.trim());
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
      <DialogContent style={{ background: 'var(--bg-surface)', borderColor: 'var(--brand-action)', maxWidth: '28rem' }}>
        <button className="dialog-close-btn" onClick={onClose} aria-label="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>
        <DialogHeader>
          <DialogTitle style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Quick Capture to Parking Lot
          </DialogTitle>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Capture a thought without losing focus</p>
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
            style={{ minHeight: 100, borderColor: 'var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'right' }}>
            {thought.length}/500 characters
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClose} variant="outline" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
            Cancel (Esc)
          </Button>
          <Button onClick={handleSave} disabled={!thought.trim()} style={{ background: 'var(--brand-primary)', color: 'var(--text-on-brand)' }}>
            Save to Parking Lot (Enter)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
