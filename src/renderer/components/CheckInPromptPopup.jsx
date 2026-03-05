import React from 'react';
import { createPortal } from 'react-dom';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from './ui/Button';

export default function CheckInPromptPopup({
  isOpen,
  onFocused,
  onDetour,
  variant = 'full',
}) {
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="checkin-popup-overlay electron-no-drag">
      <div className={`checkin-popup ${variant === 'compact' ? 'checkin-popup-compact' : 'checkin-popup-full'}`}>
        <h3 className="checkin-popup-title">Still focused?</h3>
        <div className="checkin-popup-actions">
          <Button
            variant="outline"
            onClick={onFocused}
            className="checkin-popup-btn"
            title="Still focused"
          >
            <ThumbsUp style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
            Yes
          </Button>
          <Button
            variant="outline"
            onClick={onDetour}
            className="checkin-popup-btn"
            title="Not focused"
          >
            <ThumbsDown style={{ width: 14, height: 14, marginRight: '0.35rem' }} />
            No
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
