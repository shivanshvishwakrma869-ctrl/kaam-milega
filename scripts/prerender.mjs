/**
 * Prerender static routes to real HTML files.
 *
 * The app is a client-rendered SPA, so without this every crawler receives an
 * empty <div id="view"></div>. Googlebot executes JavaScript, but Bing,
 * DuckDuckGo, and — critically for a product that spreads by sharing —
 * WhatsApp, Facebook, and Twitter link previewers largely do not.
 *
 * This runs after `vite build` and writes a fully-populated index.html for
 * each route, so the first byte already contains the content, the correct
 * <title>, description, and canonical URL. The SPA then hydrates over it.
 *
 * Only routes whose content is static are prerendered. /profile is skipped
 * (it is per-user and noindex); /workers and /jobs get their shell plus
 * server-rendered seed content, which is accurate for a crawler's purposes.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

const SITE = (process.env.URL || process.env.SITE_URL || 'https://kaam-milega.netlify.app')
  .replace(/\/+$/, '');

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('[prerender] dist/index.html not found — run vite build first.');
  process.exit(1);
}

// A DOM must exist before the page modules are imported, because some of them
// touch `document` at module scope via the icon helpers.
const shellHtml = readFileSync(resolve(dist, 'index.html'), 'utf8');
const dom = new JSDOM(shellHtml, { url: `${SITE}/` });
global.window = dom.window;
global.document = dom.window.document;
global.CSS = dom.window.CSS;
// Node 22 defines globalThis.navigator as a getter-only property, so a plain
// assignment throws. Redefine it instead.
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});

const { renderHome } = await import('../src/pages/home.js');
const { renderWorkers } = await import('../src/pages/workers.js');
const { renderJobs } = await import('../src/pages/jobs.js');
const { renderAbout, renderPrivacy, renderTerms } = await import('../src/pages/static.js');

const ROUTES = [
  {
    path: '/',
    file: 'index.html',
    title: 'KaamMilega — Find Verified Local Workers Near You in India',
    description:
      'Find verified electricians, plumbers, carpenters, tailors and photographers near you. Call or WhatsApp local skilled workers directly.',
    render: () => renderHome(),
  },
  {
    path: '/workers',
    file: 'workers/index.html',
    title: 'Find Skilled Workers Near You | KaamMilega',
    description:
      'Search verified electricians, plumbers, carpenters and more by city and trade. See ratings, reviews and day rates.',
    render: () => renderWorkers({}),
  },
  {
    path: '/jobs',
    file: 'jobs/index.html',
    title: 'Open Jobs for Skilled Workers | KaamMilega',
    description: 'Browse open work near you and apply directly. Free to post, free to apply.',
    render: () => renderJobs(),
  },
  {
    path: '/about',
    file: 'about/index.html',
    title: 'About KaamMilega — No Commission, No Middleman',
    description: 'Why KaamMilega exists, what verification means, and how to stay safe.',
    render: () => renderAbout(),
  },
  {
    path: '/privacy',
    file: 'privacy/index.html',
    title: 'Privacy Policy | KaamMilega',
    description: 'What data KaamMilega collects, how it is used, and your rights.',
    render: () => renderPrivacy(),
  },
  {
    path: '/terms',
    file: 'terms/index.html',
    title: 'Terms of Use | KaamMilega',
    description: 'The terms that apply when you use KaamMilega.',
    render: () => renderTerms(),
  },
];

let written = 0;

for (const route of ROUTES) {
  const pageDom = new JSDOM(shellHtml, { url: `${SITE}${route.path}` });
  const doc = pageDom.window.document;

  // Inject the rendered markup.
  const view = doc.getElementById('view');
  if (!view) {
    console.error('[prerender] #view missing from the shell');
    process.exit(1);
  }
  view.innerHTML = route.render();

  // Per-route head.
  doc.title = route.title;
  const set = (sel, attr, val) => {
    const el = doc.querySelector(sel);
    if (el) el.setAttribute(attr, val);
  };
  const url = `${SITE}${route.path}`;
  set('meta[name="description"]', 'content', route.description);
  set('meta[property="og:title"]', 'content', route.title);
  set('meta[property="og:description"]', 'content', route.description);
  set('meta[property="og:url"]', 'content', url);
  set('meta[name="twitter:title"]', 'content', route.title);
  set('meta[name="twitter:description"]', 'content', route.description);
  set('link[rel="canonical"]', 'href', url);

  // Mark the active nav item so the pre-hydration paint matches.
  doc.querySelectorAll('a[data-route]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === route.path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const outPath = resolve(dist, route.file);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `<!doctype html>\n${doc.documentElement.outerHTML}\n`, 'utf8');
  written++;
  console.log(`[prerender] ${route.path.padEnd(10)} -> dist/${route.file}`);
}

console.log(`[prerender] ${written} routes prerendered for ${SITE}`);
