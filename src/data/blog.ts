import { siteFounder } from './site';

export type BlogFaqItem = {
  question: string;
  answer: string;
};

export type BlogSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogSourceLink = {
  phrase: string;
  url: string;
};

export type BlogSource = {
  label: string;
  url: string;
};

export type BlogVisualItem = {
  label: string;
  title: string;
  body: string;
};

export type BlogVisual = {
  eyebrow: string;
  title: string;
  description: string;
  items: BlogVisualItem[];
  caption?: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedDate: string;
  publishedLabel: string;
  publishedDateTime: string;
  updatedDateTime?: string;
  updatedLabel?: string;
  ogImageAlt: string;
  category: string;
  tags: string[];
  summary: string;
  opening: string[];
  examples?: string[];
  sections: BlogSection[];
  visual?: BlogVisual;
  closing: string[];
  faqs?: BlogFaqItem[];
  sourceLinks?: BlogSourceLink[];
  sources: BlogSource[];
  relatedSlugs: string[];
};

export const siteAuthor = siteFounder;

export const blogPosts: BlogPost[] = [
  {
    slug: 'out-of-sight-out-of-mind-adhd',
    title: 'Out of Sight, Out of Mind: Why ADHD Brains Need Visible Focus Tools',
    description:
      "Why ADHD brains forget tasks the moment they're out of view - and the tools and strategies that actually keep your focus visible.",
    excerpt:
      "ADHD focus often falls apart when the task disappears from view. Here's why that happens, and what actually helps you stay anchored on a computer.",
    publishedDate: '2026-04-14',
    publishedLabel: 'April 14, 2026',
    publishedDateTime: '2026-04-14T09:00:00-05:00',
    ogImageAlt: 'Out of sight out of mind ADHD and visible focus tools',
    category: 'ADHD Focus',
    tags: ['ADHD', 'Focus', 'Working Memory', 'Object Permanence', 'Productivity'],
    summary:
      'If the task disappears from view, ADHD attention has a much harder time keeping it active. Visible tools help because they externalize working memory, reduce the chance of losing the thread, and make it easier to return to the work you meant to do.',
    opening: [
      `For ADHDers, "out of sight, out of mind" is not just a funny saying or a throwaway excuse. It is a daily reality that shapes how work gets started, interrupted, and forgotten.`,
      `A lot of people describe ADHD as a lack of attention, but that framing misses the lived experience. Many ADHD brains can pay attention to almost everything at once. The harder part is inhibition: choosing what deserves attention right now, and keeping that choice alive when something more visible shows up.`,
      `That is why a squirrel outside the window, a poster on the wall, a Slack badge, a nearby sound, or a random thought can pull focus so fast. Once attention shifts, the original intention can disappear with it.`,
      `And when nothing obvious is happening, the brain often goes looking for a new stimulus. That is when the reflexive Instagram open, new tab, inbox check, or phone grab happens. Most of us cannot stand still for 90 seconds while food heats in the microwave.`,
      `For computer-based work, the takeaway is simple: if the task is not visible, the ADHD brain has a much harder time keeping it active.`,
    ],
    examples: [
      'You scroll past a text and find it unanswered three days later.',
      'You checked email while waiting for ChatGPT and lost an hour to Gmail.',
      "You left your water bottle at home because it wasn't sitting with your gym bag.",
      "You missed the Amazon return window because the box was tucked in a closet.",
    ],
    sections: [
      {
        title: 'What is object permanence in ADHD?',
        paragraphs: [
          `In ADHD conversations, people often use "object permanence" as shorthand for the out-of-sight, out-of-mind pattern. Clinically, object permanence is a childhood developmental concept. Adults with ADHD do not literally stop believing something exists when it leaves view.`,
          `What often happens instead is that working memory and priority drop fast when the thing is no longer visible. You still know your dog exists when you cannot see, hear, or smell them. But an unread text, a return box, or a task hidden behind another window can slide out of active awareness because the brain is busy responding to whatever is directly in front of it.`,
          `That makes visibility matter more than most people realize. If the task stays in your line of sight, it stays easier to remember. If it disappears, it can fall out of the queue entirely.`,
        ],
      },
      {
        title: 'How does working memory shape ADHD focus?',
        paragraphs: [
          `Working memory is your brain's ability to hold information while you are actively using it. Think of your brain like an office desk. Working memory is the set of materials you need for the task in front of you: laptop, coffee, notepad, pencil. Long-term memory is the filing cabinet in the corner.`,
          `A browser cache is a useful analogy. If your browser could not temporarily hold your login state, it would keep forgetting who you were and ask you to sign in over and over. ADHD can feel like that. The intention was there a moment ago, and then something else overwrote it.`,
          `This is why directions, names, numbers, and next steps can vanish so fast. The information was not meaningless. It just got displaced by something more immediate, more interesting, or more visible.`,
          `For focus, this creates a brutal cycle: you decide what to work on, your brain tries to hold that intention in working memory, and then a notification, tab switch, or passing thought replaces it. The intention is gone. This is closely tied to time blindness too, because once attention slips, it can become very hard to feel how long you have been away from the thing you meant to do.`,
        ],
      },
      {
        title: 'Why do most focus tools fail ADHD brains?',
        paragraphs: [
          `Most productivity apps are built for brains that can hold onto their own intention. For ADHD brains, that assumption breaks the whole system. The moment the app minimizes or hides behind another window, the support disappears at exactly the moment it was needed.`,
          `Your task tracker is behind your email. Your timer is behind Slack. Your to-do list lives in a tab you have not looked at for 30 minutes. These tools are not necessarily bad. They are just built for people whose brains can keep the task alive without an external anchor.`,
          `A lot of distraction blockers miss the point too. They assume the problem is the distraction itself. But many distractions are not useless. That random thought might connect two ideas you have been wrestling with for weeks. That rabbit hole might lead somewhere genuinely helpful.`,
          `The real problem is not wandering. The problem is losing the thread while you wander. The best systems work more like meditation: notice you drifted, capture the thought somewhere safe, and return to the original task. Do not block the thought. Just do not let it erase the reason you sat down.`,
        ],
      },
      {
        title: 'What actually helps ADHD brains stay focused?',
        paragraphs: [
          `The pattern is clear: if the problem is that things disappear from awareness, the solution is to make them hard to lose sight of. Tools work better when they keep the current task in your visual field, even while you switch contexts.`,
          `A few approaches consistently help:`,
        ],
        bullets: [
          `Physical sticky notes on your monitor. The oldest trick still works because it cannot be minimized, tabbed away, or buried under notifications. A single priority written next to your screen keeps the task alive.`,
          `Body doubling. Working alongside another person gives your brain an external anchor. Services like Focusmate and Flown create just enough presence and accountability to keep you on track.`,
          `Always-on-top desktop apps. Browser tabs disappear. Native desktop tools that float above every other window do not. A visible task and timer act like a digital sticky note that moves with you through email, your IDE, Slack, and the browser. Tools like Focana add gentle check-ins and a built-in notepad so distracting thoughts can be parked instead of lost or followed.`,
          `Environment design. Clear visual clutter from your desk and your desktop. Close extra tabs. Put your phone in another room. The fewer competing signals your brain has to process, the easier it is to hold onto the right one.`,
        ],
      },
    ],
    closing: [
      `The common principle across all of these is simple: externalize your working memory. Do not ask your brain to hold the task by itself. Put it somewhere your eyes can keep finding it.`,
    ],
    faqs: [
      {
        question: 'What is object permanence in ADHD?',
        answer:
          'In ADHD conversations, object permanence usually means the out-of-sight, out-of-mind experience. Adults with ADHD do not literally lose object permanence, but tasks and objects can drop out of active awareness when they are no longer visible.',
      },
      {
        question: "Why do people with ADHD forget tasks that aren't visible?",
        answer:
          "ADHD affects working memory, which is the brain's ability to hold information while using it. When a task leaves the visual field, working memory can drop it fast, especially if something more stimulating shows up.",
      },
      {
        question: 'What does "out of sight, out of mind" mean for ADHD?',
        answer:
          'For ADHD, out of sight, out of mind describes the way attention and priority can collapse once a task is no longer visible. It is not laziness or a character flaw. It is a predictable consequence of working-memory strain and shifting attention.',
      },
      {
        question: 'What is the best focus tool for someone with ADHD?',
        answer:
          'The best focus tools for ADHD stay visible, are fast to start, avoid guilt-heavy framing, and help you return to your task after a distraction. Always-on-top desktop tools fit that pattern especially well because they keep the task in view across apps.',
      },
      {
        question: 'How can I stay focused on my computer when I have ADHD?',
        answer:
          'Keep your current task physically visible, reduce visual noise by closing unnecessary tabs and clearing your desktop, and use external anchors like body doubling or an always-on-top app that checks in while you work.',
      },
    ],
    sourceLinks: [
      {
        phrase: 'Body doubling',
        url: 'https://add.org/the-body-double/',
      },
      {
        phrase: 'time blindness',
        url: 'https://health.clevelandclinic.org/time-blindness',
      },
      {
        phrase: 'Working memory',
        url: 'https://chadd.org/attention-article/adhd-and-working-memory/',
      },
      {
        phrase: 'working memory',
        url: 'https://chadd.org/attention-article/adhd-and-working-memory/',
      },
      {
        phrase: 'Object permanence',
        url: 'https://www.verywellmind.com/what-is-object-permanence-2795405',
      },
      {
        phrase: 'object permanence',
        url: 'https://www.verywellmind.com/what-is-object-permanence-2795405',
      },
    ],
    sources: [
      {
        label: 'CHADD: ADHD and Working Memory',
        url: 'https://chadd.org/attention-article/adhd-and-working-memory/',
      },
      {
        label: 'ADD.org: Body doubling',
        url: 'https://add.org/the-body-double/',
      },
      {
        label: 'Cleveland Clinic: What Is Time Blindness?',
        url: 'https://health.clevelandclinic.org/time-blindness',
      },
      {
        label: 'Verywell Mind: What Is Object Permanence?',
        url: 'https://www.verywellmind.com/what-is-object-permanence-2795405',
      },
    ],
    relatedSlugs: [
      'how-to-stay-focused-when-switching-between-apps',
      'adhd-time-blindness-at-work',
    ],
  },
  {
    slug: 'how-to-stay-focused-when-switching-between-apps',
    title: 'How to Stay Focused When Switching Between Apps',
    description:
      'A practical guide to staying focused when email, Slack, your browser, and your editor keep pulling you into context switching.',
    excerpt:
      'If you keep losing the thread every time you switch windows, the problem is usually not discipline. It is context rebuilding. Here is how to reduce the switching cost and protect your focus.',
    publishedDate: '2026-04-20',
    publishedLabel: 'April 20, 2026',
    publishedDateTime: '2026-04-20T09:00:00-05:00',
    ogImageAlt: 'How to stay focused when switching between apps on your computer',
    category: 'Attention Management',
    tags: ['Context Switching', 'Focus', 'ADHD', 'Deep Work', 'Productivity'],
    summary:
      'Switching between apps breaks focus because you are not just changing windows. You are rebuilding context. The more often you bounce between tools, the more mental energy you spend remembering what mattered. Staying focused means lowering the number of unnecessary switches and keeping your task visible when you do move.',
    opening: [
      `A lot of modern work looks simple on paper. Answer the email. Check the pull request. Look something up. Reply in Slack. But the real cost is not opening the next app. The real cost is reconstructing your mental state every time you move.`,
      `That is why you can start the day with one clear priority, switch to "just check one thing," and look up 40 minutes later wondering how you ended up in three tabs, two side quests, and a conversation you did not mean to start.`,
      `For ADHD brains, the problem gets louder because working memory is already more fragile. When the task falls off the screen, it often falls out of active awareness too.`,
    ],
    sections: [
      {
        title: 'Why is switching between apps so draining?',
        paragraphs: [
          `Task switching feels small in the moment because each move is fast. But what looks like a quick jump from your editor to Slack is really a context rebuild. You have to remember what you were doing, why it mattered, and what the next step was before you can move forward again.`,
          `The American Psychological Association summarizes this as a switching cost. Even brief shifts create overhead, and repeated back-and-forth switching can add up to a meaningful drop in efficiency and an increase in errors.`,
          `If your work already involves email, chat, documents, tickets, meetings, and a browser full of tabs, your attention can spend most of the day reorienting instead of actually progressing.`,
        ],
      },
      {
        title: 'Why is app switching even harder with ADHD?',
        paragraphs: [
          `ADHD does not just affect sustained attention. It also affects executive function and working memory. That means a switch is not only an interruption. It is also an opportunity for the original task to drop out of the queue entirely.`,
          `Once the screen changes, a more urgent message, more interesting tab, or more novel thought can take over. The issue is not that you forgot how to do the work. The issue is that the work stopped being the most visible thing in front of you.`,
          `That is why so many people with ADHD describe context switching as losing the thread. The thread was there. Then something else became more immediate.`,
        ],
      },
      {
        title: 'What actually helps you stay focused when you have to switch?',
        paragraphs: [
          `You usually cannot eliminate switching altogether. What you can do is lower the cost of each switch and make it easier to return.`,
        ],
        bullets: [
          `Keep one visible task anchor. A sticky note, always-on-top app, or pinned session card keeps the current task in sight while other windows compete for attention.`,
          `Batch reactive work. Instead of answering every message as it appears, group Slack and email checks into windows so your main task gets longer uninterrupted stretches.`,
          `Leave breadcrumbs before you switch. Write the next action, not just the project name. "Finish the login copy" is weaker than "rewrite the second paragraph in the onboarding modal."`,
          `Close low-value tabs aggressively. Every open tab becomes a possible invitation to switch again.`,
          `Use one capture place for side thoughts. If an unrelated idea pops up, park it somewhere safe instead of opening a new loop to chase it immediately.`,
        ],
      },
      {
        title: 'How should you set up your screen to reduce context switching?',
        paragraphs: [
          `Your screen should make the right task obvious. If the most important thing is buried, your brain has to work harder just to remember what you meant to do.`,
          `That usually means keeping one primary work surface open, reducing notification noise, and making sure the task, timer, or next step can survive a window change. The simpler the visual field, the less often you have to rebuild context from scratch.`,
          `If your work requires frequent movement between tools, an always-visible focus anchor matters even more. It turns every switch from "What was I doing?" into "Right, back to this."`,
        ],
      },
    ],
    visual: {
      eyebrow: 'Visual model',
      title: 'What each app switch actually costs you',
      description:
        'Most app switches are not one action. They are a short sequence that quietly taxes your attention every time it repeats.',
      items: [
        {
          label: '1',
          title: 'You leave the task',
          body: 'The original work loses the top spot in your visual field and in your working memory.',
        },
        {
          label: '2',
          title: 'Something else takes over',
          body: 'The new message, tab, or idea becomes the most urgent or most interesting thing in front of you.',
        },
        {
          label: '3',
          title: 'You rebuild context later',
          body: 'Coming back means remembering what mattered, what you finished, and what to do next.',
        },
      ],
      caption:
        'The goal is not to avoid every switch. The goal is to keep the return path short and obvious.',
    },
    closing: [
      `If switching between apps keeps breaking your day, do not treat it like a discipline problem. Treat it like a visibility problem. Protect the thread, make your next step obvious, and give yourself something stable to come back to after every interruption.`,
    ],
    faqs: [
      {
        question: 'Why do I lose focus every time I switch apps?',
        answer:
          'Because switching apps usually means switching context too. You are not just opening a new window. You are asking your brain to pause one task, process another, and then recover the first one later.',
      },
      {
        question: 'How can I stop context switching from ruining my workday?',
        answer:
          'Use a visible task anchor, batch reactive work like Slack and email, leave a specific next-step note before you switch, and close unnecessary tabs so there are fewer invitations to drift.',
      },
      {
        question: 'Does ADHD make task switching harder?',
        answer:
          'Yes. ADHD can make working memory and attention shifting more fragile, which means a switch is more likely to break the thread of the original task instead of feeling like a quick detour.',
      },
    ],
    sourceLinks: [
      {
        phrase: 'switching cost',
        url: 'https://www.apa.org/research/action/multitask',
      },
      {
        phrase: 'executive function',
        url: 'https://chadd.org/about-adhd/executive-function-skills',
      },
      {
        phrase: 'working memory',
        url: 'https://chadd.org/attention-article/adhd-and-working-memory/',
      },
      {
        phrase: 'Working memory',
        url: 'https://chadd.org/attention-article/adhd-and-working-memory/',
      },
    ],
    sources: [
      {
        label: 'APA: Multitasking switching costs',
        url: 'https://www.apa.org/research/action/multitask',
      },
      {
        label: 'CHADD: Executive function skills',
        url: 'https://chadd.org/about-adhd/executive-function-skills',
      },
      {
        label: 'CHADD: ADHD and Working Memory',
        url: 'https://chadd.org/attention-article/adhd-and-working-memory/',
      },
    ],
    relatedSlugs: ['out-of-sight-out-of-mind-adhd', 'adhd-time-blindness-at-work'],
  },
  {
    slug: 'adhd-time-blindness-at-work',
    title: 'ADHD Time Blindness at Work',
    description:
      'What ADHD time blindness looks like at work, why it happens, and how to use visible cues and gentler systems to stay oriented through the day.',
    excerpt:
      'Time blindness at work is not just being late. It can mean underestimating effort, disappearing into hyperfocus, and losing track of how long you have been away from the task that mattered.',
    publishedDate: '2026-04-20',
    publishedLabel: 'April 20, 2026',
    publishedDateTime: '2026-04-20T09:30:00-05:00',
    ogImageAlt: 'ADHD time blindness at work and how to stay oriented through the day',
    category: 'ADHD Focus',
    tags: ['Time Blindness', 'ADHD', 'Focus', 'Workflows', 'Executive Function'],
    summary:
      'ADHD time blindness at work usually looks like distorted time awareness, not laziness. Minutes disappear inside hyperfocus, boring tasks feel longer than they are, and estimates drift because the clock is not staying active in awareness. The fix is external structure: visible timers, shorter checkpoints, and clearer next steps.',
    opening: [
      `Time blindness at work rarely looks dramatic from the outside. It looks like "I only meant to spend five minutes on that." It looks like being shocked that a half hour disappeared in email. It looks like genuinely believing you can finish three major tasks before lunch and realizing too late that your estimates were built on vibes, not time.`,
      `For people with ADHD, that mismatch between felt time and actual time can shape the whole day. Deadlines sneak up. Context breaks last longer than expected. Hyperfocus hides the clock until something urgent snaps you out of it.`,
      `That does not mean people with ADHD do not care about time. It means time often is not staying active in awareness unless something external helps hold it there.`,
    ],
    sections: [
      {
        title: 'What is time blindness in ADHD?',
        paragraphs: [
          `Time blindness is the common phrase for difficulty sensing the passage of time or estimating how long something will take. It is not a formal diagnosis by itself, but it is a useful way to describe a real experience many people with ADHD report.`,
          `At work, that can mean missing how long you have been in a side quest, overestimating what fits into a work block, or feeling surprised when a deadline that you definitely knew about suddenly feels immediate.`,
          `The effect is especially frustrating because it can coexist with hyperfocus. On a task that is interesting, time can vanish. On a task that feels boring or vague, five minutes can feel endless.`,
        ],
      },
      {
        title: 'How does time blindness show up during a workday?',
        paragraphs: [
          `It often shows up in planning first. You map your day as if transitions are free, interruptions are unlikely, and every task will start on cue. Then the real day arrives.`,
          `It also shows up in recovery time. A "quick check" of Slack becomes 25 minutes. One browser search becomes a rabbit hole. A meeting runs long, and the rest of the day still gets measured against the earlier plan even though the clock already moved.`,
          `The hidden cost is not just lateness. It is that your sense of the remaining day gets distorted, which makes it harder to choose the next realistic task.`,
        ],
      },
      {
        title: 'Why does ADHD make time harder to feel?',
        paragraphs: [
          `ADHD affects attention regulation, working memory, and executive function. If time is not visibly represented, it can fade behind whatever is most interesting, urgent, or emotionally loud in the moment.`,
          `That is why time blindness often overlaps with hyperfocus and task switching. When attention tunnels in on one thing or gets hijacked by a new thing, the clock stops being part of the active picture.`,
          `Many people try to solve this by "just being more disciplined," but that misses the point. Time awareness often needs external support, not more self-criticism.`,
        ],
      },
      {
        title: 'What helps with ADHD time blindness at work?',
        paragraphs: [
          `The most helpful systems make time easier to see and easier to re-check.`,
        ],
        bullets: [
          `Use visible timers instead of hidden ones. A timer only helps if you keep noticing it.`,
          `Break long work into shorter checkpoints. A 20-minute reorientation cue is often more useful than one 90-minute block you disappear inside.`,
          `Estimate in ranges, not certainty. "20 to 30 minutes" is more honest than pretending every task has one perfect number.`,
          `Leave re-entry notes before you stop. Time blindness gets worse when you return to work with no breadcrumb for what the next action was.`,
          `Treat transitions as real work. Meetings, messages, and resets consume time even when they are not the task you planned for.`,
        ],
      },
    ],
    visual: {
      eyebrow: 'Visual model',
      title: 'Why a five-minute detour becomes forty-five',
      description:
        'Time blindness at work is often a chain reaction. One small shift changes your awareness of the whole block.',
      items: [
        {
          label: '1',
          title: 'You start with a loose estimate',
          body: 'The plan assumes the task will start easily and the interruptions will stay small.',
        },
        {
          label: '2',
          title: 'Attention tunnels or drifts',
          body: 'You either disappear into the task or get pulled into something more immediate without noticing the clock.',
        },
        {
          label: '3',
          title: 'The rest of the day warps',
          body: 'Now every remaining task is being judged against a schedule that no longer exists.',
        },
      ],
      caption:
        'External checkpoints work because they bring the clock back into awareness before the drift compounds.',
    },
    closing: [
      `ADHD time blindness at work is not a personal failing. It is a visibility problem, just like losing the thread after an interruption. The more clearly you can see time, the easier it becomes to make better choices before the day slides away from you.`,
    ],
    faqs: [
      {
        question: 'What does time blindness look like at work?',
        answer:
          'It often looks like underestimating tasks, losing long stretches to a quick detour, being surprised by deadlines, or failing to notice how much of the day has already been consumed by meetings, messages, and resets.',
      },
      {
        question: 'Is time blindness part of ADHD?',
        answer:
          'Time blindness is not its own diagnosis, but many people with ADHD experience difficulty sensing the passage of time or estimating duration because attention, working memory, and executive function all affect time awareness.',
      },
      {
        question: 'How do you manage time blindness without shame?',
        answer:
          'Use visible timers, shorter checkpoints, realistic time ranges, and clear re-entry notes. The goal is not to become perfect at time. The goal is to make time easier to notice before you drift too far.',
      },
    ],
    sourceLinks: [
      {
        phrase: 'Time blindness',
        url: 'https://health.clevelandclinic.org/time-blindness',
      },
      {
        phrase: 'time blindness',
        url: 'https://health.clevelandclinic.org/time-blindness',
      },
      {
        phrase: 'working memory',
        url: 'https://chadd.org/attention-article/adhd-and-working-memory/',
      },
      {
        phrase: 'executive function',
        url: 'https://chadd.org/about-adhd/executive-function-skills',
      },
    ],
    sources: [
      {
        label: 'Cleveland Clinic: What Is Time Blindness?',
        url: 'https://health.clevelandclinic.org/time-blindness',
      },
      {
        label: 'CDC: About ADHD',
        url: 'https://www.cdc.gov/adhd/about/index.html',
      },
      {
        label: 'CHADD: Executive function skills',
        url: 'https://chadd.org/about-adhd/executive-function-skills',
      },
      {
        label: 'CHADD: ADHD and Working Memory',
        url: 'https://chadd.org/attention-article/adhd-and-working-memory/',
      },
    ],
    relatedSlugs: [
      'out-of-sight-out-of-mind-adhd',
      'how-to-stay-focused-when-switching-between-apps',
    ],
  },
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

export function getRelatedPosts(post: BlogPost) {
  return post.relatedSlugs
    .map((slug) => getBlogPost(slug))
    .filter((relatedPost): relatedPost is BlogPost => Boolean(relatedPost));
}
