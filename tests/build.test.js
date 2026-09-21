/**
 * Build-output contract tests.
 *
 * These run against dist/ and only when it exists, so `npm test` still works
 * on a clean checkout. `npm run verify` builds first, so CI always covers them.
 *
 * They guard the things that break silently and get noticed months later: a
 * missing sitemap, a prerendered page that lost its content, a canonical URL
 * pointing at the wrong route.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(__dirname, '../dist');
const built = existsSync(resolve(dist, 'index.html'));
const read = (p) => readFileSync(resolve(dist, p), 'utf8');

describe.runIf(built)('prerendered routes', () => {
  const routes = [
    { file: 'index.html', path: '/', marker: 'hero-title' },
    { file: 'workers/index.html', path: '/workers', marker: 'filter-form' },
    { file: 'jobs/index.html', path: '/jobs', marker: 'job-chips' },
    { file: 'about/index.html', path: '/about', marker: 'word of mouth' },
    { file: 'privacy/index.html', path: '/privacy', marker: 'What we collect' },
    { file: 'terms/index.html', path: '/terms', marker: 'introduction service' },
  ];

  for (const { file, path, marker } of routes) {
    describe(path, () => {
      it('exists', () => {
        expect(existsSync(resolve(dist, file)), file).toBe(true);
      });

      it('ships real content, not an empty shell', () => {
        const html = read(file);
        const view = html.match(/<div id="view"[^>]*>([\s\S]*)<\/div>\s*<\/div>\s*<\/main>/);
        expect(view, 'could not locate #view').toBeTruthy();
        expect(view[1].trim().length).toBeGreaterThan(400);
      });

      it('contains its page-specific content', () => {
        expect(read(file)).toContain(marker);
      });

      it('has a canonical URL matching its own route', () => {
        const html = read(file);
        const canonical = html.match(/rel="canonical"\s+href="([^"]+)"/)?.[1];
        expect(canonical).toBeTruthy();
        expect(new URL(canonical).pathname).toBe(path);
      });

      it('has a unique, non-default title', () => {
        const title = read(file).match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
        expect(title.length).toBeGreaterThan(10);
        expect(title).toContain('KaamMilega');
      });

      it('keeps the module script tag so the SPA hydrates', () => {
        expect(read(file)).toMatch(/<script[^>]*type="module"[^>]*src="\/assets\//);
      });
    });
  }

  it('gives every route a distinct title', () => {
    const titles = routes.map(
      (r) => read(r.file).match(/<title>([\s\S]*?)<\/title>/)?.[1],
    );
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe.runIf(built)('SEO artefacts', () => {
  it('ships robots.txt pointing at the sitemap', () => {
    const txt = read('robots.txt');
    expect(txt).toMatch(/^Sitemap:\s*https?:\/\/.+\/sitemap\.xml$/m);
    expect(txt).toMatch(/^User-agent: \*/m);
  });

  it('keeps the private profile route out of the index', () => {
    expect(read('robots.txt')).toMatch(/Disallow:\s*\/profile/);
  });

  it('ships a well-formed sitemap', () => {
    const xml = read('sitemap.xml');
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<urlset');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThanOrEqual(18);
    for (const loc of locs) {
      expect(() => new URL(loc.replace(/&amp;/g, '&')), loc).not.toThrow();
    }
  });

  it('escapes ampersands in sitemap URLs', () => {
    const xml = read('sitemap.xml');
    // A bare & inside <loc> is invalid XML.
    expect(xml).not.toMatch(/<loc>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('excludes the noindex profile route from the sitemap', () => {
    expect(read('sitemap.xml')).not.toMatch(/<loc>[^<]*\/profile<\/loc>/);
  });

  it('ships llms.txt with the expected structure', () => {
    const txt = read('llms.txt');
    expect(txt.startsWith('# KaamMilega')).toBe(true);
    expect(txt).toContain('> ');
    expect(txt).toContain('## Pages');
  });

  it('ships security.txt at the RFC 9116 path with a future expiry', () => {
    expect(existsSync(resolve(dist, '.well-known/security.txt'))).toBe(true);
    const txt = read('.well-known/security.txt');
    expect(txt).toMatch(/^Contact:/m);
    const expires = txt.match(/^Expires:\s*(.+)$/m)?.[1];
    expect(new Date(expires).getTime()).toBeGreaterThan(Date.now());
  });

  it('ships a valid web manifest', () => {
    const m = JSON.parse(read('site.webmanifest'));
    expect(m.name).toBeTruthy();
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    const purposes = m.icons.map((i) => i.purpose);
    expect(purposes).toContain('maskable');
    expect(purposes).toContain('any');
  });

  it('references icons that actually exist', () => {
    const m = JSON.parse(read('site.webmanifest'));
    for (const i of m.icons) {
      expect(existsSync(resolve(dist, i.src.replace(/^\//, ''))), i.src).toBe(true);
    }
  });
});

describe.runIf(built)('bundle budget', () => {
  it('keeps the app chunk small enough for a 3G connection', () => {
    const { readdirSync, statSync } = require('node:fs');
    const assets = readdirSync(resolve(dist, 'assets'));
    const appChunk = assets.find((f) => /^index-.*\.js$/.test(f));
    expect(appChunk).toBeTruthy();
    const bytes = statSync(resolve(dist, 'assets', appChunk)).size;
    // Uncompressed; ~24 kB gzipped at time of writing.
    expect(bytes).toBeLessThan(150_000);
  });

  it('does not eagerly preload the Firebase chunk on first paint', () => {
    const html = read('index.html');
    const preloads = [...html.matchAll(/rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(preloads.some((p) => p.includes('firebase'))).toBe(false);
  });
});
