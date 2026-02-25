import React, { forwardRef } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CornerDownLeft } from 'lucide-react';

const TaskInput = forwardRef(({
  task,
  setTask,
  isActive,
  onFocus,
  onTaskSubmit,
}, ref) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && task.trim()) {
      e.preventDefault();
      onTaskSubmit();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
      <Input
        ref={ref}
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        placeholder="Type in your task and hit Enter"
        maxLength={120}
        style={{
          width: '100%',
          textAlign: 'left',
          fontSize: '1.125rem',
          padding: '0.75rem 3.5rem 0.75rem 1rem',
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
      {task.trim() && !isActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              onClick={onTaskSubmit}
              aria-label="Start session"
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
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
      )}
    </div>
  );
});

TaskInput.displayName = 'TaskInput';

export default TaskInput;
