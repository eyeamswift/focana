// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

const EXCLUDED_SITEMAP_PATHS = new Set(['/download/', '/next-steps/', '/survey/']);

// https://astro.build/config
export default defineConfig({
  site: 'https://focana.app',
  output: 'static',
  security: {
    checkOrigin: false,
    allowedDomains: [
      { protocol: 'https', hostname: 'focana.app' },
      { protocol: 'https', hostname: 'www.focana.app' },
    ],
  },
  integrations: [
    react(),
    sitemap({
      filter(page) {
        const pathname = new URL(page).pathname;
        const normalizedPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
        return !EXCLUDED_SITEMAP_PATHS.has(normalizedPath);
      },
    }),
  ],
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
});
