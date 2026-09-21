/**
 * Seed-data coherence tests.
 *
 * Demo mode IS the product for anyone who opens the site without Firebase
 * configured, so the fixtures are user-facing content, not scratch data. They
 * also define the document shape the Firestore rules and queries expect, which
 * means a drift here shows up as a rules rejection in production rather than a
 * test failure locally.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WORKERS, JOBS, REVIEWS, STATS } from '../src/data/seed.js';
import { CATEGORIES, CITIES } from '../src/data/categories.js';
import { PATTERNS, LIMITS } from '../src/lib/validation.js';
import { tradeIcon, icon } from '../src/lib/icons.js';

// Written as an alternation, not a class: \u{FE0F} after a range reads as a
// modifier of that range and trips no-misleading-character-class.
const EMOJI = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|\u{FE0F}/u;

const TRADES = new Set(CATEGORIES.map((c) => c.slug));
const CITY_NAMES = new Set(CITIES);

describe('workers fixture', () => {
  it('has unique ids', () => {
    const ids = WORKERS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses trades that exist as categories', () => {
    for (const w of WORKERS) expect(TRADES, w.id).toContain(w.trade);
  });

  it('only uses cities offered in the filter', () => {
    for (const w of WORKERS) expect(CITY_NAMES, w.id).toContain(w.city);
  });

  it('has phone numbers that pass our own validator', () => {
    for (const w of WORKERS) {
      expect(PATTERNS.phone.test(w.phone), `${w.id} ${w.phone}`).toBe(true);
    }
  });

  it('has ratings in range and consistent with having reviews', () => {
    for (const w of WORKERS) {
      expect(w.rating).toBeGreaterThanOrEqual(0);
      expect(w.rating).toBeLessThanOrEqual(5);
      expect(Number.isInteger(w.reviewCount)).toBe(true);
      if (w.reviewCount > 0) expect(w.rating).toBeGreaterThan(0);
    }
  });

  it('has a bio within the length the profile form allows', () => {
    for (const w of WORKERS) {
      expect(w.bio.length, w.id).toBeLessThanOrEqual(LIMITS.bio.max);
    }
  });

  it('uses no placeholder or lorem text', () => {
    for (const w of WORKERS) {
      expect(w.bio.toLowerCase()).not.toMatch(/lorem|ipsum|todo|xxx|test test/);
    }
  });
});

describe('jobs fixture', () => {
  it('has unique ids', () => {
    const ids = JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every job carries status:'open'", () => {
    // firestore.rules requires status on create and listJobs() filters on it.
    // Fixtures without it would work in demo mode and break against Firebase.
    for (const j of JOBS) expect(j.status, j.id).toBe('open');
  });

  it('uses known trades and cities', () => {
    for (const j of JOBS) {
      expect(TRADES, j.id).toContain(j.trade);
      expect(CITY_NAMES, j.id).toContain(j.city);
    }
  });

  it('has a coherent budget range', () => {
    for (const j of JOBS) {
      expect(j.budgetMin).toBeGreaterThan(0);
      expect(j.budgetMax).toBeGreaterThanOrEqual(j.budgetMin);
    }
  });

  it('uses a known urgency level', () => {
    for (const j of JOBS) {
      expect(['urgent', 'this-week', 'scheduled']).toContain(j.urgency);
    }
  });

  it('has a parseable ISO postedAt', () => {
    for (const j of JOBS) {
      expect(Number.isNaN(Date.parse(j.postedAt)), j.id).toBe(false);
    }
  });
});

describe('reviews fixture', () => {
  it('has unique ids', () => {
    const ids = REVIEWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every review points at a real worker', () => {
    const ids = new Set(WORKERS.map((w) => w.id));
    for (const r of REVIEWS) expect(ids, r.id).toContain(r.workerId);
  });

  it('every worker advertising reviews actually has at least one', () => {
    // The worker card renders "Read N reviews" as a disclosure. If the
    // fixtures have no review for that worker, the user opens it to nothing —
    // which is exactly the "hidden reviews" anti-pattern for this product.
    const withReviews = new Set(REVIEWS.map((r) => r.workerId));
    const broken = WORKERS.filter((w) => w.reviewCount > 0 && !withReviews.has(w.id));
    expect(broken.map((w) => w.id)).toEqual([]);
  });

  it('has ratings between 1 and 5', () => {
    for (const r of REVIEWS) {
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);
      expect(Number.isInteger(r.rating)).toBe(true);
    }
  });

  it('has a non-trivial body within the allowed length', () => {
    for (const r of REVIEWS) {
      expect(r.body.length, r.id).toBeGreaterThan(20);
      expect(r.body.length, r.id).toBeLessThanOrEqual(LIMITS.reviewBody.max);
    }
  });

  it('has an author and a parseable date', () => {
    for (const r of REVIEWS) {
      expect(r.author.trim().length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(r.date)), r.id).toBe(false);
    }
  });

  it('contains no HTML that would need escaping to be safe', () => {
    // Not a security control (the renderer escapes); a content-quality check.
    for (const r of REVIEWS) expect(r.body).not.toMatch(/<[a-z/]/i);
  });
});

describe('stats fixture', () => {
  it('provides every counter the landing page renders', () => {
    for (const k of ['workers', 'jobsPosted', 'cities', 'avgResponse']) {
      expect(STATS[k], k).toBeTruthy();
    }
  });
});

describe('categories fixture', () => {
  it('has unique slugs, each with an English and a Hindi name', () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CATEGORIES) {
      expect(c.name.trim(), c.slug).toBeTruthy();
      expect(c.hindi.trim(), c.slug).toBeTruthy();
      expect(c.typicalRate, c.slug).toBeGreaterThan(0);
    }
  });

  it('uses url-safe slugs', () => {
    // Slugs land in ?trade= and in the Firestore query, so keep them plain.
    for (const c of CATEGORIES) expect(c.slug).toMatch(/^[a-z][a-z-]*$/);
  });

  it('every category resolves to a real inline icon', () => {
    // Priority-4 rule from the design skill: emoji are never icons. Every
    // trade must map to an actual SVG, not fall through to a generic default
    // that would make the category grid look unfinished.
    for (const c of CATEGORIES) {
      // tradeIcon() maps a trade to an icon NAME; icon() renders the markup.
      const name = tradeIcon(c.slug);
      expect(name, c.slug).toMatch(/^[a-zA-Z]+$/);
      const svg = icon(name, { size: 24 });
      expect(svg, `${c.slug} -> ${name}`).toMatch(/<svg/);
      expect(svg, c.slug).not.toMatch(EMOJI);
    }
  });

  it('contains no emoji in any user-visible label', () => {
    for (const c of CATEGORIES) {
      expect(c.name, c.slug).not.toMatch(EMOJI);
      expect(c.hindi, c.slug).not.toMatch(EMOJI);
    }
  });
});

describe('applied-state buttons stay accessible', () => {
  const jobsSrc = readFileSync(resolve(__dirname, '../src/pages/jobs.js'), 'utf8');
  const css = readFileSync(resolve(__dirname, '../src/styles/main.css'), 'utf8');

  it('marks an applied job with aria-disabled, not the disabled property', () => {
    // Browsers blur a focused element when it becomes disabled, dumping a
    // keyboard user at the top of the page immediately after they press
    // Enter. aria-disabled keeps the button focusable and still announces it.
    expect(jobsSrc).toMatch(/setAttribute\('aria-disabled', 'true'\)/);
    expect(jobsSrc).not.toMatch(/function markApplied[\s\S]{0,400}btn\.disabled = true/);
  });

  it('still refuses to act on an aria-disabled button', () => {
    expect(jobsSrc).toMatch(/getAttribute\('aria-disabled'\) === 'true'\) return/);
  });

  it('styles aria-disabled buttons as unavailable', () => {
    expect(css).toMatch(/\[aria-disabled="true"\][\s\S]{0,120}cursor: not-allowed/);
  });

  it('suppresses hover and active effects on aria-disabled buttons', () => {
    // Otherwise a finished button still lifts and recolours on hover, which
    // reads as "clickable" to a sighted user.
    const hoverRules = css.match(/\.btn-[a-z]+:hover:not\(:disabled\)[^{]*/g) ?? [];
    for (const r of hoverRules) {
      expect(r, r).toContain('[aria-disabled="true"]');
    }
    expect(css).toMatch(/\.btn:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)/);
  });
});
