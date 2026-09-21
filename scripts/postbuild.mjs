/**
 * Post-build fixups that Vite cannot do itself.
 *
 * 1. Vite's publicDir copier ignores dot-prefixed directories, so
 *    public/.well-known/ never reaches dist/. RFC 9116 requires
 *    /.well-known/security.txt to exist at exactly that path, so copy it.
 *
 * 2. Verify the files search engines and crawlers depend on actually shipped.
 *    A silently missing sitemap or robots.txt is the kind of thing nobody
 *    notices for three months.
 */

import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

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
