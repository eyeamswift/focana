export type BlogFaqItem = {
  question: string;
  answer: string;
};

export type BlogSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedDate: string;
  publishedLabel: string;
  ogImageAlt: string;
  tags: string[];
  opening: string[];
  examples: string[];
  sections: BlogSection[];
  closing: string[];
  faqs: BlogFaqItem[];
};

export const siteAuthor = {
  name: 'Justin Franklin',
  role: 'Founder of Focana and NeurDi Labs',
  note: 'Diagnosed with ADHD at 30.',
  sameAs: [
    'https://www.linkedin.com/in/justinfranklin90',
    'https://adhdfounder.substack.com',
    'https://x.com/eyeamswift',
  ],
};

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
    ogImageAlt: 'Out of sight out of mind ADHD - why ADHD brains need visible focus tools',
    tags: ['ADHD', 'Focus', 'Working Memory', 'Object Permanence', 'Productivity'],
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
        title: 'ADHD and working memory',
        paragraphs: [
          `Working memory is your brain's ability to hold information while you are actively using it. Think of your brain like an office desk. Working memory is the set of materials you need for the task in front of you: laptop, coffee, notepad, pencil. Long-term memory is the filing cabinet in the corner.`,
          `A browser cache is a useful analogy. If your browser could not temporarily hold your login state, it would keep forgetting who you were and ask you to sign in over and over. ADHD can feel like that. The intention was there a moment ago, and then something else overwrote it.`,
          `This is why directions, names, numbers, and next steps can vanish so fast. The information was not meaningless. It just got displaced by something more immediate, more interesting, or more visible.`,
          `For focus, this creates a brutal cycle: you decide what to work on, your brain tries to hold that intention in working memory, and then a notification, tab switch, or passing thought replaces it. The intention is gone. This is closely tied to time blindness too, because once attention slips, it can become very hard to feel how long you have been away from the thing you meant to do.`,
        ],
      },
      {
        title: 'Why most focus tools fail ADHD brains',
        paragraphs: [
          `Most productivity apps are built for brains that can hold onto their own intention. For ADHD brains, that assumption breaks the whole system. The moment the app minimizes or hides behind another window, the support disappears at exactly the moment it was needed.`,
          `Your task tracker is behind your email. Your timer is behind Slack. Your to-do list lives in a tab you have not looked at for 30 minutes. These tools are not necessarily bad. They are just built for people whose brains can keep the task alive without an external anchor.`,
          `A lot of distraction blockers miss the point too. They assume the problem is the distraction itself. But many distractions are not useless. That random thought might connect two ideas you have been wrestling with for weeks. That rabbit hole might lead somewhere genuinely helpful.`,
          `The real problem is not wandering. The problem is losing the thread while you wander. The best systems work more like meditation: notice you drifted, capture the thought somewhere safe, and return to the original task. Do not block the thought. Just do not let it erase the reason you sat down.`,
        ],
      },
      {
        title: 'What actually helps ADHD brains stay focused',
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
      `ADHD brains do not need more guilt, more friction, or more "try harder" advice. They need visible anchors, softer returns, and tools that respect how attention actually works.`,
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
  },
];

export const firstBlogPost = blogPosts[0];
