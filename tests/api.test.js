import { describe, it, expect } from 'vitest';
import { filterWorkers } from '../src/lib/api.js';
import { WORKERS } from '../src/data/seed.js';
import { CATEGORIES, CATEGORY_BY_SLUG, categoryName } from '../src/data/categories.js';
import { TRADE_ICONS } from '../src/lib/icons.js';

const base = {
  trade: '', city: '', q: '',
  availableOnly: false, verifiedOnly: false,
  sort: 'rating', limit: 50,
};

describe('filterWorkers', () => {
  it('returns everything with no filters', () => {
    expect(filterWorkers(WORKERS, base)).toHaveLength(WORKERS.length);
  });

  it('filters by trade', () => {
    const r = filterWorkers(WORKERS, { ...base, trade: 'electrician' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((w) => w.trade === 'electrician')).toBe(true);
  });

  it('filters by city', () => {
    const r = filterWorkers(WORKERS, { ...base, city: 'Lucknow' });
    expect(r.every((w) => w.city === 'Lucknow')).toBe(true);
  });

  it('filters to available only', () => {
    expect(filterWorkers(WORKERS, { ...base, availableOnly: true }).every((w) => w.available)).toBe(true);
  });

  it('filters to verified only', () => {
    expect(filterWorkers(WORKERS, { ...base, verifiedOnly: true }).every((w) => w.verified)).toBe(true);
  });

  it('combines filters', () => {
    const r = filterWorkers(WORKERS, { ...base, city: 'Ayodhya', verifiedOnly: true });
    expect(r.every((w) => w.city === 'Ayodhya' && w.verified)).toBe(true);
  });

  it('matches free text case-insensitively across name, trade, city and bio', () => {
    expect(filterWorkers(WORKERS, { ...base, q: 'RAHUL' }).length).toBeGreaterThan(0);
    expect(filterWorkers(WORKERS, { ...base, q: 'wiring' }).length).toBeGreaterThan(0);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterWorkers(WORKERS, { ...base, q: 'zzzznotathing' })).toHaveLength(0);
  });

  it('sorts by rating descending by default', () => {
    const r = filterWorkers(WORKERS, base);
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].rating).toBeGreaterThanOrEqual(r[i].rating);
    }
  });

  it('sorts by lowest rate when asked', () => {
    const r = filterWorkers(WORKERS, { ...base, sort: 'rate' });
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].rate).toBeLessThanOrEqual(r[i].rate);
    }
  });

  it('sorts by jobs done descending', () => {
    const r = filterWorkers(WORKERS, { ...base, sort: 'jobs' });
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].jobsDone).toBeGreaterThanOrEqual(r[i].jobsDone);
    }
  });

  it('respects the limit', () => {
    expect(filterWorkers(WORKERS, { ...base, limit: 2 })).toHaveLength(2);
  });

  it('does not mutate the source array', () => {
    const before = WORKERS.map((w) => w.id).join(',');
    filterWorkers(WORKERS, { ...base, sort: 'rate' });
    expect(WORKERS.map((w) => w.id).join(',')).toBe(before);
  });
});

describe('data integrity', () => {
  it('every seeded worker uses a known trade slug', () => {
    for (const w of WORKERS) {
      expect(CATEGORY_BY_SLUG[w.trade], `${w.name} -> ${w.trade}`).toBeDefined();
    }
  });

  it('every category has an icon mapping', () => {
    for (const c of CATEGORIES) {
      expect(TRADE_ICONS[c.slug], c.slug).toBeDefined();
    }
  });

  it('every seeded phone number is a valid Indian mobile', () => {
    for (const w of WORKERS) {
      expect(/^[6-9]\d{9}$/.test(w.phone), `${w.name}: ${w.phone}`).toBe(true);
    }
  });

  it('worker ids are unique', () => {
    const ids = WORKERS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ratings sit within 0-5', () => {
    for (const w of WORKERS) {
      expect(w.rating).toBeGreaterThanOrEqual(0);
      expect(w.rating).toBeLessThanOrEqual(5);
    }
  });

  it('categoryName falls back gracefully for an unknown slug', () => {
    expect(categoryName('not-a-trade')).toBe('Other');
    expect(categoryName('electrician')).toBe('Electrician');
  });
});
