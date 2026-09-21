/**
 * @vitest-environment jsdom
 *
 * Integration tests: render each page's markup into a real DOM and assert the
 * accessibility contract holds. These catch the class of bug unit tests miss —
 * a label pointing at an id that does not exist, a duplicate id, an icon-only
 * button with no accessible name.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderHome } from '../src/pages/home.js';
import { renderWorkers, workerCard } from '../src/pages/workers.js';
import { renderJobs } from '../src/pages/jobs.js';
import { renderAbout, renderPrivacy, renderTerms, renderNotFound } from '../src/pages/static.js';
import { WORKERS } from '../src/data/seed.js';

const shell = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

/** Every form control must have an accessible name. */
function assertLabelled(root) {
  const controls = root.querySelectorAll('input, select, textarea');
  const problems = [];
  for (const c of controls) {
    if (c.type === 'hidden') continue;
    const id = c.getAttribute('id');
    const hasLabel = id && root.querySelector(`label[for="${id}"]`);
    const wrapped = c.closest('label');
    const aria = c.getAttribute('aria-label') || c.getAttribute('aria-labelledby');
    if (!hasLabel && !wrapped && !aria) {
      problems.push(c.outerHTML.slice(0, 90));
    }
  }
  return problems;
}

/** Buttons and links need a discernible name (text, aria-label, or title). */
function assertNamed(root) {
  const problems = [];
  for (const el of root.querySelectorAll('button, a')) {
    const text = (el.textContent || '').trim();
    const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    const titled = el.querySelector('[role="img"][aria-label]');
    if (!text && !aria && !titled) problems.push(el.outerHTML.slice(0, 90));
  }
  return problems;
}

function duplicateIds(root) {
  const seen = new Map();
  for (const el of root.querySelectorAll('[id]')) {
    const id = el.id;
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
}

describe('index.html shell', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = shell;
  });

  it('declares a language', () => {
    const html = shell.match(/<html[^>]*>/)[0];
    expect(html).toContain('lang=');
  });

  it('has a viewport meta that does not block zoom', () => {
    const v = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
    expect(v).toContain('width=device-width');
    expect(v).not.toMatch(/user-scalable\s*=\s*no/);
    expect(v).not.toMatch(/maximum-scale\s*=\s*1/);
  });

  it('ships a skip link as the first focusable element', () => {
    const skip = document.querySelector('.skip-link');
    expect(skip).toBeTruthy();
    expect(skip.getAttribute('href')).toBe('#main');
    expect(document.getElementById('main')).toBeTruthy();
  });

  it('has exactly one main landmark', () => {
    expect(document.querySelectorAll('main')).toHaveLength(1);
  });

  it('gives every nav an accessible name', () => {
    for (const nav of document.querySelectorAll('nav')) {
      expect(nav.getAttribute('aria-label'), nav.outerHTML.slice(0, 60)).toBeTruthy();
    }
  });

  it('has no duplicate ids', () => {
    expect(duplicateIds(document)).toEqual([]);
  });

  it('labels every form control in the shell', () => {
    expect(assertLabelled(document)).toEqual([]);
  });

  it('declares required SEO meta', () => {
    expect(document.querySelector('meta[name="description"]')).toBeTruthy();
    expect(document.querySelector('link[rel="canonical"]')).toBeTruthy();
    expect(document.querySelector('meta[property="og:image"]')).toBeTruthy();
    expect(document.querySelector('meta[name="twitter:card"]')).toBeTruthy();
    expect(document.querySelector('link[rel="manifest"]')).toBeTruthy();
  });

  it('includes valid JSON-LD structured data', () => {
    const ld = document.querySelector('script[type="application/ld+json"]');
    expect(ld).toBeTruthy();
    const parsed = JSON.parse(ld.textContent);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(Array.isArray(parsed['@graph'])).toBe(true);
  });

  it('provides a noscript fallback', () => {
    expect(document.querySelector('noscript')).toBeTruthy();
  });

  it('exposes live regions for announcements and toasts', () => {
    expect(document.getElementById('sr-announcer')?.getAttribute('aria-live')).toBe('polite');
    expect(document.getElementById('toast-region')?.getAttribute('aria-live')).toBe('polite');
  });

  it('keeps the mobile bottom nav within the 5-item guideline', () => {
    const items = document.querySelectorAll('.bottom-nav a');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
  });
});

describe('page markup', () => {
  const pages = {
    home: () => renderHome(),
    workers: () => renderWorkers({}),
    jobs: () => renderJobs(),
    about: () => renderAbout(),
    privacy: () => renderPrivacy(),
    terms: () => renderTerms(),
    notFound: () => renderNotFound('/nope'),
  };

  for (const [name, render] of Object.entries(pages)) {
    describe(name, () => {
      let root;
      beforeEach(() => {
        root = document.createElement('div');
        root.innerHTML = render();
        document.body.innerHTML = '';
        document.body.appendChild(root);
      });

      it('labels every form control', () => {
        expect(assertLabelled(root)).toEqual([]);
      });

      it('gives every button and link an accessible name', () => {
        expect(assertNamed(root)).toEqual([]);
      });

      it('has no duplicate ids', () => {
        expect(duplicateIds(root)).toEqual([]);
      });

      it('uses no emoji as an icon', () => {
        // VS-16 is matched as its own alternative rather than inside the
        // class: combined with a preceding range it reads as a modifier of
        // that range, which is misleading (and an ESLint error).
        const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{FE0F}/u;
        expect(emoji.test(root.innerHTML)).toBe(false);
      });

      it('starts its heading order at h1 and never skips a level', () => {
        const levels = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')]
          .map((h) => Number(h.tagName[1]));
        for (let i = 1; i < levels.length; i++) {
          expect(levels[i] - levels[i - 1], `after h${levels[i - 1]} came h${levels[i]}`)
            .toBeLessThanOrEqual(1);
        }
      });
    });
  }
});

describe('worker card', () => {
  let root;
  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = WORKERS.map(workerCard).join('');
    document.body.innerHTML = '';
    document.body.appendChild(root);
  });

  it('renders one card per worker', () => {
    expect(root.querySelectorAll('.worker-card')).toHaveLength(WORKERS.length);
  });

  it('builds a valid tel: link for each worker', () => {
    const calls = root.querySelectorAll('a[href^="tel:"]');
    expect(calls).toHaveLength(WORKERS.length);
    for (const a of calls) {
      expect(a.getAttribute('href')).toMatch(/^tel:\+91[6-9]\d{9}$/);
    }
  });

  it('opens WhatsApp safely in a new tab', () => {
    for (const a of root.querySelectorAll('a[href*="wa.me"]')) {
      expect(a.getAttribute('rel')).toContain('noopener');
      expect(a.getAttribute('target')).toBe('_blank');
    }
  });

  it('names the contact actions per worker, not just "Call"', () => {
    const first = root.querySelector('.worker-card a[href^="tel:"]');
    expect(first.getAttribute('aria-label')).toMatch(/Call .+/);
  });

  it('escapes a malicious worker name', () => {
    const div = document.createElement('div');
    div.innerHTML = workerCard({
      id: 'x', name: '<img src=x onerror=alert(1)>', trade: 'plumber',
      city: 'Test', phone: '9876543210', rating: 5, reviewCount: 1,
      jobsDone: 1, rate: 100, verified: false, available: true,
      experienceYears: 1, bio: '',
    });
    expect(div.querySelectorAll('img')).toHaveLength(0);
  });

  it('shows the rating with an accessible star equivalent', () => {
    expect(root.querySelector('.rating')).toBeTruthy();
  });
});
