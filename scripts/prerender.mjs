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

// localStorage is read by the demo-mode data layer; jsdom provides it, but the
// hydrate paths also touch it via auth. Make sure it exists and is empty.
if (!global.localStorage) global.localStorage = dom.window.localStorage;

const { renderHome, hydrateHome } = await import('../src/pages/home.js');
const { renderWorkers, hydrateWorkers } = await import('../src/pages/workers.js');
const { renderJobs, hydrateJobs } = await import('../src/pages/jobs.js');
const { renderAbout, renderPrivacy, renderTerms } = await import('../src/pages/static.js');

const { CATEGORIES } = await import('../src/data/categories.js');
const { WORKERS } = await import('../src/data/seed.js');

/**
 * Category landing pages — the highest-intent queries this product can rank
 * for ("electrician near me"). They were previously listed in the sitemap as
 * `/workers?trade=x`, but Netlify serves dist/workers/index.html for those,
 * whose canonical is `/workers`. Google treats that as a duplicate and drops
 * the URL, so the twelve best pages on the site were unindexable.
 *
 * Each now gets a real directory, its own canonical, its own title and
 * description, and content filtered to that trade.
 */
const CATEGORY_ROUTES = CATEGORIES.map((c) => {
  const count = WORKERS.filter((w) => w.trade === c.slug).length;
  return {
    path: `/workers/${c.slug}`,
    file: `workers/${c.slug}/index.html`,
    title: `${c.name}s Near You — Verified & Rated | KaamMilega`,
    description:
      `Find verified ${c.name.toLowerCase()}s (${c.hindi}) near you. ` +
      `Typical rate around ₹${c.typicalRate}/day. See ratings and reviews, ` +
      `then call or WhatsApp directly — no commission, no middleman.`,
    render: () => renderWorkers({ trade: c.slug }),
    hydrate: () => hydrateWorkers({ trade: c.slug }),
    // A category with no workers yet would be a thin/empty page; tell crawlers
    // not to index it rather than publishing an empty result set.
    noindex: count === 0,
  };
});

const ROUTES = [
  {
    path: '/',
    file: 'index.html',
    title: 'KaamMilega — Find Verified Local Workers Near You in India',
    description:
      'Find verified electricians, plumbers, carpenters, tailors and photographers near you. Call or WhatsApp local skilled workers directly.',
    render: () => renderHome(),
    hydrate: () => hydrateHome(),
  },
  {
    path: '/workers',
    file: 'workers/index.html',
    title: 'Find Skilled Workers Near You | KaamMilega',
    description:
      'Search verified electricians, plumbers, carpenters and more by city and trade. See ratings, reviews and day rates.',
    render: () => renderWorkers({}),
    hydrate: () => hydrateWorkers({}),
  },
  {
    path: '/jobs',
    file: 'jobs/index.html',
    title: 'Open Jobs for Skilled Workers | KaamMilega',
    description: 'Browse open work near you and apply directly. Free to post, free to apply.',
    render: () => renderJobs(),
    hydrate: () => hydrateJobs({}, {
      // The dialog helpers are interaction-only; prerendering never opens one.
      openDialog: () => {}, wireDialog: () => {}, closeDialog: () => {},
    }),
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

ROUTES.push(...CATEGORY_ROUTES);

let written = 0;

for (const route of ROUTES) {
  const pageDom = new JSDOM(shellHtml, { url: `${SITE}${route.path}` });
  const doc = pageDom.window.document;

  // The page modules close over the *global* document, so point the globals at
  // this route's DOM for the duration of its render+hydrate. Without this,
  // hydrate() would write into the bootstrap DOM and every page would ship
  // its loading skeleton instead of real content.
  global.window = pageDom.window;
  global.document = doc;
  Object.defineProperty(global, 'navigator', {
    value: pageDom.window.navigator,
    configurable: true,
    writable: true,
  });
  global.localStorage = pageDom.window.localStorage;

  // Inject the rendered markup.
  const view = doc.getElementById('view');
  if (!view) {
    console.error('[prerender] #view missing from the shell');
    process.exit(1);
  }
  view.innerHTML = route.render();

  // Run the data-loading pass so the HTML contains real content rather than
  // skeletons. In demo mode this reads the bundled seed fixtures, so it is
  // deterministic and needs no network. A hydrate failure must not silently
  // ship a skeleton page, so it fails the build.
  if (route.hydrate) {
    try {
      await route.hydrate();
    } catch (err) {
      console.error(`[prerender] hydrate failed for ${route.path}:`, err);
      process.exit(1);
    }
    // Drop transient busy flags — the served HTML is already settled.
    doc.querySelectorAll('[aria-busy="true"]').forEach((el) => {
      el.setAttribute('aria-busy', 'false');
    });
  }

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

  // Thin pages must not be indexed.
  if (route.noindex) {
    let robots = doc.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = doc.createElement('meta');
      robots.setAttribute('name', 'robots');
      doc.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, follow');
  }

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
