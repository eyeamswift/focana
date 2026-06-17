import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const taskPlanPath = path.resolve('src/renderer/utils/taskPlan.js');

async function loadTaskPlanModule() {
  if (!vm.SourceTextModule) {
    throw new Error('Run task-plan tests with node --experimental-vm-modules.');
  }

  const source = await readFile(taskPlanPath, 'utf8');
  const module = new vm.SourceTextModule(source, {
    identifier: pathToFileURL(taskPlanPath).href,
  });
  await module.link(() => {
    throw new Error('taskPlan.js should not import external modules.');
  });
  await module.evaluate();
  return module.namespace;
}

const taskPlan = await loadTaskPlanModule();

test('normalizes legacy task text into a one-item task plan', () => {
  const plan = taskPlan.normalizeTaskPlan(null, 'Write proposal');

  assert.equal(plan.version, 1);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].title, 'Write proposal');
  assert.equal(plan.items[0].completed, false);
  assert.equal(plan.items[0].subtasks.length, 0);
  assert.equal(plan.activeTaskId, plan.items[0].id);
});

test('prepares a task plan for start by syncing the active title and trimming empty rows', () => {
  const plan = taskPlan.prepareTaskPlanForStart({
    activeTaskId: 'task-1',
    items: [
      {
        id: 'task-1',
        title: 'Old title',
        completed: false,
        subtasks: [
          { id: 'subtask-1', title: ' Draft outline ', completed: false },
          { id: 'subtask-empty', title: '   ', completed: false },
        ],
      },
      { id: 'task-empty', title: '   ', completed: false, subtasks: [] },
      { id: 'task-2', title: 'Review metrics', completed: false, subtasks: [] },
    ],
  }, 'Launch email');

  assert.equal(plan.items.length, 2);
  assert.equal(plan.activeTaskId, 'task-1');
  assert.equal(plan.items[0].title, 'Launch email');
  assert.deepEqual(plan.items[0].subtasks.map((subtask) => subtask.title), ['Draft outline']);
  assert.equal(plan.items[1].title, 'Review metrics');
});

test('counts only titled active subtasks and unfinished next-up tasks in summaries', () => {
  const plan = {
    activeTaskId: 'task-1',
    items: [
      {
        id: 'task-1',
        title: 'Prepare launch email',
        completed: false,
        subtasks: [
          { id: 'subtask-1', title: 'Draft subject line', completed: false },
          { id: 'subtask-empty', title: ' ', completed: false },
        ],
      },
      { id: 'task-2', title: 'Update Product Hunt checklist', completed: false, subtasks: [] },
      { id: 'task-3', title: 'Completed old task', completed: true, subtasks: [] },
    ],
  };

  assert.equal(taskPlan.getTaskPlanSummary(plan), '1 subtask - 1 next-up task');
  assert.equal(taskPlan.getCompactTaskPlanSummary(plan), '1 subtask - 1 next');
  assert.deepEqual(
    taskPlan.getCompactTaskPlanDetails(plan).map((item) => item.label),
    ['Draft subject line', 'Next: Update Product Hunt checklist'],
  );
  assert.equal(taskPlan.getNextUnfinishedTask(plan).id, 'task-2');
});

test('detects all-subtasks completion and completes the active top-level task', () => {
  const initialPlan = {
    activeTaskId: 'task-1',
    items: [
      {
        id: 'task-1',
        title: 'Prepare launch email',
        completed: false,
        subtasks: [
          { id: 'subtask-1', title: 'Draft subject line', completed: false },
          { id: 'subtask-2', title: 'Polish hero copy', completed: false },
        ],
      },
      { id: 'task-2', title: 'Queue founder post', completed: false, subtasks: [] },
    ],
  };

  const partiallyDone = taskPlan.toggleSubtask(initialPlan, 'subtask-1', true);
  assert.equal(taskPlan.shouldPromptForActiveTaskCompletion(partiallyDone), false);

  const allSubtasksDone = taskPlan.toggleSubtask(partiallyDone, 'subtask-2', true);
  assert.equal(taskPlan.shouldPromptForActiveTaskCompletion(allSubtasksDone), true);

  const completedPlan = taskPlan.setTaskCompleted(allSubtasksDone, 'task-1', true);
  const activeTask = taskPlan.getActiveTask(completedPlan);
  assert.equal(activeTask.completed, true);
  assert.equal(activeTask.subtasks.every((subtask) => subtask.completed), true);
  assert.equal(taskPlan.getNextUnfinishedTask(completedPlan).id, 'task-2');
});
