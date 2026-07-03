import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const focusRhythmPath = path.resolve('src/renderer/utils/focusRhythm.js');

async function loadFocusRhythmModule() {
  if (!vm.SourceTextModule) {
    throw new Error('Run focus-rhythm tests with node --experimental-vm-modules.');
  }

  const source = await readFile(focusRhythmPath, 'utf8');
  const module = new vm.SourceTextModule(source, {
    identifier: pathToFileURL(focusRhythmPath).href,
  });
  await module.link(() => {
    throw new Error('focusRhythm.js should not import external modules.');
  });
  await module.evaluate();
  return module.namespace;
}

const rhythm = await loadFocusRhythmModule();

test('normalizes timer modes and treats Pomodoro as countdown', () => {
  assert.equal(rhythm.normalizeTimerMode('timed'), 'timed');
  assert.equal(rhythm.normalizeTimerMode('pomodoro'), 'pomodoro');
  assert.equal(rhythm.normalizeTimerMode('unexpected'), 'freeflow');
  assert.equal(rhythm.isCountdownMode('timed'), true);
  assert.equal(rhythm.isCountdownMode('pomodoro'), true);
  assert.equal(rhythm.isCountdownMode('freeflow'), false);
});

test('clamps Pomodoro work and break lengths independently', () => {
  assert.deepEqual(
    rhythm.normalizePomodoroConfig({ workMinutes: '0', breakMinutes: '999' }),
    { workMinutes: 1, breakMinutes: 120 },
  );
  assert.deepEqual(
    rhythm.normalizePomodoroConfig({ workMinutes: 'abc', breakMinutes: null }),
    { workMinutes: 25, breakMinutes: 5 },
  );
});

test('suppresses long-session nudges during Pomodoro and blockers', () => {
  assert.equal(rhythm.shouldShowLongSessionNudge({
    mode: 'timed',
    elapsedSeconds: rhythm.LONG_SESSION_NUDGE_SECONDS,
  }), true);
  assert.equal(rhythm.shouldShowLongSessionNudge({
    mode: 'pomodoro',
    elapsedSeconds: rhythm.LONG_SESSION_NUDGE_SECONDS * 2,
  }), false);
  assert.equal(rhythm.shouldShowLongSessionNudge({
    mode: 'timed',
    elapsedSeconds: rhythm.LONG_SESSION_NUDGE_SECONDS,
    dnd: true,
  }), false);
  assert.equal(rhythm.shouldShowLongSessionNudge({
    mode: 'timed',
    elapsedSeconds: rhythm.LONG_SESSION_NUDGE_SECONDS,
    activeTextEntry: true,
  }), false);
});

test('honors active-focus snooze target for long-session nudges', () => {
  assert.equal(rhythm.shouldShowLongSessionNudge({
    mode: 'freeflow',
    elapsedSeconds: rhythm.LONG_SESSION_NUDGE_SECONDS + 30,
    snoozeUntilElapsed: rhythm.LONG_SESSION_NUDGE_SECONDS + rhythm.LONG_SESSION_NUDGE_SNOOZE_SECONDS,
  }), false);
  assert.equal(rhythm.shouldShowLongSessionNudge({
    mode: 'freeflow',
    elapsedSeconds: rhythm.LONG_SESSION_NUDGE_SECONDS + rhythm.LONG_SESSION_NUDGE_SNOOZE_SECONDS,
    snoozeUntilElapsed: rhythm.LONG_SESSION_NUDGE_SECONDS + rhythm.LONG_SESSION_NUDGE_SNOOZE_SECONDS,
  }), true);
});
