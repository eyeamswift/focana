import React, { forwardRef } from 'react';

export const Textarea = forwardRef(({ className = '', ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={`textarea ${className}`}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';
