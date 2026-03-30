import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';
import { CornerDownLeft } from 'lucide-react';
import { track } from '../utils/analytics';

const TaskInput = forwardRef(({
  task,
  setTask,
  isActive,
  visualState = 'draft',
  eyebrowText = '',
  helperText = '',
  isLocked = false,
  checkInPromptActive = false,
  checkInCelebrating = false,
  checkInCelebrationType = 'none',
  onFocus,
  onBlur,
  onTaskSubmit,
  onLockedInteraction,
  onHeightChange,
}, ref) => {
  const textareaRef = useRef(null);
  const wasPastedRef = useRef(false);
  const showSubmitButton = task.trim() && !isActive;
  const hasText = task.trim().length > 0;
  const MIN_INPUT_HEIGHT = 48;
  const MAX_INPUT_HEIGHT = 120;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const nextHeight = Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
    onHeightChange?.(nextHeight);
  }, [onHeightChange]);

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

  const submitTask = (rawTask) => {
    const nextTask = typeof rawTask === 'string'
      ? rawTask
      : (textareaRef.current?.value || task);
    const trimmedTask = nextTask.trim();
    if (!trimmedTask) return;

    track('task_entered', { input_method: wasPastedRef.current ? 'paste' : 'typed', char_count: trimmedTask.length });
    wasPastedRef.current = false;
    onTaskSubmit(nextTask);
  };

  const handleKeyDown = (e) => {
    if (isLocked) {
      e.preventDefault();
      handleLockedInteraction();
      return;
    }

    const currentValue = e.currentTarget?.value || task;
    if (e.key === 'Enter' && currentValue.trim()) {
      e.preventDefault();
      submitTask(currentValue);
    }
  };

  const wrapperClasses = [
    'task-composer',
    `task-composer--${visualState}`,
    hasText ? 'task-composer--has-text' : '',
    isActive ? 'task-composer--active' : '',
    checkInPromptActive ? 'task-composer--prompting' : '',
    checkInCelebrating ? `task-composer--celebrating task-composer--celebrating-${checkInCelebrationType}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {(eyebrowText || helperText) && (
        <div className="task-composer__meta">
          {eyebrowText ? <span className="task-composer__eyebrow">{eyebrowText}</span> : <span />}
          {visualState === 'paused' ? (
            <span className="task-composer__status">Resume ready</span>
          ) : null}
        </div>
      )}
      <div className="task-composer__field">
        <textarea
          ref={(node) => {
            textareaRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          className="task-composer__textarea"
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
          tabIndex={1}
          rows={1}
        />
        {showSubmitButton && (
          <span className="task-composer__submit-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="task-composer__submit"
                  onClick={() => submitTask(textareaRef.current?.value || task)}
                  aria-label="Start session"
                >
                  <CornerDownLeft style={{ width: 20, height: 20 }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Start Session</p></TooltipContent>
            </Tooltip>
          </span>
        )}
      </div>
      {helperText ? <p className="task-composer__helper">{helperText}</p> : null}
    </div>
  );
});

TaskInput.displayName = 'TaskInput';

export default TaskInput;
