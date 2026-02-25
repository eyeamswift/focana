import React from 'react';

export function Button({
  children,
  variant = 'default',
  size = 'default',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  title,
  style,
  ...props
}) {
  const baseClass = 'btn';

  const variantClasses = {
    default: 'btn-primary',
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    outline: 'btn-outline',
  };

  const sizeClasses = {
    default: '',
    sm: 'btn-sm',
    icon: 'btn-icon',
  };

  const classes = [
    baseClass,
    variantClasses[variant] || variantClasses.default,
    sizeClasses[size] || '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={style}
      {...props}
    >
      {children}
    </button>
  );
}
