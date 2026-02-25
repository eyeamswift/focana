import React from 'react';

export default function StatusBar({ task, isRunning, time, isMinimal = false, isTimerVisible }) {
  const getStatusText = () => {
    if (isTimerVisible && task) {
      return task;
    }
    return '';
  };

  const getStatusColor = () => {
    if (isRunning) return '#D97706'; // Deep amber when active
    if (isTimerVisible && task) return '#F59E0B'; // Primary yellow when ready
    return '#8B6F47'; // Coffee brown when idle
  };

  const statusText = getStatusText();
  if (!statusText) return null;

  return (
    <div className={`${isMinimal ? 'p-4' : 'mt-6 p-3'} bg-[#FFF9E6] rounded-lg border border-[#8B6F47]/20`}>
      <div className="flex items-center justify-center">
        <span 
          className={`${isMinimal ? 'text-lg' : 'text-sm'} font-medium transition-colors duration-300 text-center`}
          style={{ color: getStatusColor() }}
        >
          {statusText}
        </span>
      </div>
    </div>
  );
}