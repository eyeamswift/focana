import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const openDialogStack = [];
let nextDialogId = 1;

export function Dialog({ open, onOpenChange, children }) {
  const dialogIdRef = useRef(null);
  if (dialogIdRef.current === null) {
    dialogIdRef.current = nextDialogId++;
  }
  const dialogId = dialogIdRef.current;

  useEffect(() => {
    if (!open) return undefined;

    openDialogStack.push(dialogId);
    return () => {
      const index = openDialogStack.lastIndexOf(dialogId);
      if (index !== -1) openDialogStack.splice(index, 1);
    };
  }, [open, dialogId]);

  useEffect(() => {
    if (!open) return undefined;

    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      const isTopMost = openDialogStack[openDialogStack.length - 1] === dialogId;
      if (!isTopMost) return;
      onOpenChange?.(false);
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, dialogId, onOpenChange]);

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
  return (
    <div
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
