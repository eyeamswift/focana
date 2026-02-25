import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { Button } from "@/components/ui/button";

const TOAST_TYPES = {
  success: { icon: CheckCircle, className: 'border-green-200 bg-green-50 text-green-800' },
  warning: { icon: AlertCircle, className: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
  info: { icon: Info, className: 'border-blue-200 bg-blue-50 text-blue-800' }
};

export default function ToastNotification({ toast, onDismiss }) {
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
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`
          flex items-center gap-3 p-4 rounded-lg border shadow-lg max-w-sm
          transition-all duration-300 ease-out
          ${className}
          ${isExiting 
            ? 'opacity-0 transform translate-x-full' 
            : 'opacity-100 transform translate-x-0'
          }
        `}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">{toast.message}</p>
        <Button
          onClick={handleDismiss}
          size="icon"
          variant="ghost"
          className="h-6 w-6 p-0 hover:bg-black/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}