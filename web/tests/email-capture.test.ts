import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEmailCaptureJourney,
  isEmailCaptureSource,
  isValidEmail,
  normalizeEmail,
} from '../src/lib/emailCapture.ts';

test('normalizeEmail trims and lowercases emails', () => {
  assert.equal(normalizeEmail('  Hello@Example.COM '), 'hello@example.com');
});

test('isValidEmail accepts standard email addresses', () => {
  assert.equal(isValidEmail('founder@focana.app'), true);
  assert.equal(isValidEmail('not-an-email'), false);
});

test('isEmailCaptureSource only accepts supported sources', () => {
  assert.equal(isEmailCaptureSource('exit-intent'), true);
  assert.equal(isEmailCaptureSource('beta-download'), false);
});

test('buildEmailCaptureJourney appends new sources without duplicating history', () => {
  const journey = buildEmailCaptureJourney(
    {
      source: 'exit-intent',
      source_history: ['exit-intent'],
    },
    'checkout-started'
  );

  assert.deepEqual(journey, {
    source: 'exit-intent,checkout-started',
    sourceHistory: ['exit-intent', 'checkout-started'],
  });
});

test('buildEmailCaptureJourney tolerates legacy comma-separated source values', () => {
  const journey = buildEmailCaptureJourney(
    {
      source: 'exit-intent,newsletter-cta',
      source_history: null,
    },
    'newsletter-cta'
  );

  assert.deepEqual(journey, {
    source: 'exit-intent,newsletter-cta',
    sourceHistory: ['exit-intent', 'newsletter-cta'],
  });
});
