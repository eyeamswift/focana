import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const focusFactsPath = path.resolve('src/renderer/utils/focusFacts.js');
const source = await readFile(focusFactsPath, 'utf8');
const module = new vm.SourceTextModule(source, {
  identifier: pathToFileURL(focusFactsPath).href,
});
await module.link(() => {
  throw new Error('focusFacts.js should not import external modules.');
});
await module.evaluate();

const {
  FOCUS_FACTS,
  applyFocusFactReaction,
  buildFocusFactArticleUrl,
  getLocalDateKey,
  selectFocusFactForDate,
} = module.namespace;

test('Focus Facts show once per local day and keep that day stable', () => {
  const morning = new Date(2026, 7, 28, 9, 0, 0);
  const afternoon = new Date(2026, 7, 28, 16, 0, 0);
  const first = selectFocusFactForDate({}, morning);
  const second = selectFocusFactForDate(first.state, afternoon);

  assert.equal(getLocalDateKey(morning), '2026-08-28');
  assert.equal(first.reason, 'selected');
  assert.equal(first.fact?.id, FOCUS_FACTS[0].id);
  assert.equal(second.fact, null);
  assert.equal(second.reason, 'already-shown-today');
  assert.equal(second.state.dailyFactId, first.fact?.id);
});

test('Focus Facts cycle before repeating and remove disliked facts', () => {
  let state = {};
  const shown = [];
  for (let day = 1; day <= FOCUS_FACTS.length; day += 1) {
    const selection = selectFocusFactForDate(state, new Date(2026, 8, day, 9));
    shown.push(selection.fact?.id);
    state = selection.state;
  }

  assert.equal(new Set(shown).size, FOCUS_FACTS.length);

  state = applyFocusFactReaction(state, FOCUS_FACTS[0].id, 'down');
  for (let day = 5; day <= 12; day += 1) {
    const selection = selectFocusFactForDate(state, new Date(2026, 8, day, 9));
    assert.notEqual(selection.fact?.id, FOCUS_FACTS[0].id);
    state = selection.state;
  }
});

test('Focus Fact article URLs are external, mapped, and campaign tagged', () => {
  const url = new URL(buildFocusFactArticleUrl(FOCUS_FACTS[0].id));
  assert.equal(url.origin, 'https://focana.app');
  assert.equal(url.pathname, '/blog/out-of-sight-out-of-mind-adhd');
  assert.equal(url.searchParams.get('utm_source'), 'focana_desktop');
  assert.equal(url.searchParams.get('utm_medium'), 'focus_fact');
  assert.equal(url.searchParams.get('utm_content'), FOCUS_FACTS[0].id);
});
