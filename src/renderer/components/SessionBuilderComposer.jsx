import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
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
  onQuickStart,
}) {
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [nextTasksExpanded, setNextTasksExpanded] = useState(false);
  const subtaskInputRefs = useRef(new Map());
  const nextInputRefs = useRef(new Map());
  const pendingFocusRef = useRef(null);
  const primaryTitle = typeof primaryTask === 'string' ? primaryTask : '';
  const plan = syncActiveTaskTitle(normalizeTaskPlan(taskPlan, primaryTitle), primaryTitle);
  const activeTask = getActiveTask(plan);
  const subtasks = activeTask?.subtasks || [];
  const nextTasks = plan.items.filter((item) => item.id !== plan.activeTaskId);
  const hasSubtaskOverflow = subtasks.length > 3;
  const hasNextTaskOverflow = nextTasks.length > 3;
  const visibleSubtasks = subtasks;
  const visibleNextTasks = nextTasks;
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
  }, [layoutSignature, nextTasksExpanded, onLayoutChange, subtasksExpanded]);

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current;
    if (!pendingFocus) return;

    const inputMap = pendingFocus.kind === 'next' ? nextInputRefs.current : subtaskInputRefs.current;
    const items = pendingFocus.kind === 'next' ? nextTasks : subtasks;
    const targetId = pendingFocus.id || items[items.length - 1]?.id || '';
    const input = targetId ? inputMap.get(targetId) : null;
    if (!input) return;

    pendingFocusRef.current = null;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [layoutSignature, nextTasks, subtasks]);

  const updatePlan = (nextPlan) => {
    onTaskPlanChange?.(syncActiveTaskTitle(nextPlan, primaryTitle));
  };

  const handleAddSubtask = () => {
    if (!canAddStructure) return;
    pendingFocusRef.current = { kind: 'subtask' };
    if (subtasks.length >= 3) setSubtasksExpanded(true);
    updatePlan(addSubtask(plan, ''));
  };

  const handleAddNextTask = () => {
    if (!canAddStructure) return;
    pendingFocusRef.current = { kind: 'next' };
    if (nextTasks.length >= 3) setNextTasksExpanded(true);
    updatePlan(addNextTask(plan, ''));
  };

  const handleQuickStart = () => {
    if (!canAddStructure) return;
    onQuickStart?.();
  };

  const renderSubtaskActions = () => (
    <div className="session-builder__action-row">
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
      {onQuickStart ? (
        <Button
          type="button"
          className="session-builder__add-btn session-builder__quick-start-btn"
          onClick={handleQuickStart}
          disabled={!canAddStructure}
          data-testid="session-builder-quick-start"
        >
          <Play size={13} />
          Quick start
        </Button>
      ) : null}
    </div>
  );

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
                {renderSubtaskActions()}
              </div>
            ) : (
              <div className="session-builder__section-header session-builder__section-header--subtasks">
                {renderSubtaskActions()}
              </div>
            )}
            {subtasks.length ? (
              <>
                <div className={`session-builder__rows${hasSubtaskOverflow ? ' is-scrollable' : ''}${hasSubtaskOverflow && subtasksExpanded ? ' is-expanded' : ''}`} data-testid="session-builder-subtask-list">
                  {visibleSubtasks.map((subtask, index) => (
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
                {hasSubtaskOverflow ? (
                  <button
                    type="button"
                    className="session-builder__view-all"
                    onClick={() => setSubtasksExpanded((prev) => !prev)}
                    data-testid="session-builder-view-all-subtasks"
                    aria-expanded={subtasksExpanded}
                  >
                    {subtasksExpanded ? 'Show less' : `View all (${subtasks.length})`}
                  </button>
                ) : null}
              </>
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
              <>
                <div className={`session-builder__rows${hasNextTaskOverflow ? ' is-scrollable' : ''}${hasNextTaskOverflow && nextTasksExpanded ? ' is-expanded' : ''}`} data-testid="session-builder-next-list">
                  {visibleNextTasks.map((item, index) => (
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
                {hasNextTaskOverflow ? (
                  <button
                    type="button"
                    className="session-builder__view-all"
                    onClick={() => setNextTasksExpanded((prev) => !prev)}
                    data-testid="session-builder-view-all-next"
                    aria-expanded={nextTasksExpanded}
                  >
                    {nextTasksExpanded ? 'Show less' : `View all (${nextTasks.length})`}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
