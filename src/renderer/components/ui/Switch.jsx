import React from 'react';

export function Switch({ checked = false, onCheckedChange, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      className={`switch ${className}`}
      onClick={() => onCheckedChange?.(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  );
}
