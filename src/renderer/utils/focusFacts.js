export const FOCUS_FACTS = [
  {
    id: 'visible-cues-working-memory',
    text: 'A visible task cue can act like external working memory, keeping your chosen priority easier to find after attention shifts.',
    articleSlug: 'out-of-sight-out-of-mind-adhd',
    articleTitle: 'Out of Sight, Out of Mind: Why ADHD Brains Need Visible Focus Tools',
    sourceLabel: 'Focana guide · sources include CHADD',
  },
  {
    id: 'working-memory-active-desk',
    text: 'Working memory is the small mental workspace that holds information while you use it. Moving the task onto the screen can lighten that load.',
    articleSlug: 'out-of-sight-out-of-mind-adhd',
    articleTitle: 'Out of Sight, Out of Mind: Why ADHD Brains Need Visible Focus Tools',
    sourceLabel: 'Focana guide · sources include CHADD',
  },
  {
    id: 'returning-not-blocking',
    text: 'A helpful focus system does not have to prevent every detour. It can make the original task easier to return to when attention moves.',
    articleSlug: 'out-of-sight-out-of-mind-adhd',
    articleTitle: 'Out of Sight, Out of Mind: Why ADHD Brains Need Visible Focus Tools',
    sourceLabel: 'Focana guide · sourced reading',
  },
  {
    id: 'environment-reduces-signals',
    text: 'Reducing competing visual signals—and keeping one priority visible—can make the intended task easier to rediscover.',
    articleSlug: 'out-of-sight-out-of-mind-adhd',
    articleTitle: 'Out of Sight, Out of Mind: Why ADHD Brains Need Visible Focus Tools',
    sourceLabel: 'Focana guide · sourced reading',
  },
];

const FACT_IDS = new Set(FOCUS_FACTS.map((fact) => fact.id));

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeFocusFactsState(rawState) {
  const state = rawState && typeof rawState === 'object' && !Array.isArray(rawState)
    ? rawState
    : {};
  const dislikedFactIds = Array.isArray(state.dislikedFactIds)
    ? [...new Set(state.dislikedFactIds.filter((id) => FACT_IDS.has(id)))]
    : [];
  const cycleSeenFactIds = Array.isArray(state.cycleSeenFactIds)
    ? [...new Set(state.cycleSeenFactIds.filter((id) => FACT_IDS.has(id)))]
    : [];
  const reactions = state.reactions && typeof state.reactions === 'object' && !Array.isArray(state.reactions)
    ? Object.fromEntries(Object.entries(state.reactions).filter(([id, reaction]) => (
      FACT_IDS.has(id) && (reaction === 'up' || reaction === 'down')
    )))
    : {};
  const emailedFactIds = Array.isArray(state.emailedFactIds)
    ? [...new Set(state.emailedFactIds.filter((id) => FACT_IDS.has(id)))]
    : [];

  return {
    dailyDateKey: typeof state.dailyDateKey === 'string' ? state.dailyDateKey : '',
    dailyFactId: FACT_IDS.has(state.dailyFactId) ? state.dailyFactId : '',
    impressionDateKey: typeof state.impressionDateKey === 'string' ? state.impressionDateKey : '',
    cycleSeenFactIds,
    dislikedFactIds,
    reactions,
    emailedFactIds,
    email: typeof state.email === 'string' ? state.email.trim().slice(0, 320) : '',
  };
}

export function selectFocusFactForDate(rawState, date = new Date()) {
  const state = normalizeFocusFactsState(rawState);
  const dateKey = getLocalDateKey(date);

  if (state.impressionDateKey === dateKey) {
    return { fact: null, state, reason: 'already-shown-today' };
  }

  const eligibleFacts = FOCUS_FACTS.filter((fact) => !state.dislikedFactIds.includes(fact.id));
  if (eligibleFacts.length === 0) {
    return { fact: null, state, reason: 'all-disliked' };
  }

  let fact = state.dailyDateKey === dateKey
    ? eligibleFacts.find((candidate) => candidate.id === state.dailyFactId)
    : null;
  let cycleSeenFactIds = state.cycleSeenFactIds.filter((id) => (
    eligibleFacts.some((candidate) => candidate.id === id)
  ));

  if (!fact) {
    const unseenFacts = eligibleFacts.filter((candidate) => !cycleSeenFactIds.includes(candidate.id));
    if (unseenFacts.length === 0) cycleSeenFactIds = [];
    fact = eligibleFacts.find((candidate) => !cycleSeenFactIds.includes(candidate.id)) || eligibleFacts[0];
  }

  const nextState = {
    ...state,
    dailyDateKey: dateKey,
    dailyFactId: fact.id,
    impressionDateKey: dateKey,
    cycleSeenFactIds: [...new Set([...cycleSeenFactIds, fact.id])],
  };

  return { fact, state: nextState, reason: 'selected' };
}

export function applyFocusFactReaction(rawState, factId, reaction) {
  const state = normalizeFocusFactsState(rawState);
  if (!FACT_IDS.has(factId) || !['up', 'down'].includes(reaction)) return state;
  const dislikedFactIds = reaction === 'down'
    ? [...new Set([...state.dislikedFactIds, factId])]
    : state.dislikedFactIds.filter((id) => id !== factId);
  return {
    ...state,
    dislikedFactIds,
    reactions: { ...state.reactions, [factId]: reaction },
  };
}

export function buildFocusFactArticleUrl(factId, medium = 'focus_fact') {
  const fact = FOCUS_FACTS.find((candidate) => candidate.id === factId);
  if (!fact) return '';
  const params = new URLSearchParams({
    utm_source: 'focana_desktop',
    utm_medium: medium,
    utm_campaign: 'post_session_focus_facts',
    utm_content: fact.id,
  });
  return `https://focana.app/blog/${fact.articleSlug}?${params.toString()}`;
}
