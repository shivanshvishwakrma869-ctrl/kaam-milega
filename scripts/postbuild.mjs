/**
 * Post-build fixups that Vite cannot do itself.
 *
 * 1. Vite's publicDir copier ignores dot-prefixed directories, so
 *    public/.well-known/ never reaches dist/. RFC 9116 requires
 *    /.well-known/security.txt to exist at exactly that path, so copy it.
 *
 * 2. Inject the real prerendered route list into the service worker, so its
 *    precache list cannot drift away from what the build produced.
 *
 * 3. Verify the files search engines and crawlers depend on actually shipped.
 *    A silently missing sitemap or robots.txt is the kind of thing nobody
 *    notices for three months.
 */

import {
  copyFileSync, mkdirSync, existsSync, statSync, readFileSync, writeFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

/* ------------------------------------------------ service worker shell --- */

/** Every directory in dist/ that contains a prerendered index.html. */
function prerenderedRoutes(dir = dist, prefix = '') {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'assets' || entry.name.startsWith('.')) continue;
    const child = resolve(dir, entry.name);
    const path = `${prefix}/${entry.name}`;
    if (existsSync(resolve(child, 'index.html'))) routes.push(path);
    routes.push(...prerenderedRoutes(child, path));
  }
  return routes;
}

const swPath = resolve(dist, 'sw.js');
if (existsSync(swPath)) {
  const routes = ['/', ...prerenderedRoutes().sort()];
  const sw = readFileSync(swPath, 'utf8');
  if (!sw.includes('__PRERENDERED_ROUTES__')) {
    console.error('[postbuild] sw.js is missing the __PRERENDERED_ROUTES__ placeholder.');
    process.exit(1);
  }
  const patched = sw.replaceAll('__PRERENDERED_ROUTES__', JSON.stringify(routes));
  if (patched.includes('__PRERENDERED_ROUTES__')) {
    console.error('[postbuild] failed to substitute the sw.js route placeholder.');
    process.exit(1);
  }
  writeFileSync(swPath, patched, 'utf8');
  console.log(`[postbuild] sw.js precache list -> ${routes.length} routes`);
} else {
  console.error('[postbuild] dist/sw.js not found.');
  process.exit(1);
}

// --- 1. .well-known -------------------------------------------------------
const src = resolve(root, 'public/security.txt');
if (existsSync(src)) {
  const outDir = resolve(dist, '.well-known');
  mkdirSync(outDir, { recursive: true });
  copyFileSync(src, resolve(outDir, 'security.txt'));
  console.log('[postbuild] copied .well-known/security.txt into dist/');
}

// --- 2. verify required artefacts ----------------------------------------
const REQUIRED = [
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'site.webmanifest',
  'sw.js',
  'favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'og-image.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  '.well-known/security.txt',
];

const missing = [];
for (const rel of REQUIRED) {
  const p = resolve(dist, rel);
  if (!existsSync(p) || statSync(p).size === 0) missing.push(rel);
}

if (missing.length) {
  console.error(`[postbuild] FAILED — missing or empty in dist/:\n  - ${missing.join('\n  - ')}`);
  process.exit(1);
}

console.log(`[postbuild] verified ${REQUIRED.length} required files in dist/`);
