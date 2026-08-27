import { SITE_CONTACT_EMAIL } from '../data/site.ts';
import { sendLoopsEvent, type LoopsEventPayload } from './loops.ts';

type TrialDownloadNotificationInput = {
  betaDownloadId: string;
  downloadEmail: string;
  submittedAt?: string;
};

export function buildTrialDownloadNotificationPayload(
  input: TrialDownloadNotificationInput
): LoopsEventPayload {
  return {
    email: SITE_CONTACT_EMAIL,
    eventName: 'free_trial_downloaded',
    eventProperties: {
      downloadEmail: input.downloadEmail,
      betaDownloadId: input.betaDownloadId,
      submittedAt: input.submittedAt || new Date().toISOString(),
    },
  };
}

export async function notifyTrialDownloaded(
  loopsApiKey: string | undefined,
  input: TrialDownloadNotificationInput
) {
  await sendLoopsEvent(
    loopsApiKey,
    buildTrialDownloadNotificationPayload(input),
    { idempotencyKey: `free-trial-download-${input.betaDownloadId}` }
  );
}
