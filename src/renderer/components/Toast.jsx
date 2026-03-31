import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { Button } from './ui/Button';

const TOAST_TYPES = {
  success: { icon: CheckCircle, className: 'toast-success' },
  warning: { icon: AlertCircle, className: 'toast-warning' },
  info: { icon: Info, className: 'toast-info' },
};

export default function Toast({ toast, onDismiss, placement = 'top-right' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismissRef.current();
    }, 300);
  }, []);

  useEffect(() => {
    if (toast) {
      setIsVisible(true);
      setIsExiting(false);

      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration || 2000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [toast, handleDismiss]);

  if (!toast || !isVisible) return null;

  const { icon: Icon, className } = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
  const showIcon = toast.showIcon !== false;
  const showCloseButton = toast.showCloseButton !== false;
  const isCentered = placement === 'pill-center' || placement === 'window-center';
  const hostZIndex = Number.isFinite(Number(toast.zIndex)) ? Number(toast.zIndex) : 50;
  const hostStyle = isCentered
    ? {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem',
        zIndex: hostZIndex,
        pointerEvents: 'none',
      }
    : {
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: hostZIndex,
      };
  const toastStyle = isCentered
    ? {
        maxWidth: 'min(24rem, calc(100% - 1rem))',
        pointerEvents: 'auto',
      }
    : undefined;

  return (
    <div style={hostStyle}>
      <div className={`toast ${className}${toast.source === 'checkin-success' ? ' toast-checkin' : ''} ${isExiting ? 'toast-exit' : 'toast-enter'}`} style={toastStyle}>
        {showIcon ? <Icon style={{ width: 20, height: 20, flexShrink: 0 }} /> : null}
        <p style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>{toast.message}</p>
        {showCloseButton ? (
          <Button
            onClick={handleDismiss}
            size="icon"
            variant="ghost"
            className="toast-close-btn"
            style={{ height: '1.5rem', width: '1.5rem', padding: 0 }}
          >
            <X style={{ width: 16, height: 16 }} strokeWidth={2.5} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
