import { getFocusFactArticle, buildFocusFactEmailArticleUrl } from '../data/focusFacts.ts';
import { sendLoopsEvent } from './loops.ts';

export type FocusFactEmailRequest = {
  email: string;
  factId: string;
  requestId: string;
};

type SendEvent = typeof sendLoopsEvent;

function clampText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normalizeFocusFactEmailRequest(raw: unknown): FocusFactEmailRequest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const email = clampText(candidate.email, 320).toLowerCase();
  const factId = clampText(candidate.factId, 80);
  const requestId = clampText(candidate.requestId, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !factId || !requestId) return null;
  if (!getFocusFactArticle(factId)) return null;
  return { email, factId, requestId };
}

export async function sendFocusFactArticleEmail({
  request,
  loopsApiKey,
  sendEvent = sendLoopsEvent,
}: {
  request: FocusFactEmailRequest;
  loopsApiKey: string;
  sendEvent?: SendEvent;
}) {
  const article = getFocusFactArticle(request.factId);
  if (!article) throw new Error('Unknown Focus Fact');
  if (!loopsApiKey) throw new Error('Email provider is not configured');

  const articleUrl = buildFocusFactEmailArticleUrl(article);
  await sendEvent(loopsApiKey, {
    email: request.email,
    eventName: 'focus_fact_article_requested',
    focusFactId: request.factId,
    articleTitle: article.articleTitle,
    articleUrl,
    consentScope: 'one_time_article',
    marketingConsent: false,
  }, {
    idempotencyKey: `focus-fact:${request.requestId}`,
  });

  return { accepted: true, articleUrl };
}
