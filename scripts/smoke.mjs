/**
 * End-to-end smoke test against the built bundle.
 *
 * There is no browser binary available in this sandbox, so this boots the real
 * dist/index.html + dist/assets/*.js inside jsdom, lets the app hydrate, and
 * then asserts the page actually rendered. It catches runtime errors that only
 * appear when the whole app runs together — the thing unit tests cannot see.
 *
 * Usage: node scripts/smoke.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('[smoke] dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const errors = [];
const warnings = [];

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (e) => errors.push(`jsdom: ${e.message}`));
virtualConsole.on('error', (...a) => errors.push(`console.error: ${a.join(' ')}`));
virtualConsole.on('warn', (...a) => warnings.push(`console.warn: ${a.join(' ')}`));

const html = readFileSync(resolve(dist, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'https://kaam-milega.netlify.app/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole,
  resources: {
    // Serve local asset requests straight off disk.
    fetch(url) {
      try {
        const u = new URL(url);
        if (u.origin !== 'https://kaam-milega.netlify.app') return null;
        const file = resolve(dist, u.pathname.replace(/^\//, ''));
        if (!existsSync(file)) return null;
        return Promise.resolve(Buffer.from(readFileSync(file)));
      } catch {
        return null;
      }
    },
  },
});

const { window } = dom;

// jsdom lacks a few browser APIs the app touches. Stub only what is missing,
// so a genuine bug still surfaces rather than being masked.
window.matchMedia ||= (q) => ({
  matches: false, media: q, onchange: null,
  addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
});
window.HTMLDialogElement.prototype.showModal ||= function showModal() { this.open = true; };
window.HTMLDialogElement.prototype.close ||= function close() { this.open = false; };
window.scrollTo ||= () => {};

// The bundle is a module script; jsdom does not execute type="module".
// Load and evaluate it manually in the same window context.
const scriptMatch = html.match(/<script[^>]*src="(\/assets\/[^"]+\.js)"/);
if (!scriptMatch) {
  console.error('[smoke] could not find the bundle <script> tag in dist/index.html');
  process.exit(1);
}

const bundlePath = resolve(dist, scriptMatch[1].replace(/^\//, ''));
let code = readFileSync(bundlePath, 'utf8');
// Strip the sourcemap pragma so jsdom does not try to fetch it.
code = code.replace(/\/\/# sourceMappingURL=.*$/m, '');

// `window.eval` runs in classic-script mode, where `import.meta` is a syntax
// error. Vite has already inlined import.meta.env at build time; what is left
// is import.meta.url/resolve used by the lazy Firebase import. Rewrite those
// to a plain object so the bundle parses. This only affects the harness —
// the browser loads the same file as a real module.
code = code
  .replace(/\bimport\.meta\.url\b/g, '__IMPORT_META__.url')
  .replace(/\bimport\.meta\.resolve\b/g, '__IMPORT_META__.resolve')
  .replace(/\bimport\.meta\b/g, '__IMPORT_META__');

window.__IMPORT_META__ = {
  url: 'https://kaam-milega.netlify.app/assets/bundle.js',
  resolve: (s) => s,
  env: { MODE: 'production', PROD: true, DEV: false },
};

// Dynamic import() of the Firebase chunk cannot resolve under jsdom; the app
// only reaches it when Firebase is configured, which it is not in demo mode.
try {
  window.eval(code);
} catch (err) {
  errors.push(`bundle threw: ${err.message}`);
}

// Let async boot work settle (auth init, seed fetch, render).
await new Promise((r) => setTimeout(r, 1200));

const { document } = window;
const checks = [];
const check = (name, pass, detail = '') => checks.push({ name, pass, detail });

const view = document.getElementById('view');
check('#view exists', !!view);
check('#view rendered content', (view?.innerHTML.trim().length ?? 0) > 500,
  `${view?.innerHTML.trim().length ?? 0} chars`);

check('hero heading rendered', !!document.getElementById('hero-title'));
check('category tiles rendered',
  document.querySelectorAll('.category-card').length >= 12,
  `${document.querySelectorAll('.category-card').length} tiles`);
check('how-it-works steps rendered',
  document.querySelectorAll('.step').length === 3);
check('featured workers hydrated',
  document.querySelectorAll('#featured-grid .worker-card').length > 0,
  `${document.querySelectorAll('#featured-grid .worker-card').length} cards`);
check('reviews hydrated (skill: never hide reviews)',
  document.querySelectorAll('#reviews-grid .review').length > 0,
  `${document.querySelectorAll('#reviews-grid .review').length} reviews`);
check('stats hydrated',
  ![...document.querySelectorAll('.stat-value')].every((el) => el.textContent.trim() === '—'));

check('icons hydrated into SVG',
  document.querySelectorAll('svg').length > 20,
  `${document.querySelectorAll('svg').length} svg`);
check('no unhydrated icon placeholders',
  [...document.querySelectorAll('[data-icon]')].every((el) => el.querySelector('svg')));

check('theme toggle has an accessible name',
  !!document.getElementById('theme-toggle')?.getAttribute('aria-label'));
check('auth button has an accessible name',
  !!document.getElementById('auth-button')?.getAttribute('aria-label'));
check('footer year filled in',
  /^\d{4}$/.test(document.getElementById('year')?.textContent ?? ''));
check('demo-mode notice shown when unconfigured',
  (document.getElementById('build-mode')?.textContent ?? '').includes('Demo mode'));

check('nav marks the current page',
  !!document.querySelector('[data-route="home"][aria-current="page"]'));

// No emoji anywhere in the rendered output.
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
check('no emoji in rendered DOM', !emoji.test(document.body.innerHTML));

// Client-side routing actually swaps the view.
const workersLink = document.querySelector('a[data-route="workers"]');
if (workersLink) {
  workersLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 800));
  check('navigating to /workers changes the URL', window.location.pathname === '/workers',
    window.location.pathname);
  check('worker directory rendered', !!document.getElementById('filter-form'));
  check('worker results rendered',
    document.querySelectorAll('#worker-grid .worker-card').length > 0,
    `${document.querySelectorAll('#worker-grid .worker-card').length} cards`);
  check('document title updated for the route',
    document.title.includes('Find Skilled Workers'), document.title);
} else {
  check('workers nav link present', false);
}

// Report ------------------------------------------------------------------
let failed = 0;
console.log('\n--- smoke checks ---');
for (const c of checks) {
  if (!c.pass) failed++;
  console.log(`${c.pass ? ' ok ' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
}

// jsdom does not implement layout, CSS loading, or scrolling. Those are
// harness gaps, not application faults — everything else is a real failure.
const JSDOM_GAPS = [
  'Not implemented: navigation',
  "Not implemented: Window's scrollTo",
  'Could not parse CSS',
  'Could not load link',
  'sourceMappingURL',
];
const realErrors = errors.filter((e) => !JSDOM_GAPS.some((gap) => e.includes(gap)));

if (realErrors.length) {
  console.log('\n--- runtime errors ---');
  realErrors.forEach((e) => console.log(`  ${e}`));
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed, ${realErrors.length} runtime errors`);

if (failed || realErrors.length) process.exit(1);
console.log('[smoke] PASS');
