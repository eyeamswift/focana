import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  normalizeFocusFactEmailRequest,
  sendFocusFactArticleEmail,
} from '../src/lib/focusFactEmail.ts';
import { focusFactArticles } from '../src/data/focusFacts.ts';

test('every Focus Fact maps to a substantial sourced Focana article', async () => {
  const blogSource = await readFile(new URL('../src/data/blog.ts', import.meta.url), 'utf8');
  for (const mapping of focusFactArticles) {
    const articleStart = blogSource.indexOf(`slug: '${mapping.articleSlug}'`);
    assert.ok(articleStart >= 0, `Missing article for ${mapping.factId}`);
    const articleEnd = blogSource.indexOf('relatedSlugs:', articleStart);
    const articleBlock = blogSource.slice(articleStart, articleEnd);
    assert.match(articleBlock, /sections:\s*\[/, `Article for ${mapping.factId} is too thin`);
    assert.match(articleBlock, /sources:\s*\[/, `Article for ${mapping.factId} has no sources`);
    assert.match(articleBlock, /label:\s*['"`]/, `Article for ${mapping.factId} has no source labels`);
  }
});

test('hosted Focus Fact email validates the mapped fact and sends a one-time event', async () => {
  const normalized = normalizeFocusFactEmailRequest({
    email: ' Reader@Example.com ',
    factId: 'visible-cues-working-memory',
    requestId: 'request-123',
    taskText: 'must not pass through',
    diagnosis: 'must not pass through',
  });
  assert.deepEqual(normalized, {
    email: 'reader@example.com',
    factId: 'visible-cues-working-memory',
    requestId: 'request-123',
  });

  const calls: unknown[][] = [];
  const result = await sendFocusFactArticleEmail({
    request: normalized!,
    loopsApiKey: 'loops-test-key',
    sendEvent: async (...args) => { calls.push(args); },
  });

  assert.equal(result.accepted, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'loops-test-key');
  assert.deepEqual(calls[0][2], { idempotencyKey: 'focus-fact:request-123' });
  assert.deepEqual(calls[0][1], {
    email: 'reader@example.com',
    eventName: 'focus_fact_article_requested',
    focusFactId: 'visible-cues-working-memory',
    articleTitle: 'Out of Sight, Out of Mind: Why ADHD Brains Need Visible Focus Tools',
    articleUrl: result.articleUrl,
    consentScope: 'one_time_article',
    marketingConsent: false,
  });
  const url = new URL(result.articleUrl);
  assert.equal(url.searchParams.get('utm_medium'), 'focus_fact_email');
});

test('hosted Focus Fact email rejects unknown facts, invalid email, and missing provider config', async () => {
  assert.equal(normalizeFocusFactEmailRequest({
    email: 'reader@example.com',
    factId: 'unknown-fact',
    requestId: 'request-1',
  }), null);
  assert.equal(normalizeFocusFactEmailRequest({
    email: 'invalid',
    factId: 'visible-cues-working-memory',
    requestId: 'request-1',
  }), null);

  await assert.rejects(() => sendFocusFactArticleEmail({
    request: {
      email: 'reader@example.com',
      factId: 'visible-cues-working-memory',
      requestId: 'request-1',
    },
    loopsApiKey: '',
  }), /not configured/);
});
