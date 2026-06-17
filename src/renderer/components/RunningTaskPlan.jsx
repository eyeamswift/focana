import React, { useEffect, useMemo, useState } from 'react';
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
  const plan = normalizeTaskPlan(taskPlan, task);
  const activeTask = getActiveTask(plan);
  const nextTask = getNextUnfinishedTask(plan);
  const { visible, overflow } = getPlanOverflowItems(plan, 3);
  const structured = hasTaskPlanStructure(plan);
  const layoutSignature = useMemo(() => JSON.stringify(plan), [plan]);

  useEffect(() => {
    const resizeTimer = window.setTimeout(() => {
      onLayoutChange?.();
    }, 20);
    return () => window.clearTimeout(resizeTimer);
  }, [layoutSignature, onLayoutChange, overflowPinned, showCompletionPrompt]);

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
              {visible.map((item) => {
                const isSubtask = item.type === 'subtask';
                return (
                  <label
                    key={`${item.type}-${item.id}`}
                    className={`running-plan__item running-plan__item--${item.type}${item.completed ? ' is-complete' : ''}`}
                  >
                    <Checkbox
                      id={`running-plan-${item.type}-${item.id}`}
                      checked={item.completed}
                      onCheckedChange={(checked) => (
                        isSubtask ? onSubtaskToggle?.(item.id, checked) : onNextTaskToggle?.(item.id, checked)
                      )}
                    />
                    <span>{isSubtask ? item.title : `Next: ${item.title}`}</span>
                  </label>
                );
              })}
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
                {overflow.map((item) => {
                  const isSubtask = item.type === 'subtask';
                  return (
                    <label key={`${item.type}-${item.id}`} className="running-plan__overflow-item">
                      <Checkbox
                        id={`running-plan-overflow-${item.type}-${item.id}`}
                        checked={item.completed}
                        onCheckedChange={(checked) => (
                          isSubtask ? onSubtaskToggle?.(item.id, checked) : onNextTaskToggle?.(item.id, checked)
                        )}
                      />
                      <span>{isSubtask ? item.title : `Next: ${item.title}`}</span>
                    </label>
                  );
                })}
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
