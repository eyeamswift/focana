import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import {
  addNextTask,
  addSubtask,
  getActiveTask,
  getTaskPlanSummary,
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
  onTaskPlanChange,
  onLayoutChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const primaryTitle = typeof primaryTask === 'string' ? primaryTask : '';
  const plan = syncActiveTaskTitle(normalizeTaskPlan(taskPlan, primaryTitle), primaryTitle);
  const activeTask = getActiveTask(plan);
  const nextTasks = plan.items.filter((item) => item.id !== plan.activeTaskId);
  const canAddStructure = primaryTitle.trim().length > 0;
  const summary = getTaskPlanSummary(plan);
  const layoutSignature = useMemo(() => JSON.stringify(plan), [plan]);

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
  }, [expanded, layoutSignature, onLayoutChange]);

  const updatePlan = (nextPlan, { open = false } = {}) => {
    onTaskPlanChange?.(syncActiveTaskTitle(nextPlan, primaryTitle));
    if (open) setExpanded(true);
  };

  const handleAddSubtask = () => {
    if (!canAddStructure) return;
    updatePlan(addSubtask(plan, ''), { open: true });
  };

  const handleAddNextTask = () => {
    if (!canAddStructure) return;
    updatePlan(addNextTask(plan, ''), { open: true });
  };

  return (
    <section className="session-builder electron-no-drag" data-testid="session-builder">
      <button
        type="button"
        className="session-builder__toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        data-testid="session-builder-toggle"
      >
        <span className="session-builder__toggle-main">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>Session Builder</span>
        </span>
        <span className="session-builder__summary">{summary}</span>
        <span className="session-builder__toggle-action">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded ? (
        <div className="session-builder__body">
          <div className="session-builder__section">
            <div className="session-builder__section-header">
              <span>Subtasks</span>
              <Button
                type="button"
                variant="outline"
                className="session-builder__add-btn"
                onClick={handleAddSubtask}
                disabled={!canAddStructure}
                data-testid="session-builder-add-subtask"
              >
                <Plus size={14} />
                Add subtask
              </Button>
            </div>
            {(activeTask?.subtasks || []).length ? (
              <div className="session-builder__rows">
                {activeTask.subtasks.map((subtask, index) => (
                  <div className="session-builder__row" key={subtask.id}>
                    <Input
                      value={subtask.title}
                      onChange={(event) => updatePlan(updateSubtaskTitle(plan, subtask.id, event.target.value))}
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
            ) : (
              <div className="session-builder__empty">
                <strong>No subtasks yet</strong>
                <span>Add smaller steps only if they would help you start.</span>
              </div>
            )}
          </div>

          <div className="session-builder__section">
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
                      value={item.title}
                      onChange={(event) => updatePlan(updateTaskTitle(plan, item.id, event.target.value))}
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
            ) : (
              <div className="session-builder__empty">
                <strong>No next-up tasks yet</strong>
                <span>Add one only if you already know what comes after this.</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
