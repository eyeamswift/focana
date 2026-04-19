export const EMAIL_CAPTURE_SUBMITTED_KEY = 'focana_email_submitted';
export const EMAIL_CAPTURE_EMAIL_KEY = 'focana_email_address';
export const EXIT_INTENT_SESSION_KEY = 'focana_exit_intent_shown';
export const EXIT_INTENT_DISABLED_KEY = 'focana_exit_intent_disabled';

export const EMAIL_CAPTURE_SOURCES = [
  'exit-intent',
  'newsletter-cta',
  'checkout-started',
] as const;

export type EmailCaptureSource = (typeof EMAIL_CAPTURE_SOURCES)[number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ExistingJourney = {
  source?: string | null;
  source_history?: string[] | null;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return EMAIL_REGEX.test(normalizeEmail(value));
}

export function isEmailCaptureSource(value: unknown): value is EmailCaptureSource {
  return EMAIL_CAPTURE_SOURCES.includes(value as EmailCaptureSource);
}

function normalizeSourceList(values: Array<string | null | undefined>) {
  const unique = new Set<EmailCaptureSource>();

  for (const value of values) {
    if (!value) continue;

    for (const segment of value.split(',')) {
      const normalized = segment.trim();
      if (isEmailCaptureSource(normalized)) {
        unique.add(normalized);
      }
    }
  }

  return Array.from(unique);
}

export function buildEmailCaptureJourney(
  existing: ExistingJourney | null | undefined,
  incomingSource: EmailCaptureSource
) {
  const existingHistory = Array.isArray(existing?.source_history)
    ? existing.source_history
    : [];

  const sourceHistory = normalizeSourceList([
    ...existingHistory,
    existing?.source || null,
    incomingSource,
  ]);

  return {
    sourceHistory,
    source: sourceHistory.join(','),
  };
}
