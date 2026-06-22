import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Checkbox } from './ui/Checkbox';
import { Button } from './ui/Button';
import FocusHeroCard from './FocusHeroCard';
import {
  getActiveTask,
  getNextUnfinishedTask,
  getPlanOverflowItems,
  hasTaskPlanStructure,
  normalizeTaskPlan,
} from '../utils/taskPlan';

const COMPLETION_BUFFER_MS = 1800;

function getPlanItemKey(item) {
  return `${item?.type || 'item'}:${item?.id || ''}`;
}

export default function RunningTaskPlan({
  task,
  timerText,
  controls,
  taskPlan,
  onLockedInteraction,
  onSubtaskToggle,
  onNextTaskToggle,
  showCompletionPrompt = false,
  onMarkComplete,
  onKeepGoing,
  onLayoutChange,
}) {
  const [overflowPinned, setOverflowPinned] = useState(false);
  const [pendingCompletionKeys, setPendingCompletionKeys] = useState([]);
  const completionTimersRef = useRef(new Map());
  const plan = normalizeTaskPlan(taskPlan, task);
  const activeTask = getActiveTask(plan);
  const nextTask = getNextUnfinishedTask(plan);
  const { visible, overflow } = getPlanOverflowItems(plan, 3);
  const structured = hasTaskPlanStructure(plan);
  const layoutSignature = useMemo(() => JSON.stringify(plan), [plan]);

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
  }, [layoutSignature, onLayoutChange, overflowPinned, pendingCompletionKeys, showCompletionPrompt]);

  useEffect(() => () => {
    completionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    completionTimersRef.current.clear();
  }, []);

  const renderPlanItem = (item, { overflowItem = false } = {}) => {
    const key = getPlanItemKey(item);
    const isSubtask = item.type === 'subtask';
    const label = isSubtask ? item.title : `Next: ${item.title}`;
    const checkboxId = `running-plan${overflowItem ? '-overflow' : ''}-${item.type}-${item.id}`;
    const pending = pendingCompletionKeys.includes(key);
    const checked = item.completed || pending;

    return (
      <div
        key={key}
        className={`${overflowItem ? 'running-plan__overflow-item' : `running-plan__item running-plan__item--${item.type}`}${item.completed ? ' is-complete' : ''}${pending ? ' is-pending' : ''}`}
      >
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(nextChecked) => handleItemToggle(item, nextChecked)}
        />
        <label htmlFor={checkboxId} className="running-plan__item-label">
          <span>{label}</span>
        </label>
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

  return (
    <div className="running-plan">
      <FocusHeroCard
        task={task}
        timerText={timerText}
        controls={controls}
        onLockedInteraction={onLockedInteraction}
      >
        {structured ? (
          <div className="running-plan__details electron-no-drag" data-testid="running-task-plan">
            <div className="running-plan__list">
              {visible.map((item) => renderPlanItem(item))}
              {nextTask && !visible.some((item) => item.type === 'next' && item.id === nextTask.id) ? (
                <button
                  type="button"
                  className="running-plan__next-chip"
                  onClick={() => setOverflowPinned((prev) => !prev)}
                  aria-expanded={overflowPinned}
                >
                  Next: {nextTask.title}
                </button>
              ) : null}
              {overflow.length ? (
                <button
                  type="button"
                  className="running-plan__overflow-btn"
                  onClick={() => setOverflowPinned((prev) => !prev)}
                  onFocus={() => setOverflowPinned(true)}
                  data-testid="running-plan-overflow"
                  aria-expanded={overflowPinned}
                >
                  +{overflow.length} more
                </button>
              ) : null}
            </div>

            {overflowPinned && overflow.length ? (
              <div className="running-plan__overflow" data-testid="running-plan-overflow-popover">
                <div className="running-plan__overflow-title">More in this plan</div>
                {overflow.map((item) => renderPlanItem(item, { overflowItem: true }))}
              </div>
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
