import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Checkbox } from './ui/Checkbox';
import { Button } from './ui/Button';
import FocusHeroCard from './FocusHeroCard';
import {
  addNextTask,
  addSubtask,
  getActiveTask,
  getPlanOverflowItems,
  hasTaskPlanStructure,
  normalizeTaskPlan,
  removeSubtask,
  removeTask,
  syncActiveTaskTitle,
  updateSubtaskTitle,
  updateTaskTitle,
} from '../utils/taskPlan';

const COMPLETION_BUFFER_MS = 1800;

function getPlanItemKey(item) {
  return `${item?.type || 'item'}:${item?.id || ''}`;
}

export default function RunningTaskPlan({
  task,
  displayTask,
  timerText,
  controls,
  taskPlan,
  onLockedInteraction,
  onSubtaskToggle,
  onSubtaskFocus,
  onNextTaskToggle,
  onTaskPlanChange,
  showCompletionPrompt = false,
  onMarkComplete,
  onKeepGoing,
  onLayoutChange,
  builderOpenSignal = 0,
}) {
  const [builderExpanded, setBuilderExpanded] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [pendingCompletionKeys, setPendingCompletionKeys] = useState([]);
  const completionTimersRef = useRef(new Map());
  const subtaskInputRefs = useRef(new Map());
  const nextInputRefs = useRef(new Map());
  const pendingFocusRef = useRef(null);
  const plan = normalizeTaskPlan(taskPlan, task);
  const displayTaskLabel = typeof displayTask === 'string' ? displayTask : task;
  const activeTask = getActiveTask(plan);
  const { allItems } = getPlanOverflowItems(plan, 3);
  const structured = hasTaskPlanStructure(plan);
  const canEditPlan = typeof onTaskPlanChange === 'function';
  const editableItems = useMemo(() => {
    const subtasks = (activeTask?.subtasks || []).map((subtask) => ({
      ...subtask,
      type: 'subtask',
      active: subtask.id === plan.activeSubtaskId,
    }));
    const nextTasks = plan.items
      .filter((item) => item.id !== plan.activeTaskId && !item.completed)
      .map((item) => ({ ...item, type: 'next' }));
    return [...subtasks, ...nextTasks];
  }, [activeTask?.subtasks, plan.activeSubtaskId, plan.activeTaskId, plan.items]);
  const planListItems = canEditPlan ? editableItems : allItems;
  const activePlanListItems = useMemo(() => (
    planListItems.filter((item) => !item.completed || pendingCompletionKeys.includes(getPlanItemKey(item)))
  ), [pendingCompletionKeys, planListItems]);
  const completedPlanItemCount = planListItems.length - activePlanListItems.length;
  const visibleItems = viewAllOpen ? planListItems : activePlanListItems;
  const hasListOverflow = visibleItems.length > 3;
  const hasHiddenCompletedItems = !viewAllOpen && completedPlanItemCount > 0;
  const canToggleListExpansion = hasHiddenCompletedItems || hasListOverflow || viewAllOpen;
  const listToggleLabel = viewAllOpen
    ? 'Show less'
    : hasHiddenCompletedItems
      ? `Show completed (${completedPlanItemCount})`
      : `View all (${planListItems.length})`;
  const layoutSignature = useMemo(() => JSON.stringify(plan), [plan]);
  useEffect(() => {
    if (!builderOpenSignal) return;
    setBuilderExpanded(true);
  }, [builderOpenSignal]);

  useEffect(() => {
    if (!builderExpanded) setViewAllOpen(false);
  }, [builderExpanded]);

  const clearPendingCompletion = useCallback((key) => {
    const timer = completionTimersRef.current.get(key);
    if (timer) window.clearTimeout(timer);
    completionTimersRef.current.delete(key);
    setPendingCompletionKeys((prev) => prev.filter((itemKey) => itemKey !== key));
  }, []);

  const schedulePendingCompletion = useCallback((item) => {
    if (!item?.id || item.completed) return;
    const key = getPlanItemKey(item);
    clearPendingCompletion(key);
    setPendingCompletionKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));

    const timer = window.setTimeout(() => {
      completionTimersRef.current.delete(key);
      if (item.type === 'subtask') {
        onSubtaskToggle?.(item.id, true);
      } else {
        onNextTaskToggle?.(item.id, true);
      }
      setPendingCompletionKeys((prev) => prev.filter((itemKey) => itemKey !== key));
    }, COMPLETION_BUFFER_MS);
    completionTimersRef.current.set(key, timer);
  }, [clearPendingCompletion, onNextTaskToggle, onSubtaskToggle]);

  const handleItemToggle = useCallback((item, checked) => {
    const key = getPlanItemKey(item);
    if (checked) {
      schedulePendingCompletion(item);
      return;
    }

    if (pendingCompletionKeys.includes(key)) {
      clearPendingCompletion(key);
      return;
    }

    if (item.type === 'subtask') {
      onSubtaskToggle?.(item.id, false);
    } else {
      onNextTaskToggle?.(item.id, false);
    }
  }, [clearPendingCompletion, onNextTaskToggle, onSubtaskToggle, pendingCompletionKeys, schedulePendingCompletion]);

  useEffect(() => {
    const resizeTimer = window.setTimeout(() => {
      onLayoutChange?.();
    }, 20);
    return () => window.clearTimeout(resizeTimer);
  }, [builderExpanded, layoutSignature, onLayoutChange, pendingCompletionKeys, showCompletionPrompt, viewAllOpen]);

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current;
    if (!pendingFocus) return;

    const inputMap = pendingFocus.kind === 'next' ? nextInputRefs.current : subtaskInputRefs.current;
    const items = pendingFocus.kind === 'next'
      ? plan.items.filter((item) => item.id !== plan.activeTaskId)
      : (activeTask?.subtasks || []);
    const targetId = pendingFocus.id || items[items.length - 1]?.id || '';
    const input = targetId ? inputMap.get(targetId) : null;
    if (!input) return;

    pendingFocusRef.current = null;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [activeTask?.subtasks, layoutSignature, plan.activeTaskId, plan.items]);

  useEffect(() => () => {
    completionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    completionTimersRef.current.clear();
  }, []);

  const updatePlan = useCallback((nextPlan) => {
    onTaskPlanChange?.(syncActiveTaskTitle(nextPlan, task));
  }, [onTaskPlanChange, task]);

  const handleAddSubtask = useCallback(() => {
    if (!canEditPlan) return;
    pendingFocusRef.current = { kind: 'subtask' };
    if (editableItems.length >= 3) setViewAllOpen(true);
    updatePlan(addSubtask(plan, ''));
  }, [canEditPlan, editableItems.length, plan, updatePlan]);

  const handleAddNextTask = useCallback(() => {
    if (!canEditPlan) return;
    pendingFocusRef.current = { kind: 'next' };
    if (editableItems.length >= 3) setViewAllOpen(true);
    updatePlan(addNextTask(plan, ''));
  }, [canEditPlan, editableItems.length, plan, updatePlan]);

  const handlePlanInputKeyDown = useCallback((event, item) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (item.type === 'next') {
      handleAddNextTask();
      return;
    }
    handleAddSubtask();
  }, [handleAddNextTask, handleAddSubtask]);

  const renderPlanItem = (item, { overflowItem = false } = {}) => {
    const key = getPlanItemKey(item);
    const isSubtask = item.type === 'subtask';
    const label = isSubtask ? item.title : `Next: ${item.title}`;
    const checkboxId = `running-plan${overflowItem ? '-overflow' : ''}-${item.type}-${item.id}`;
    const pending = pendingCompletionKeys.includes(key);
    const checked = item.completed || pending;
    const isFocusedSubtask = isSubtask && item.id === plan.activeSubtaskId;
    const canFocusSubtask = isSubtask && !checked && typeof onSubtaskFocus === 'function';

    return (
      <div
        key={key}
        className={`${overflowItem ? 'running-plan__overflow-item' : `running-plan__item running-plan__item--${item.type}`}${item.completed ? ' is-complete' : ''}${pending ? ' is-pending' : ''}${isFocusedSubtask ? ' is-active-focus' : ''}`}
      >
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(nextChecked) => handleItemToggle(item, nextChecked)}
        />
        <label htmlFor={checkboxId} className="running-plan__item-label">
          <span>{label}</span>
        </label>
        {canFocusSubtask ? (
          <button
            type="button"
            className="running-plan__focus-btn"
            onClick={() => onSubtaskFocus?.(item.id)}
            disabled={isFocusedSubtask}
            aria-label={isFocusedSubtask ? `${label} is the visible focus` : `Focus ${label}`}
            title={isFocusedSubtask ? 'Visible focus' : 'Focus this step'}
            data-testid="running-plan-subtask-focus"
          >
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ) : null}
        {pending ? (
          <button
            type="button"
            className="running-plan__undo-btn"
            onClick={() => clearPendingCompletion(key)}
            aria-label={`Undo completing ${label}`}
            data-testid="running-plan-pending-completion"
          >
            Undo
          </button>
        ) : null}
      </div>
    );
  };

  const renderEditablePlanItem = (item, { overflowItem = false } = {}) => {
    const key = getPlanItemKey(item);
    const isSubtask = item.type === 'subtask';
    const inputId = `running-plan-edit${overflowItem ? '-overflow' : ''}-${item.type}-${item.id}`;
    const checkboxId = `running-plan${overflowItem ? '-overflow' : ''}-${item.type}-${item.id}`;
    const pending = pendingCompletionKeys.includes(key);
    const checked = item.completed || pending;
    const itemLabel = isSubtask ? 'Subtask' : 'Next-up task';
    const isFocusedSubtask = isSubtask && item.id === plan.activeSubtaskId;
    const canFocusSubtask = isSubtask && !checked && typeof onSubtaskFocus === 'function';

    return (
      <div
        key={key}
        className={`${overflowItem ? 'running-plan__overflow-item' : `running-plan__item running-plan__item--${item.type}`} running-plan__item--editable${item.completed ? ' is-complete' : ''}${pending ? ' is-pending' : ''}${isFocusedSubtask ? ' is-active-focus' : ''}`}
      >
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(nextChecked) => handleItemToggle(item, nextChecked)}
          aria-label={item.title || itemLabel}
          data-testid={isSubtask ? 'running-plan-subtask-checkbox' : 'running-plan-next-checkbox'}
        />
        <label htmlFor={inputId} className="sr-only">
          {itemLabel}
        </label>
        <input
          id={inputId}
          ref={(node) => {
            const inputMap = isSubtask ? subtaskInputRefs.current : nextInputRefs.current;
            if (node) inputMap.set(item.id, node);
            else inputMap.delete(item.id);
          }}
          className="running-plan__item-input"
          value={item.title}
          placeholder={isSubtask ? 'Subtask' : 'Next-up task'}
          data-testid={isSubtask ? 'running-plan-subtask-input' : 'running-plan-next-input'}
          onChange={(event) => {
            updatePlan(isSubtask
              ? updateSubtaskTitle(plan, item.id, event.target.value)
              : updateTaskTitle(plan, item.id, event.target.value));
          }}
          onKeyDown={(event) => handlePlanInputKeyDown(event, item)}
        />
        {canFocusSubtask ? (
          <button
            type="button"
            className="running-plan__focus-btn"
            onClick={() => onSubtaskFocus?.(item.id)}
            disabled={isFocusedSubtask}
            aria-label={isFocusedSubtask ? `${item.title || itemLabel} is the visible focus` : `Focus ${item.title || itemLabel}`}
            title={isFocusedSubtask ? 'Visible focus' : 'Focus this step'}
            data-testid="running-plan-subtask-focus"
          >
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ) : null}
        {pending ? (
          <button
            type="button"
            className="running-plan__undo-btn"
            onClick={() => clearPendingCompletion(key)}
            aria-label={`Undo completing ${item.title || itemLabel}`}
            data-testid="running-plan-pending-completion"
          >
            Undo
          </button>
        ) : null}
        <button
          type="button"
          className="running-plan__delete-btn"
          onClick={() => {
            updatePlan(isSubtask ? removeSubtask(plan, item.id) : removeTask(plan, item.id));
          }}
          aria-label={`Remove ${item.title || itemLabel}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  const detailsVisible = structured || canEditPlan;
  const showBuilderBody = !canEditPlan || builderExpanded;

  return (
    <div className="running-plan">
      <FocusHeroCard
        task={displayTaskLabel}
        timerText={timerText}
        controls={controls}
        onLockedInteraction={onLockedInteraction}
      >
        {detailsVisible ? (
          <div className={`running-plan__details electron-no-drag${builderExpanded ? ' is-expanded' : ''}`} data-testid="running-task-plan">
            {canEditPlan ? (
              <button
                type="button"
                className="running-plan__builder-toggle"
                onClick={() => setBuilderExpanded((prev) => !prev)}
                aria-expanded={builderExpanded}
                data-testid="running-plan-builder-toggle"
              >
                <span className="running-plan__builder-toggle-copy">
                  <span className="running-plan__builder-toggle-label">Add/View subtasks or next-up tasks</span>
                </span>
                <ChevronDown className="running-plan__builder-toggle-icon" size={16} aria-hidden="true" />
              </button>
            ) : null}

            {showBuilderBody ? (
              <>
                {canEditPlan ? (
                  <div className="running-plan__edit-actions">
                    <button
                      type="button"
                      className="running-plan__add-btn"
                      onClick={handleAddSubtask}
                    >
                      <Plus size={13} />
                      Add subtask
                    </button>
                    <button
                      type="button"
                      className="running-plan__add-btn running-plan__add-btn--secondary"
                      onClick={handleAddNextTask}
                    >
                      <Plus size={13} />
                      Add next-up
                    </button>
                  </div>
                ) : null}
                <div className={`running-plan__list${hasListOverflow ? ' is-scrollable' : ''}${hasListOverflow && viewAllOpen ? ' is-expanded' : ''}`} data-testid="running-plan-list">
                  {visibleItems.map((item) => (canEditPlan ? renderEditablePlanItem(item) : renderPlanItem(item)))}
                </div>

                {canToggleListExpansion ? (
                  <div className="running-plan__list-footer">
                    <button
                      type="button"
                      className="running-plan__view-all-btn"
                      onClick={() => setViewAllOpen((prev) => !prev)}
                      data-testid="running-plan-view-all"
                      aria-expanded={viewAllOpen}
                    >
                      {listToggleLabel}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </FocusHeroCard>

      {showCompletionPrompt && activeTask ? (
        <div className="task-plan-complete-prompt electron-no-drag" data-testid="task-plan-complete-prompt">
          <div>
            <h2>Mark {activeTask.title} complete?</h2>
            <p>You checked off every subtask. Want to close this task, or keep it active for a final pass?</p>
          </div>
          <div className="task-plan-complete-prompt__actions">
            <Button type="button" onClick={onMarkComplete}>
              <Check size={15} />
              Mark complete
            </Button>
            <Button type="button" variant="outline" onClick={onKeepGoing}>
              Keep going
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TaskPlanTransitionPrompt({
  completedTask,
  nextTask,
  onContinue,
  onTakeBreak,
  onSaveLater,
}) {
  return (
    <section className="task-plan-transition electron-no-drag" data-testid="task-plan-transition">
      <div className="task-plan-transition__eyebrow">Nice work</div>
      <h2>{completedTask || 'This task'} is done.</h2>
      <p>Next up: <strong>{nextTask || 'your next task'}</strong></p>
      <div className="task-plan-transition__actions">
        <Button type="button" onClick={onContinue} data-testid="task-plan-continue-next">
          Continue with {nextTask}
          <ChevronRight size={16} />
        </Button>
        <Button type="button" variant="outline" onClick={onTakeBreak}>
          Take a break
        </Button>
        <Button type="button" variant="outline" onClick={onSaveLater}>
          Save and continue later
        </Button>
      </div>
    </section>
  );
}
