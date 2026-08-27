import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTrialDownloadNotificationPayload } from '../src/lib/trialDownloadNotification.ts';

test('free-trial notification goes to the owner with download details', () => {
  const payload = buildTrialDownloadNotificationPayload({
    betaDownloadId: 'beta-download-123',
    downloadEmail: 'new-user@example.com',
    submittedAt: '2026-08-27T22:00:00.000Z',
  });

  assert.deepEqual(payload, {
    email: 'hello@focana.app',
    eventName: 'free_trial_downloaded',
    eventProperties: {
      downloadEmail: 'new-user@example.com',
      betaDownloadId: 'beta-download-123',
      submittedAt: '2026-08-27T22:00:00.000Z',
    },
  });
});
