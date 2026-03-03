import React from 'react';

export default function StatusBar({ task, isRunning, time, isMinimal = false, isTimerVisible }) {
  const getStatusText = () => {
    if (isTimerVisible && task) return task;
    return '';
  };

  const getStatusColor = () => {
    if (isRunning) return 'var(--brand-action)';
    if (isTimerVisible && task) return 'var(--brand-primary)';
    return 'var(--text-secondary)';
  };

  const statusText = getStatusText();
  if (!statusText) return null;

  return (
    <div
      className="status-bar"
      style={{
        marginTop: isMinimal ? 0 : '1.5rem',
        padding: isMinimal ? '1rem' : '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{
            fontSize: isMinimal ? '1.125rem' : '0.875rem',
            fontWeight: 500,
            transition: 'color 0.3s',
            textAlign: 'center',
            color: getStatusColor(),
          }}
        >
          {statusText}
        </span>
      </div>
    </div>
  );
}
