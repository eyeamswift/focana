import React from 'react';

export function Switch({ checked = false, onCheckedChange, className = '', disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      aria-disabled={disabled}
      data-state={checked ? 'checked' : 'unchecked'}
      className={`switch ${className}`}
      onClick={() => {
        if (disabled) return;
        onCheckedChange?.(!checked);
      }}
    >
      <span className="switch-thumb" />
    </button>
  );
}
