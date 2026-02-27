import React, { forwardRef } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CornerDownLeft } from 'lucide-react';

const TaskInput = forwardRef(({
  task,
  setTask,
  isActive,
  isLocked = false,
  onFocus,
  onBlur,
  onTaskSubmit,
  onLockedInteraction,
}, ref) => {
  const showSubmitButton = task.trim() && !isActive;

  const handleLockedInteraction = () => {
    if (isLocked) onLockedInteraction?.();
  };

  const handleMouseDown = (e) => {
    if (!isLocked) return;
    e.preventDefault();
    handleLockedInteraction();
  };

  const handleFocus = (e) => {
    if (!isLocked) {
      onFocus?.(e);
      return;
    }
    handleLockedInteraction();
    e.target.blur();
  };

  const handleKeyDown = (e) => {
    if (isLocked) {
      e.preventDefault();
      handleLockedInteraction();
      return;
    }

    if (e.key === 'Enter' && task.trim()) {
      e.preventDefault();
      onTaskSubmit();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 460 }}>
      <Input
        ref={ref}
        value={task}
        onChange={(e) => {
          if (isLocked) return;
          setTask(e.target.value);
        }}
        onMouseDown={handleMouseDown}
        onFocus={handleFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder="Type your task here and hit Enter/Return"
        maxLength={120}
        readOnly={isLocked}
        style={{
          width: '100%',
          textAlign: 'left',
          fontSize: task.trim() ? '1.125rem' : '1rem',
          padding: showSubmitButton ? '0.75rem 3.5rem 0.75rem 1rem' : '0.75rem 1rem',
          height: '3rem',
          borderWidth: 2,
          borderColor: isActive ? '#D97706' : 'rgba(139, 111, 71, 0.3)',
          background: '#FFFEF8',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#5C4033',
          transition: 'all 0.3s',
          boxShadow: isActive ? '0 4px 6px -1px rgba(0,0,0,0.1), 0 0 0 2px rgba(217,119,6,0.2)' : 'none',
        }}
      />
      {showSubmitButton && (
        <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                onClick={onTaskSubmit}
                aria-label="Start session"
                style={{
                  height: '2.25rem',
                  width: '2.25rem',
                  borderRadius: '0.5rem',
                  background: '#F59E0B',
                  color: 'white',
                }}
              >
                <CornerDownLeft style={{ width: 20, height: 20 }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Start Session</p></TooltipContent>
          </Tooltip>
        </span>
      )}
    </div>
  );
});

TaskInput.displayName = 'TaskInput';

export default TaskInput;
