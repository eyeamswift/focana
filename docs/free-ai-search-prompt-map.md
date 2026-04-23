# Free-First AI Search Prompt Map

Owner: Justin / Focana
Last updated: April 23, 2026

## What we are optimizing for

Focana should not optimize for robotic phrases that sound good in a keyword spreadsheet but do not sound like a real person.

Use this distinction:

- `Topic label`: internal shorthand for us
- `Search query`: what someone might type into Google
- `LLM prompt`: what someone might ask ChatGPT, Perplexity, Gemini, or Claude

Example:

- Topic label: `ADHD time blindness at work`
- Better search queries:
  - `why am I always late to work ADHD`
  - `how to stop being late to work with ADHD`
  - `lose track of time at work ADHD`
- Better LLM prompts:
  - `Why am I always late to work even when I try really hard? I have ADHD.`
  - `How do people with ADHD stop losing track of time at work?`

The topic label is still useful internally. It just should not automatically become the page title, slug, or main query we track.

## Free-first tool stack

Keep this free for as long as possible.

- Google Search Console:
  - query data
  - index coverage
  - sitemap status
  - URL inspection
- Bing Webmaster Tools:
  - secondary indexing checks
  - sitemap submission
- Google Rich Results Test:
  - validate Google-supported structured data
- Schema Markup Validator:
  - validate raw Schema.org markup
- PageSpeed Insights:
  - page experience checks
- Google search in incognito:
  - autocomplete
  - People Also Ask
  - related searches
- Reddit search:
  - real phrasing from ADHD and productivity communities
- Manual checks in ChatGPT, Perplexity, and Gemini:
  - note whether Focana appears
  - note which pages or sources get cited

Optional free tier:

- Screaming Frog SEO Spider:
  - free up to 500 URLs
  - useful for canonicals, redirects, noindex, sitemap, and internal links

## Core prompt families

### 1. Product-intent

These are the queries closest to revenue.

Best targets:

- Homepage
- Product sections on homepage
- Comparison section on homepage

Human phrasing:

- `focus app for ADHD Mac`
- `best ADHD focus app for Mac`
- `Mac app to stay focused while working`
- `always on top timer Mac`
- `Mac app that stays visible while I work`
- `focus app that stays on top`
- `native Mac focus app`

LLM-style prompts:

- `What's the best Mac app for ADHD focus that stays visible while I switch apps?`
- `Is there a Mac focus app that stays on top of other windows?`
- `I need a focus tool for Mac that doesn't disappear behind tabs.`

### 2. App-switching and losing-the-thread intent

This is the strongest problem-to-product bridge for Focana.

Best targets:

- Existing anchor article
- Future human-written article 2
- Homepage comparison section

Human phrasing:

- `how to stay focused when switching between apps`
- `why do I forget what I was doing when I switch tabs`
- `how to stop losing focus when switching windows`
- `app switching kills my focus`
- `how to keep task visible while working`
- `how to remember what I was doing after switching apps`

LLM-style prompts:

- `Why do I lose the thread every time I switch apps?`
- `How do I stay focused when I have to bounce between Slack, email, and my browser?`
- `I keep forgetting what I was doing when I switch tabs. What helps?`

### 3. Visibility and externalized working-memory intent

This is the deeper explanatory layer that makes Focana believable.

Best targets:

- Existing anchor article
- Homepage trust/problem sections

Human phrasing:

- `out of sight out of mind ADHD`
- `why do ADHD people forget tasks when they can't see them`
- `working memory ADHD adults`
- `object permanence ADHD adults`
- `ADHD visible reminders`
- `how to keep tasks visible for ADHD`

LLM-style prompts:

- `Why do I forget tasks the second they leave my screen?`
- `Is out of sight out of mind an ADHD thing?`
- `What helps ADHD brains keep a task active while working on a computer?`

### 4. Time-loss and lateness intent

This is where the old phrasing needed correction.

Internal label:

- `ADHD time blindness at work`

Better public phrasing:

- `why am I always late to work ADHD`
- `how to stop being late to work with ADHD`
- `lose track of time at work ADHD`
- `why do I underestimate how long things take ADHD`
- `ADHD always late to work`

LLM-style prompts:

- `Why am I always late even when I care and try hard?`
- `How can I stop losing track of time at work with ADHD?`
- `Why do I always think I have more time than I do?`

Best targets:

- Future human-written article 3
- Possibly a short supporting section in the anchor article

Important note:

- This topic is real.
- The exact phrase `ADHD time blindness at work` may still appear in some content ecosystems.
- But it works better for us as an internal theme than as the main phrase we optimize around.

### 5. Browser-extension-vs-native-app intent

This is strong buying-stage content.

Best targets:

- Homepage comparison section
- Future human-written article

Human phrasing:

- `browser extension vs desktop app for focus`
- `best focus app not browser extension`
- `browser extension disappears when I switch tabs`
- `native app vs browser extension ADHD productivity`

LLM-style prompts:

- `Should I use a browser extension or a desktop app for focus?`
- `What's better for ADHD focus: a browser extension or a native Mac app?`

## What to publish in each phase

### Phase 1

Use the current site and existing anchor article to cover:

- product-intent
- app-switching intent
- visible-focus / working-memory intent

Do not force a content cluster just to fill it out.

### Phase 2

Add 2 human-written articles:

1. Article 2
   - Working title:
     - `Why do I forget what I was doing when I switch tabs?`
   - Secondary phrases:
     - `how to stay focused when switching between apps`
     - `how to stop losing focus when switching windows`
     - `app switching kills my focus`

2. Article 3
   - Working title:
     - `Why am I always late to work with ADHD?`
   - Secondary phrases:
     - `how to stop being late to work with ADHD`
     - `lose track of time at work ADHD`
     - `why do I underestimate how long things take ADHD`

These titles are more human than the internal labels and more likely to match real search and AI prompt phrasing.

## How to research this for free every week

1. Pull Search Console queries for the homepage, `/blog/`, and the anchor article.
2. Look for plain-English wording, not just short head terms.
3. Search Google in incognito for the main themes and record:
   - autocomplete ideas
   - People Also Ask questions
   - related searches
4. Search Reddit for the same problems and save exact language people repeat.
5. Ask ChatGPT, Perplexity, and Gemini the top buyer and pain-point prompts.
6. Record:
   - whether Focana appears
   - which competitors appear
   - which sources are cited
7. Update the next article brief based on repeated phrasing.

## How to write for both SEO and AI search

- Start with a short direct answer near the top.
- Use question-based subheads when they match real phrasing.
- Prefer first-hand explanation over generic listicles.
- Add source links where claims need support.
- Keep the author visible.
- Make the page easy to skim and easy to quote.
- Do not write around awkward phrases just because they look keyword-rich.

## Content map

| Theme | Best page | Main phrases to target |
| --- | --- | --- |
| Product category | Homepage | `focus app for ADHD Mac`, `always on top timer Mac`, `Mac app that stays visible while I work` |
| Losing the thread when switching | Anchor article + future article 2 | `how to stay focused when switching between apps`, `why do I forget what I was doing when I switch tabs` |
| Visible focus / working memory | Anchor article | `out of sight out of mind ADHD`, `working memory ADHD adults`, `how to keep tasks visible for ADHD` |
| Lateness / time loss | Future article 3 | `why am I always late to work ADHD`, `lose track of time at work ADHD`, `how to stop being late to work with ADHD` |
| Native app vs extension | Future comparison article or homepage section | `browser extension vs desktop app for focus`, `native app vs browser extension ADHD productivity` |

## Simple rule

If a phrase sounds like something only a marketer would type, keep it as an internal label, not the public-facing target.
