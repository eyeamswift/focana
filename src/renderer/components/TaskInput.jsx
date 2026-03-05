import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CornerDownLeft } from 'lucide-react';
import { track } from '../utils/analytics';

const TaskInput = forwardRef(({
  task,
  setTask,
  isActive,
  isLocked = false,
  checkInPromptActive = false,
  checkInCelebrating = false,
  checkInCelebrationType = 'none',
  onFocus,
  onBlur,
  onTaskSubmit,
  onLockedInteraction,
}, ref) => {
  const textareaRef = useRef(null);
  const wasPastedRef = useRef(false);
  const showSubmitButton = task.trim() && !isActive;
  const MIN_INPUT_HEIGHT = 48;
  const MAX_INPUT_HEIGHT = 120;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const nextHeight = Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [task, resizeTextarea]);

  useEffect(() => {
    window.addEventListener('resize', resizeTextarea);
    return () => window.removeEventListener('resize', resizeTextarea);
  }, [resizeTextarea]);

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

  const handlePaste = () => {
    wasPastedRef.current = true;
  };

  const handleKeyDown = (e) => {
    if (isLocked) {
      e.preventDefault();
      handleLockedInteraction();
      return;
    }

    if (e.key === 'Enter' && task.trim()) {
      e.preventDefault();
      track('task_entered', { input_method: wasPastedRef.current ? 'paste' : 'typed', char_count: task.trim().length });
      wasPastedRef.current = false;
      onTaskSubmit();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 460 }}>
      <textarea
        ref={(node) => {
          textareaRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        value={task}
        onChange={(e) => {
          if (isLocked) return;
          setTask(e.target.value);
        }}
        onMouseDown={handleMouseDown}
        onFocus={handleFocus}
        onBlur={onBlur}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        placeholder="Type your task here and hit Enter/Return"
        maxLength={120}
        readOnly={isLocked}
        rows={1}
        style={{
          width: '100%',
          textAlign: 'left',
          fontSize: task.trim() ? '1.125rem' : '1rem',
          padding: showSubmitButton ? '0.75rem 3.5rem 0.75rem 1rem' : '0.75rem 1rem',
          minHeight: '3rem',
          borderWidth: 2,
          borderStyle: 'solid',
          borderRadius: '0.625rem',
          borderColor: checkInPromptActive ? '#D97706' : (isActive ? 'var(--brand-action)' : 'var(--border-strong)'),
          background: 'var(--bg-surface)',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: 'var(--text-primary)',
          transition: 'all 0.5s ease',
          boxShadow: checkInCelebrating
            ? (checkInCelebrationType === 'completed'
              ? '0 0 0 3px rgba(245, 158, 11, 0.75), 0 0 20px rgba(245, 158, 11, 0.45)'
              : '0 0 0 2px rgba(245, 158, 11, 0.55)')
            : (checkInPromptActive
              ? '0 0 0 2px rgba(217, 119, 6, 0.35)'
              : (isActive ? '0 0 0 2px var(--focus-ring)' : 'none')),
          resize: 'none',
          overflow: 'hidden',
          lineHeight: 1.35,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      />
      {showSubmitButton && (
        <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                onClick={() => {
                  track('task_entered', { input_method: wasPastedRef.current ? 'paste' : 'typed', char_count: task.trim().length });
                  wasPastedRef.current = false;
                  onTaskSubmit();
                }}
                aria-label="Start session"
                style={{
                  height: '2.25rem',
                  width: '2.25rem',
                  borderRadius: '0.5rem',
                  background: 'var(--brand-primary)',
                  color: 'var(--text-on-brand)',
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
