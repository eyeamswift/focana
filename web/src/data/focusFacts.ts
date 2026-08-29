export type FocusFactArticle = {
  factId: string;
  articleSlug: string;
  articleTitle: string;
};

export const focusFactArticles: FocusFactArticle[] = [
  'visible-cues-working-memory',
  'working-memory-active-desk',
  'returning-not-blocking',
  'environment-reduces-signals',
].map((factId) => ({
  factId,
  articleSlug: 'out-of-sight-out-of-mind-adhd',
  articleTitle: 'Out of Sight, Out of Mind: Why ADHD Brains Need Visible Focus Tools',
}));

export function getFocusFactArticle(factId: string) {
  return focusFactArticles.find((article) => article.factId === factId) || null;
}

export function buildFocusFactEmailArticleUrl(article: FocusFactArticle) {
  const params = new URLSearchParams({
    utm_source: 'focana_desktop',
    utm_medium: 'focus_fact_email',
    utm_campaign: 'post_session_focus_facts',
    utm_content: article.factId,
  });
  return `https://focana.app/blog/${article.articleSlug}?${params.toString()}`;
}
