/**
 * Pre-build: generate sitemap.xml from the real route table + category list,
 * so it can never drift out of sync with the app.
 *
 * Run automatically by `npm run build`.
 */

import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SITE =
  process.env.URL ||               // Netlify provides this at build time
  process.env.SITE_URL ||
  'https://kaam-milega.netlify.app';

const origin = SITE.replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

// Kept in sync with src/data/categories.js
const CATEGORY_SLUGS = [
  'electrician', 'plumber', 'carpenter', 'painter', 'mason', 'tailor',
  'photographer', 'video-editor', 'designer', 'driver', 'cleaner', 'gardener',
];

/** Static routes. /profile is intentionally excluded — it is noindex. */
const ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/workers', changefreq: 'daily', priority: '0.9' },
  { path: '/jobs', changefreq: 'hourly', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
];

const categoryRoutes = CATEGORY_SLUGS.map((slug) => ({
  path: `/workers?trade=${slug}`,
  changefreq: 'daily',
  priority: '0.8',
}));

const all = [...ROUTES, ...categoryRoutes];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  all
    .map(({ path, changefreq, priority }) => {
      // & must be escaped inside XML text nodes.
      const loc = `${origin}${path}`.replace(/&/g, '&amp;');
      return (
        `  <url>\n` +
        `    <loc>${loc}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>${changefreq}</changefreq>\n` +
        `    <priority>${priority}</priority>\n` +
        `  </url>\n`
      );
    })
    .join('') +
  `</urlset>\n`;

mkdirSync(resolve(root, 'public'), { recursive: true });
writeFileSync(resolve(root, 'public/sitemap.xml'), xml, 'utf8');

console.log(`[prebuild] sitemap.xml written with ${all.length} URLs for ${origin}`);

/**
 * Keep /security.txt and /.well-known/security.txt identical.
 * RFC 9116 mandates the .well-known path; the root copy is a courtesy for
 * scanners that still look there. Vite's publicDir copier skips dot-prefixed
 * directories, so the canonical copy is written into dist/ directly after the
 * build instead — see the postbuild step in this same script's sibling call.
 */
const rootTxt = resolve(root, 'public/security.txt');
const wellKnownDir = resolve(root, 'public/.well-known');
if (existsSync(rootTxt)) {
  mkdirSync(wellKnownDir, { recursive: true });
  copyFileSync(rootTxt, resolve(wellKnownDir, 'security.txt'));
  console.log('[prebuild] security.txt synced to public/.well-known/');
}
