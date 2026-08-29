const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeFocusFactEmailRequest,
  requestFocusFactEmail,
} = require('../src/main/focusFactEmail');

test('desktop Focus Fact email contract excludes session and marketing fields', async () => {
  const requests = [];
  const result = await requestFocusFactEmail({
    email: ' Reader@Example.com ',
    factId: 'visible-cues-working-memory',
    requestId: 'focus-fact-request-1',
    taskText: 'private task',
    subscribe: true,
  }, {
    endpointUrl: 'https://example.test/focus-fact-email',
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ accepted: true }), { status: 200 });
    },
  });

  assert.deepEqual(result, { ok: true, accepted: true });
  assert.deepEqual(requests, [{
    email: 'reader@example.com',
    factId: 'visible-cues-working-memory',
    requestId: 'focus-fact-request-1',
  }]);
});

test('desktop Focus Fact email request validates required fields and retry errors', async () => {
  assert.equal(normalizeFocusFactEmailRequest({ email: 'nope', factId: 'fact', requestId: 'id' }), null);
  await assert.rejects(
    () => requestFocusFactEmail({
      email: 'reader@example.com',
      factId: 'visible-cues-working-memory',
      requestId: 'request-2',
    }, {
      endpointUrl: 'https://example.test/focus-fact-email',
      fetchImpl: async () => new Response(JSON.stringify({ error: 'Try later.' }), { status: 502 }),
    }),
    /Try later/,
  );
});
