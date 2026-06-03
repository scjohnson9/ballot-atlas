// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// The site is served at thinkchristian.com/ballot-atlas via a Cloudflare
// reverse-proxy worker that fronts a Netlify deployment.
//   - `base` ensures every generated route lives under /ballot-atlas/...
//     so the proxy hands off a 1:1 path mapping with no rewriting.
//   - `site` ensures the sitemap, canonical URLs, and Open Graph tags
//     use the public hostname rather than the .netlify.app staging URL.
//   - `trailingSlash: 'never'` keeps URLs clean and shareable
//     (/ballot-atlas/florida, not /ballot-atlas/florida/).
export default defineConfig({
  site: 'https://thinkchristian.com',
  base: '/ballot-atlas',
  trailingSlash: 'never',
  integrations: [
    sitemap(),
    mdx(),
  ],
});
