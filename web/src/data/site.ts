import { SITE_ORIGIN } from '../lib/siteOrigin';

export const SITE_NAME = 'Focana';
export const SITE_CONTACT_EMAIL = 'hello@focana.app';
export const SITE_DESCRIPTION =
  'Focana is a native Mac focus app that keeps your task, timer, and session context visible while you work across apps. Built for ADHD and busy brains.';
export const SITE_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

export const siteFounder = {
  name: 'Justin Franklin',
  role: 'Founder of Focana and NeurDi Labs',
  shortRole: 'Founder, Focana and NeurDi Labs',
  note: 'Diagnosed with ADHD at 30.',
  bio: 'Justin Franklin is the founder of Focana and NeurDi Labs. He built Focana from first-hand ADHD experience after years of trying productivity tools that added more friction than focus.',
  credentials: [
    'Diagnosed with ADHD at 30 after college, grad school, and years into his career',
    'Built Focana from first-hand lived experience with app switching, time blindness, and working-memory strain',
    'Writes publicly about focus systems and neurodivergent-friendly product design',
  ],
  sameAs: [
    'https://www.linkedin.com/in/justinfranklin90',
    'https://adhdfounder.substack.com',
    'https://x.com/eyeamswift',
  ],
  aboutHref: '/about#justin-franklin',
};

export const siteOrganization = {
  name: SITE_NAME,
  legalName: 'NeurDi Labs',
  url: SITE_ORIGIN,
  email: SITE_CONTACT_EMAIL,
  logo: `${SITE_ORIGIN}/favicon.png`,
  description: SITE_DESCRIPTION,
};
