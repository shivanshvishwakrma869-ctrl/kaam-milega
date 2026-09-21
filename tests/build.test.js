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
import { WORKERS, JOBS, REVIEWS } from '../src/data/seed.js';
import { CATEGORIES } from '../src/data/categories.js';

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
    // 6 static routes + one page per category that actually has a worker.
    // Empty categories are deliberately excluded: they are prerendered as
    // noindex, and a sitemap must never advertise a noindex URL.
    const populated = new Set(WORKERS.map((w) => w.trade));
    expect(locs.length).toBe(6 + populated.size);
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

describe.runIf(built)('prerendered content is real, not skeletons', () => {
  it('ships zero loading skeletons in any prerendered route', () => {
    // A crawler (and a WhatsApp link preview) sees the first byte. If that
    // byte says "Loading workers..." the page is worthless for SEO and for
    // sharing, which is the whole reason prerendering exists here.
    for (const f of [
      'index.html', 'workers/index.html', 'jobs/index.html',
      'about/index.html', 'privacy/index.html', 'terms/index.html',
    ]) {
      expect(read(f), f).not.toMatch(/class="[^"]*skeleton/);
    }
  });

  it('the workers page lists every seeded worker', () => {
    const html = read('workers/index.html');
    const cards = html.match(/class="[^"]*worker-card/g) ?? [];
    expect(cards.length).toBe(WORKERS.length);
    for (const w of WORKERS) expect(html, w.id).toContain(w.name);
  });

  it('the jobs page lists every open job', () => {
    const html = read('jobs/index.html');
    const cards = html.match(/class="[^"]*job-card/g) ?? [];
    expect(cards.length).toBe(JOBS.length);
    for (const j of JOBS) expect(html, j.id).toContain(j.title);
  });

  it('the home page ships featured workers and real reviews', () => {
    const html = read('index.html');
    expect((html.match(/class="[^"]*worker-card/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // "never hide reviews" — they must be in the served HTML, not JS-only.
    expect(html).toContain(REVIEWS[0].author);
  });

  it('exposes a per-worker reviews disclosure on every card', () => {
    const html = read('workers/index.html');
    const n = (html.match(/data-reviews-for=/g) ?? []).length;
    expect(n).toBe(WORKERS.filter((w) => w.reviewCount > 0).length);
  });

  it('leaves no element stuck in aria-busy="true"', () => {
    for (const f of ['index.html', 'workers/index.html', 'jobs/index.html']) {
      expect(read(f), f).not.toContain('aria-busy="true"');
    }
  });

  it('does not leak demo localStorage state into the HTML', () => {
    for (const f of ['index.html', 'workers/index.html', 'jobs/index.html']) {
      expect(read(f), f).not.toContain('km:demo-user');
    }
  });

  it('keeps each prerendered page small enough to stay fast', () => {
    for (const f of ['index.html', 'workers/index.html', 'jobs/index.html']) {
      const kb = Buffer.byteLength(read(f)) / 1024;
      expect(kb, `${f} is ${kb.toFixed(0)}kB`).toBeLessThan(120);
    }
  });
});

describe('CSS custom properties resolve', () => {
  const css = readFileSync(resolve(__dirname, '../src/styles/main.css'), 'utf8');
  const tokens = readFileSync(resolve(__dirname, '../src/styles/tokens.css'), 'utf8');

  it('every var() used in main.css is defined, or has a fallback', () => {
    // An undefined custom property does not error — it silently renders as
    // nothing, so a typo becomes an invisible layout bug. Anything without a
    // definition must at least carry a var(--x, fallback).
    const defined = new Set(
      [...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g), ...css.matchAll(/(--[a-z0-9-]+)\s*:/g)]
        .map((m) => m[1]),
    );
    const undefinedNoFallback = [...css.matchAll(/var\((--[a-z0-9-]+)\s*(,?)/g)]
      .filter(([, name, comma]) => !defined.has(name) && comma !== ',')
      .map(([, name]) => name);
    expect(undefinedNoFallback).toEqual([]);
  });

  it('defines every semantic colour token in both themes', () => {
    const light = tokens.slice(0, tokens.indexOf('prefers-color-scheme: dark'));
    const dark = tokens.slice(tokens.indexOf('prefers-color-scheme: dark'));
    const semantic = [...light.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    expect(semantic.length).toBeGreaterThan(10);
    // Tokens that must flip between themes or the dark UI breaks.
    for (const t of ['--color-background', '--color-foreground', '--color-border-subtle']) {
      expect(semantic, t).toContain(t);
      expect(dark, `${t} missing a dark value`).toContain(t);
    }
  });
});

describe.runIf(built)('category landing pages', () => {
  const populated = [...new Set(WORKERS.map((w) => w.trade))];

  it('prerenders a page for every category', () => {
    for (const c of CATEGORIES) {
      expect(existsSync(resolve(dist, `workers/${c.slug}/index.html`)), c.slug).toBe(true);
    }
  });

  it('gives each category its own self-referencing canonical', () => {
    // The previous /workers?trade=x URLs all canonicalised to /workers, so
    // Google dropped them as duplicates. Each page must point at itself.
    for (const c of CATEGORIES) {
      const html = read(`workers/${c.slug}/index.html`);
      const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
      expect(canonical, c.slug).toBe(`https://kaam-milega.netlify.app/workers/${c.slug}`);
    }
  });

  it('gives each category a unique title and description', () => {
    const titles = new Set();
    const descs = new Set();
    for (const c of CATEGORIES) {
      const html = read(`workers/${c.slug}/index.html`);
      titles.add(html.match(/<title>([^<]*)<\/title>/)[1]);
      descs.add(html.match(/name="description" content="([^"]*)"/)[1]);
    }
    expect(titles.size).toBe(CATEGORIES.length);
    expect(descs.size).toBe(CATEGORIES.length);
  });

  it('filters the listing to that trade only', () => {
    for (const slug of populated) {
      const html = read(`workers/${slug}/index.html`);
      const shown = WORKERS.filter((w) => html.includes(w.name));
      expect(shown.length, slug).toBeGreaterThan(0);
      for (const w of shown) expect(w.trade, `${w.name} on /${slug}`).toBe(slug);
    }
  });

  it('marks empty categories noindex instead of shipping a thin page', () => {
    for (const c of CATEGORIES) {
      const html = read(`workers/${c.slug}/index.html`);
      const empty = !populated.includes(c.slug);
      expect(/noindex/.test(html), `${c.slug} empty=${empty}`).toBe(empty);
    }
  });

  it('lists only indexable category pages in the sitemap', () => {
    const xml = read('sitemap.xml');
    // A sitemap must never advertise a noindex URL, and never a query string
    // that resolves to a different canonical.
    expect(xml).not.toContain('?trade=');
    for (const c of CATEGORIES) {
      const inSitemap = xml.includes(`/workers/${c.slug}<`);
      expect(inSitemap, c.slug).toBe(populated.includes(c.slug));
    }
  });

  it('links to category pages internally so they can be crawled', () => {
    // An orphan page in a sitemap gets crawled late and ranked poorly.
    const home = read('index.html');
    for (const slug of populated) {
      expect(home, slug).toContain(`/workers/${slug}`);
    }
  });
});
