// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

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
  integrations: [react(), sitemap()],
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
});
