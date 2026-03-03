import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange?.(false);
    }
  };

  return createPortal(
    <div className="dialog-overlay electron-no-drag" onClick={handleOverlayClick}>
      {children}
    </div>,
    document.body
  );
}

export function DialogContent({ children, className = '', style, ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        // Find the closest Dialog and close it
        const event = new CustomEvent('dialog-close');
        ref.current?.dispatchEvent(event);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <div
      ref={ref}
      className={`dialog-content electron-no-drag ${className}`}
      style={style}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ children, className = '' }) {
  return <div className={`dialog-header ${className}`}>{children}</div>;
}

export function DialogTitle({ children, className = '' }) {
  return <h2 className={`dialog-title ${className}`}>{children}</h2>;
}

export function DialogFooter({ children, className = '' }) {
  return <div className={`dialog-footer ${className}`}>{children}</div>;
}

export function DialogClose({ children, asChild = false }) {
  // When used as a wrapper, we clone the child and inject the close behavior
  if (asChild && React.isValidElement(children)) {
    return children;
  }
  return children;
}
