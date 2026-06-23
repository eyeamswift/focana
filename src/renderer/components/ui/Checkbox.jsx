import React from 'react';

export function Checkbox({ id, checked = false, onCheckedChange, onClick, className = '', ...props }) {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={() => onCheckedChange?.(!checked)}
      onClick={onClick}
      className={`checkbox ${className}`}
      {...props}
    />
  );
}
