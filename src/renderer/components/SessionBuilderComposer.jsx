import React, { useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import {
  addNextTask,
  addSubtask,
  getActiveTask,
  normalizeTaskPlan,
  removeSubtask,
  removeTask,
  syncActiveTaskTitle,
  updateSubtaskTitle,
  updateTaskTitle,
} from '../utils/taskPlan';

export default function SessionBuilderComposer({
  taskPlan,
  primaryTask = '',
  showPrimaryTask = false,
  sections = 'all',
  variant = 'standard',
  testId = 'session-builder',
  onTaskPlanChange,
  onLayoutChange,
}) {
  const subtaskInputRefs = useRef(new Map());
  const nextInputRefs = useRef(new Map());
  const pendingFocusRef = useRef(null);
  const primaryTitle = typeof primaryTask === 'string' ? primaryTask : '';
  const plan = syncActiveTaskTitle(normalizeTaskPlan(taskPlan, primaryTitle), primaryTitle);
  const activeTask = getActiveTask(plan);
  const nextTasks = plan.items.filter((item) => item.id !== plan.activeTaskId);
  const canAddStructure = primaryTitle.trim().length > 0;
  const layoutSignature = useMemo(() => JSON.stringify(plan), [plan]);
  const showSubtasks = sections === 'all' || sections === 'subtasks';
  const showNextTasks = sections === 'all' || sections === 'next';
  const builderClasses = [
    'session-builder',
    'electron-no-drag',
    (showPrimaryTask || variant === 'separate') ? 'session-builder--with-focus' : '',
    variant === 'embedded' ? 'session-builder--embedded' : '',
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (!primaryTitle.trim()) return;
    const synced = syncActiveTaskTitle(taskPlan, primaryTitle);
    if (JSON.stringify(synced) !== JSON.stringify(taskPlan)) {
      onTaskPlanChange?.(synced);
    }
  }, [onTaskPlanChange, primaryTitle, taskPlan]);

  useEffect(() => {
    const resizeTimer = window.setTimeout(() => {
      onLayoutChange?.();
    }, 20);
    return () => window.clearTimeout(resizeTimer);
  }, [layoutSignature, onLayoutChange]);

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current;
    if (!pendingFocus) return;

    const inputMap = pendingFocus.kind === 'next' ? nextInputRefs.current : subtaskInputRefs.current;
    const items = pendingFocus.kind === 'next' ? nextTasks : (activeTask?.subtasks || []);
    const targetId = pendingFocus.id || items[items.length - 1]?.id || '';
    const input = targetId ? inputMap.get(targetId) : null;
    if (!input) return;

    pendingFocusRef.current = null;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [activeTask?.subtasks, layoutSignature, nextTasks]);

  const updatePlan = (nextPlan) => {
    onTaskPlanChange?.(syncActiveTaskTitle(nextPlan, primaryTitle));
  };

  const handleAddSubtask = () => {
    if (!canAddStructure) return;
    pendingFocusRef.current = { kind: 'subtask' };
    updatePlan(addSubtask(plan, ''));
  };

  const handleAddNextTask = () => {
    if (!canAddStructure) return;
    pendingFocusRef.current = { kind: 'next' };
    updatePlan(addNextTask(plan, ''));
  };

  const handleSubtaskKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    handleAddSubtask();
  };

  const handleNextTaskKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    handleAddNextTask();
  };

  return (
    <section className={builderClasses} data-testid={testId}>
      <div className="session-builder__body">
        {showSubtasks ? (
          <div className="session-builder__section session-builder__section--subtasks">
            {showPrimaryTask ? (
              <div className="session-builder__focus-header">
                <div className="session-builder__focus-copy">
                  <span className="session-builder__focus-label">Focusing on:</span>
                  <span className="session-builder__focus-title">{primaryTitle || 'Untitled task'}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="session-builder__add-btn session-builder__add-btn--primary"
                  onClick={handleAddSubtask}
                  disabled={!canAddStructure}
                  data-testid="session-builder-add-subtask"
                >
                  <Plus size={14} />
                  Add subtask
                </Button>
              </div>
            ) : (
              <div className="session-builder__section-header session-builder__section-header--subtasks">
                <Button
                  type="button"
                  variant="outline"
                  className="session-builder__add-btn session-builder__add-btn--primary"
                  onClick={handleAddSubtask}
                  disabled={!canAddStructure}
                  data-testid="session-builder-add-subtask"
                >
                  <Plus size={14} />
                  Add subtask
                </Button>
              </div>
            )}
            {(activeTask?.subtasks || []).length ? (
              <div className="session-builder__rows">
                {activeTask.subtasks.map((subtask, index) => (
                  <div className="session-builder__row" key={subtask.id}>
                    <Input
                      ref={(node) => {
                        if (node) subtaskInputRefs.current.set(subtask.id, node);
                        else subtaskInputRefs.current.delete(subtask.id);
                      }}
                      value={subtask.title}
                      onChange={(event) => updatePlan(updateSubtaskTitle(plan, subtask.id, event.target.value))}
                      onKeyDown={handleSubtaskKeyDown}
                      placeholder={`Subtask ${index + 1}`}
                      className="session-builder__input"
                      data-testid="session-builder-subtask-input"
                    />
                    <button
                      type="button"
                      className="session-builder__icon-btn"
                      onClick={() => updatePlan(removeSubtask(plan, subtask.id))}
                      aria-label="Remove subtask"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {showNextTasks ? (
          <div className="session-builder__section session-builder__section--next">
            <div className="session-builder__section-header">
              <span>Next-up tasks</span>
              <Button
                type="button"
                variant="outline"
                className="session-builder__add-btn"
                onClick={handleAddNextTask}
                disabled={!canAddStructure}
                data-testid="session-builder-add-next"
              >
                <Plus size={14} />
                Add task
              </Button>
            </div>
            {nextTasks.length ? (
              <div className="session-builder__rows">
                {nextTasks.map((item, index) => (
                  <div className="session-builder__row" key={item.id}>
                    <Input
                      ref={(node) => {
                        if (node) nextInputRefs.current.set(item.id, node);
                        else nextInputRefs.current.delete(item.id);
                      }}
                      value={item.title}
                      onChange={(event) => updatePlan(updateTaskTitle(plan, item.id, event.target.value))}
                      onKeyDown={handleNextTaskKeyDown}
                      placeholder={`Next task ${index + 1}`}
                      className="session-builder__input"
                      data-testid="session-builder-next-input"
                    />
                    <button
                      type="button"
                      className="session-builder__icon-btn"
                      onClick={() => updatePlan(removeTask(plan, item.id))}
                      aria-label="Remove next-up task"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
