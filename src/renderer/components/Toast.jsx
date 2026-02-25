import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { Button } from './ui/Button';

const TOAST_TYPES = {
  success: { icon: CheckCircle, className: 'toast-success' },
  warning: { icon: AlertCircle, className: 'toast-warning' },
  info: { icon: Info, className: 'toast-info' },
};

export default function Toast({ toast, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300);
  }, [onDismiss]);

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

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 50 }}>
      <div className={`toast ${className} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
        <Icon style={{ width: 20, height: 20, flexShrink: 0 }} />
        <p style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>{toast.message}</p>
        <Button
          onClick={handleDismiss}
          size="icon"
          variant="ghost"
          style={{ height: '1.5rem', width: '1.5rem', padding: 0 }}
        >
          <X style={{ width: 16, height: 16 }} />
        </Button>
      </div>
    </div>
  );
}
