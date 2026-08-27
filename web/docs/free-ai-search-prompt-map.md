# Free-First AI Search Prompt Map

Owner: Justin / Focana
Last updated: April 23, 2026

## Goal

Build a small prompt map from free sources only and use it to decide:

- what belongs on the homepage
- what belongs in the anchor article
- what the next 2 human-written articles should be

The rule:

- `Topic label` is for us
- `Search query` is what a person might type
- `LLM prompt` is how they might ask for help in ChatGPT, Perplexity, Gemini, or Claude

Do not publish the topic label just because it sounds SEO-friendly.

## Free sources used

- Current Focana homepage and anchor article
- Google Search Console and Bing Webmaster Tools
- Google search results in incognito
- Reddit phrasing from ADHD, ADHD programmers, and Mac app communities
- Manual prompting in ChatGPT, Perplexity, and Gemini

Optional free tier:

- Screaming Frog SEO Spider:
  - free up to 500 URLs
  - useful for canonicals, redirects, sitemap, noindex, and internal links

## Source signals observed

These are the strongest human-language signals seen so far:

- Product-intent phrases already in live search results:
  - `focus app for ADHD Mac`
  - `always on top timer Mac`
  - `native Mac focus app`
- Problem phrasing from Reddit:
  - `I forget what I'm doing every time I switch tabs or windows at work`
  - `I lose the thread every time I switch apps`
  - `I'm always late to work`
  - `I always think I still have time`
  - `one last thing before I leave`
- Explanatory phrasing that still sounds natural:
  - `out of sight out of mind ADHD`
  - `working memory ADHD adults`
  - `how to keep tasks visible for ADHD`

Important note:

- `ADHD time blindness at work` is still a useful internal label.
- It is not the best public-facing headline or core tracked phrase.

## Small prompt map

### 1. Product-intent

Priority: highest

Why it matters:

- closest to revenue
- strongest fit for homepage optimization

Best targets:

- Homepage
- Homepage comparison section
- FAQ and metadata

Search queries:

- `focus app for ADHD Mac`
- `best ADHD focus app for Mac`
- `always on top timer Mac`
- `Mac app that stays visible while I work`
- `native Mac focus app`
- `focus app that stays on top`

LLM prompts:

- `What's the best Mac app for ADHD focus that stays visible while I switch apps?`
- `Is there a Mac focus app that stays on top of other windows?`
- `I need a focus tool for Mac that doesn't disappear behind tabs.`

What to reinforce on-site:

- native Mac app
- always visible
- stays on top across apps
- built from first-hand ADHD experience

### 2. Losing-the-thread / tab-switching intent

Priority: highest

Why it matters:

- strongest bridge between user pain and Focana's product promise

Best targets:

- Anchor article
- Future article 2
- Homepage "why it feels different" section

Search queries:

- `why do I forget what I was doing when I switch tabs`
- `how to stay focused when switching between apps`
- `how to stop losing focus when switching windows`
- `how to remember what I was doing after switching apps`
- `app switching kills my focus`

LLM prompts:

- `Why do I forget what I was doing every time I switch tabs at work?`
- `How do I stay focused when I have to bounce between Slack, email, and my browser?`
- `I keep losing the thread when I switch windows. What actually helps?`

Best article angle:

- `Why do I forget what I was doing when I switch tabs?`

Secondary support phrases:

- `how to stay focused when switching between apps`
- `how to stop losing focus when switching windows`
- `how to remember what I was doing after switching apps`

### 3. Visible-focus / working-memory intent

Priority: medium-high

Why it matters:

- makes the product claim feel credible
- gives AI systems stronger explanatory content to cite

Best targets:

- Anchor article
- Homepage trust/problem framing

Search queries:

- `out of sight out of mind ADHD`
- `why do ADHD people forget tasks when they can't see them`
- `working memory ADHD adults`
- `how to keep tasks visible for ADHD`
- `ADHD visible reminders`

LLM prompts:

- `Why do I forget tasks the second they leave my screen?`
- `Is out of sight out of mind an ADHD thing?`
- `What helps ADHD brains keep a task active while working on a computer?`

What to do with this theme:

- keep it mostly explanatory
- use it to support product-intent and tab-switching pages
- do not let this become too academic or jargon-heavy

### 4. Lateness / time-loss intent

Priority: medium

Why it matters:

- big emotional pain point
- good fit for a future human-written article
- not as directly commercial as app-switching

Internal topic label:

- `ADHD time blindness at work`

Better public-facing search queries:

- `why am I always late to work ADHD`
- `how to stop being late to work with ADHD`
- `lose track of time at work ADHD`
- `why do I always think I still have time`
- `why do I underestimate how long things take ADHD`

LLM prompts:

- `Why am I always late even when I care and try hard?`
- `How can I stop losing track of time at work with ADHD?`
- `Why do I always think I have more time than I do?`

Best article angle:

- `Why am I always late to work with ADHD?`

Secondary support phrases:

- `how to stop being late to work with ADHD`
- `lose track of time at work ADHD`
- `why do I underestimate how long things take ADHD`

### 5. Browser-extension-vs-native-app intent

Priority: medium

Why it matters:

- buying-stage comparison intent
- highly relevant to Focana's product story

Best targets:

- Homepage comparison section
- Future supporting article or FAQ block

Search queries:

- `browser extension vs desktop app for focus`
- `best focus app not browser extension`
- `browser extension disappears when I switch tabs`
- `native app vs browser extension ADHD productivity`

LLM prompts:

- `Should I use a browser extension or a desktop app for focus?`
- `What's better for ADHD focus: a browser extension or a native Mac app?`

## What belongs in Phase 2

### Article 2

Working title:

- `Why do I forget what I was doing when I switch tabs?`

Why this goes first:

- sounds like a real person
- matches repeated community phrasing
- connects directly to Focana's visibility promise

Secondary phrases:

- `how to stay focused when switching between apps`
- `how to stop losing focus when switching windows`
- `how to remember what I was doing after switching apps`

### Article 3

Working title:

- `Why am I always late to work with ADHD?`

Why this goes second:

- strong emotional resonance
- repeated community phrasing
- useful for broader ADHD trust and problem awareness

Secondary phrases:

- `how to stop being late to work with ADHD`
- `lose track of time at work ADHD`
- `why do I always think I still have time`

## What stays in Phase 1 pages

Homepage should keep carrying:

- `focus app for ADHD Mac`
- `always on top timer Mac`
- `native Mac focus app`
- `Mac app that stays visible while I work`

Anchor article should keep carrying:

- `out of sight out of mind ADHD`
- `working memory ADHD adults`
- `why do I forget tasks the second they leave my screen`

## Weekly free workflow

1. Pull Search Console queries for homepage, `/blog`, and the anchor article.
2. Check Bing Webmaster for sitemap health and emerging queries.
3. Search the top problem themes in Google incognito and note:
   - autocomplete
   - People Also Ask
   - related searches
4. Search Reddit for the same themes and collect repeated human phrasing.
5. Ask ChatGPT, Perplexity, and Gemini the top prompts from this document.
6. Record:
   - whether Focana appears
   - which URL appears
   - which outside sources get cited
7. Update the next article brief from repeated phrasing, not gut feel.

## Writing rules for Phase 2

- Start with a short direct answer near the top.
- Keep the title human, not clinical.
- Use question-based subheads only when they sound natural.
- Prefer first-hand explanation over generic listicles.
- Add source links where claims need support.
- Keep Justin visible as the author.
- Write pages that are easy to skim, easy to quote, and easy to trust.
