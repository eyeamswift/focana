const TASK_PLAN_VERSION = 1;
const DEFAULT_ID_PREFIX = 'plan';

function trimTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEditableTitle(value, { trim = false } = {}) {
  if (typeof value !== 'string') return '';
  return trim ? value.trim() : value;
}

export function createTaskPlanId(prefix = DEFAULT_ID_PREFIX) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCompletedAt(value, completed) {
  if (!completed) return null;
  return typeof value === 'string' && value.trim() ? value : new Date().toISOString();
}

function normalizeSubtask(rawSubtask, index = 0, { trimEmpty = false } = {}) {
  const title = normalizeEditableTitle(rawSubtask?.title, { trim: trimEmpty });
  if (!trimTitle(rawSubtask?.title) && trimEmpty) return null;
  const completed = rawSubtask?.completed === true;
  return {
    id: typeof rawSubtask?.id === 'string' && rawSubtask.id.trim()
      ? rawSubtask.id
      : createTaskPlanId(`subtask-${index}`),
    title,
    completed,
    completedAt: normalizeCompletedAt(rawSubtask?.completedAt, completed),
  };
}

function normalizeItem(rawItem, index = 0, options = {}) {
  const { trimEmpty = false } = options;
  const title = normalizeEditableTitle(rawItem?.title, { trim: trimEmpty });
  if (!trimTitle(rawItem?.title) && trimEmpty) return null;
  const completed = rawItem?.completed === true;
  const subtasks = Array.isArray(rawItem?.subtasks)
    ? rawItem.subtasks.map((subtask, subtaskIndex) => normalizeSubtask(subtask, subtaskIndex, options)).filter(Boolean)
    : [];
  return {
    id: typeof rawItem?.id === 'string' && rawItem.id.trim()
      ? rawItem.id
      : createTaskPlanId(`task-${index}`),
    title,
    completed,
    completedAt: normalizeCompletedAt(rawItem?.completedAt, completed),
    subtasks,
  };
}

export function createTaskPlanFromTitle(title = '') {
  const safeTitle = trimTitle(title);
  const id = createTaskPlanId('task');
  return {
    version: TASK_PLAN_VERSION,
    activeTaskId: id,
    activeSubtaskId: null,
    items: safeTitle ? [{
      id,
      title: safeTitle,
      completed: false,
      completedAt: null,
      subtasks: [],
    }] : [],
  };
}

export function normalizeTaskPlan(rawPlan, fallbackTitle = '', options = {}) {
  const { trimEmpty = false } = options;
  const fallback = trimTitle(fallbackTitle);
  const rawItems = Array.isArray(rawPlan?.items) ? rawPlan.items : [];
  let items = rawItems.map((item, index) => normalizeItem(item, index, { trimEmpty })).filter(Boolean);

  if (!items.length && fallback) {
    return createTaskPlanFromTitle(fallback);
  }

  if (!items.length) {
    return {
      version: TASK_PLAN_VERSION,
      activeTaskId: null,
      activeSubtaskId: null,
      items: [],
    };
  }

  const rawActiveTaskId = typeof rawPlan?.activeTaskId === 'string' ? rawPlan.activeTaskId : '';
  const activeExists = items.some((item) => item.id === rawActiveTaskId);
  const firstUnfinished = items.find((item) => !item.completed);
  const activeTaskId = activeExists ? rawActiveTaskId : (firstUnfinished?.id || items[0].id);
  const activeTask = items.find((item) => item.id === activeTaskId) || items[0] || null;
  const rawActiveSubtaskId = typeof rawPlan?.activeSubtaskId === 'string' ? rawPlan.activeSubtaskId : '';
  const activeSubtaskExists = (activeTask?.subtasks || []).some((subtask) => (
    subtask.id === rawActiveSubtaskId && subtask.completed !== true && trimTitle(subtask.title)
  ));

  return {
    version: TASK_PLAN_VERSION,
    activeTaskId,
    activeSubtaskId: activeSubtaskExists ? rawActiveSubtaskId : null,
    items,
  };
}

export function syncActiveTaskTitle(rawPlan, title) {
  const safeTitle = trimTitle(title);
  const plan = normalizeTaskPlan(rawPlan, safeTitle);
  if (!safeTitle) return plan;
  if (!plan.items.length) return createTaskPlanFromTitle(safeTitle);
  return {
    ...plan,
    items: plan.items.map((item, index) => (
      item.id === plan.activeTaskId || (!plan.activeTaskId && index === 0)
        ? { ...item, title: safeTitle }
        : item
    )),
  };
}

export function prepareTaskPlanForStart(rawPlan, title) {
  const synced = syncActiveTaskTitle(rawPlan, title);
  return normalizeTaskPlan(synced, title, { trimEmpty: true });
}

export function getActiveTask(rawPlan) {
  const plan = normalizeTaskPlan(rawPlan);
  return plan.items.find((item) => item.id === plan.activeTaskId) || plan.items[0] || null;
}

export function getActiveSubtask(rawPlan) {
  const plan = normalizeTaskPlan(rawPlan);
  if (!plan.activeSubtaskId) return null;
  const active = getActiveTask(plan);
  return (active?.subtasks || []).find((subtask) => (
    subtask.id === plan.activeSubtaskId && subtask.completed !== true && trimTitle(subtask.title)
  )) || null;
}

export function getNextUnfinishedTask(rawPlan) {
  const plan = normalizeTaskPlan(rawPlan);
  return plan.items.find((item) => item.id !== plan.activeTaskId && !item.completed) || null;
}

export function getIncompleteTopLevelTasks(rawPlan) {
  const plan = normalizeTaskPlan(rawPlan);
  return plan.items.filter((item) => !item.completed);
}

export function hasTaskPlanStructure(rawPlan) {
  const plan = normalizeTaskPlan(rawPlan);
  const active = getActiveTask(plan);
  const titledSubtasks = (active?.subtasks || []).filter((subtask) => trimTitle(subtask.title));
  return Boolean(titledSubtasks.length > 0 || plan.items.some((item) => item.id !== plan.activeTaskId && trimTitle(item.title)));
}

export function getTaskPlanSummary(rawPlan) {
  const plan = normalizeTaskPlan(rawPlan);
  const active = getActiveTask(plan);
  const subtaskCount = (active?.subtasks || []).filter((subtask) => trimTitle(subtask.title)).length;
  const nextCount = plan.items.filter((item) => item.id !== plan.activeTaskId && !item.completed && trimTitle(item.title)).length;

  if (!subtaskCount && !nextCount) return 'Optional steps and next-up tasks';
  const subtaskLabel = subtaskCount === 0
    ? 'No subtasks'
    : `${subtaskCount} ${subtaskCount === 1 ? 'subtask' : 'subtasks'}`;
  const nextLabel = nextCount === 0
    ? 'no next-up tasks'
    : `${nextCount} next-up ${nextCount === 1 ? 'task' : 'tasks'}`;
  return `${subtaskLabel} - ${nextLabel}`;
}

export function addSubtask(rawPlan, title = '') {
  const plan = normalizeTaskPlan(rawPlan);
  const active = getActiveTask(plan);
  if (!active) return plan;
  const nextSubtask = {
    id: createTaskPlanId('subtask'),
    title,
    completed: false,
    completedAt: null,
  };
  return {
    ...plan,
    items: plan.items.map((item) => (
      item.id === active.id
        ? { ...item, subtasks: [...(item.subtasks || []), nextSubtask] }
        : item
    )),
  };
}

export function updateSubtaskTitle(rawPlan, subtaskId, title) {
  const plan = normalizeTaskPlan(rawPlan);
  return {
    ...plan,
    items: plan.items.map((item) => ({
      ...item,
      subtasks: (item.subtasks || []).map((subtask) => (
        subtask.id === subtaskId ? { ...subtask, title } : subtask
      )),
    })),
  };
}

export function removeSubtask(rawPlan, subtaskId) {
  const plan = normalizeTaskPlan(rawPlan);
  return {
    ...plan,
    activeSubtaskId: plan.activeSubtaskId === subtaskId ? null : plan.activeSubtaskId,
    items: plan.items.map((item) => ({
      ...item,
      subtasks: (item.subtasks || []).filter((subtask) => subtask.id !== subtaskId),
    })),
  };
}

export function addNextTask(rawPlan, title = '') {
  const plan = normalizeTaskPlan(rawPlan);
  return {
    ...plan,
    items: [
      ...plan.items,
      {
        id: createTaskPlanId('task'),
        title,
        completed: false,
        completedAt: null,
        subtasks: [],
      },
    ],
  };
}

export function updateTaskTitle(rawPlan, taskId, title) {
  const plan = normalizeTaskPlan(rawPlan);
  return {
    ...plan,
    items: plan.items.map((item) => (
      item.id === taskId ? { ...item, title } : item
    )),
  };
}

export function removeTask(rawPlan, taskId) {
  const plan = normalizeTaskPlan(rawPlan);
  const items = plan.items.filter((item) => item.id !== taskId);
  return normalizeTaskPlan({ ...plan, items, activeTaskId: plan.activeTaskId }, '');
}

export function toggleSubtask(rawPlan, subtaskId, checked) {
  const plan = normalizeTaskPlan(rawPlan);
  const completed = checked === true;
  return {
    ...plan,
    activeSubtaskId: completed && plan.activeSubtaskId === subtaskId ? null : plan.activeSubtaskId,
    items: plan.items.map((item) => ({
      ...item,
      subtasks: (item.subtasks || []).map((subtask) => (
        subtask.id === subtaskId
          ? { ...subtask, completed, completedAt: normalizeCompletedAt(null, completed) }
          : subtask
      )),
    })),
  };
}

export function setTaskCompleted(rawPlan, taskId, checked = true) {
  const plan = normalizeTaskPlan(rawPlan);
  const completed = checked === true;
  return {
    ...plan,
    activeSubtaskId: completed && taskId === plan.activeTaskId ? null : plan.activeSubtaskId,
    items: plan.items.map((item) => (
      item.id === taskId
        ? {
          ...item,
          completed,
          completedAt: normalizeCompletedAt(null, completed),
          subtasks: completed
            ? (item.subtasks || []).map((subtask) => ({
              ...subtask,
              completed: true,
              completedAt: normalizeCompletedAt(subtask.completedAt, true),
            }))
            : item.subtasks,
        }
        : item
    )),
  };
}

export function setActiveTask(rawPlan, taskId) {
  const plan = normalizeTaskPlan(rawPlan);
  if (!plan.items.some((item) => item.id === taskId)) return plan;
  return { ...plan, activeTaskId: taskId, activeSubtaskId: null };
}

export function setActiveSubtask(rawPlan, subtaskId) {
  const plan = normalizeTaskPlan(rawPlan);
  const targetId = typeof subtaskId === 'string' ? subtaskId : '';
  if (!targetId) return { ...plan, activeSubtaskId: null };
  const active = getActiveTask(plan);
  const activeSubtask = (active?.subtasks || []).find((subtask) => (
    subtask.id === targetId && subtask.completed !== true && trimTitle(subtask.title)
  ));
  if (!activeSubtask) return plan;
  return { ...plan, activeSubtaskId: activeSubtask.id };
}

export function shouldPromptForActiveTaskCompletion(rawPlan) {
  const active = getActiveTask(rawPlan);
  if (!active || active.completed) return false;
  const subtasks = (active.subtasks || []).filter((subtask) => trimTitle(subtask.title));
  return subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);
}

export function getPlanOverflowItems(rawPlan, visibleLimit = 3) {
  const plan = normalizeTaskPlan(rawPlan);
  const active = getActiveTask(plan);
  const subtasks = (active?.subtasks || [])
    .filter((subtask) => trimTitle(subtask.title))
    .map((subtask) => ({ ...subtask, type: 'subtask', active: subtask.id === plan.activeSubtaskId }));
  const nextTasks = plan.items
    .filter((item) => item.id !== plan.activeTaskId && !item.completed && trimTitle(item.title))
    .map((item) => ({ ...item, type: 'next' }));
  const allItems = [...subtasks, ...nextTasks];
  return {
    visible: allItems.slice(0, visibleLimit),
    overflow: allItems.slice(visibleLimit),
    allItems,
  };
}

export function getCompactTaskPlanSummary(rawPlan) {
  const plan = normalizeTaskPlan(rawPlan);
  const active = getActiveTask(plan);
  const incompleteSubtasks = (active?.subtasks || []).filter((subtask) => !subtask.completed && trimTitle(subtask.title)).length;
  const nextCount = plan.items.filter((item) => item.id !== plan.activeTaskId && !item.completed && trimTitle(item.title)).length;
  if (!incompleteSubtasks && !nextCount) return '';
  const parts = [];
  if (incompleteSubtasks) parts.push(`${incompleteSubtasks} ${incompleteSubtasks === 1 ? 'subtask' : 'subtasks'}`);
  if (nextCount) parts.push(`${nextCount} next`);
  return parts.join(' - ');
}

export function getCompactTaskPlanDetails(rawPlan) {
  const plan = normalizeTaskPlan(rawPlan);
  const active = getActiveTask(plan);
  const subtasks = (active?.subtasks || [])
    .filter((subtask) => trimTitle(subtask.title))
    .map((subtask) => ({
      id: subtask.id,
      type: 'subtask',
      title: subtask.title,
      label: subtask.title,
      completed: subtask.completed === true,
      active: subtask.id === plan.activeSubtaskId,
    }));
  const nextTasks = plan.items
    .filter((item) => item.id !== plan.activeTaskId && !item.completed && trimTitle(item.title))
    .map((item) => ({
      id: item.id,
      type: 'next',
      title: item.title,
      label: `Next: ${item.title}`,
      completed: item.completed === true,
    }));
  return [...subtasks, ...nextTasks];
}
