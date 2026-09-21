/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { formatINR, formatRange, initials, starRow, emptyState, skeletonCards } from '../src/lib/ui.js';
import { icon, tradeIcon, ICON_NAMES } from '../src/lib/icons.js';

describe('currency formatting', () => {
  it('formats rupees in the Indian numbering system', () => {
    // en-IN groups as 1,00,000 rather than 100,000.
    expect(formatINR(100000)).toMatch(/1,00,000/);
  });

  it('shows no decimal places', () => {
    expect(formatINR(600)).not.toContain('.');
  });

  it('handles a non-numeric value without throwing', () => {
    expect(formatINR('abc')).toBe('—');
    expect(formatINR(null)).toBe('—');
  });

  it('formats a range with an en dash', () => {
    expect(formatRange(800, 2000)).toContain('–');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Rahul Kumar')).toBe('RK');
  });

  it('handles a single name', () => {
    expect(initials('Rahul')).toBe('R');
  });

  it('ignores extra whitespace', () => {
    expect(initials('  Rahul   Kumar  ')).toBe('RK');
  });

  it('falls back for empty input', () => {
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });
});

describe('icons', () => {
  it('renders an SVG', () => {
    expect(icon('star')).toContain('<svg');
  });

  it('marks an untitled icon as decorative', () => {
    const svg = icon('star');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
  });

  it('marks a titled icon as meaningful', () => {
    const svg = icon('star', { title: 'Rating' });
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Rating"');
    expect(svg).not.toContain('aria-hidden');
  });

  it('escapes a title containing markup', () => {
    expect(icon('star', { title: '"><script>' })).not.toContain('<script>');
  });

  it('returns an empty string for an unknown icon instead of throwing', () => {
    expect(icon('definitely-not-an-icon')).toBe('');
  });

  it('uses currentColor so icons inherit text colour', () => {
    expect(icon('star')).toContain('stroke="currentColor"');
  });

  it('maps every trade to a real icon name', () => {
    for (const slug of ['electrician', 'plumber', 'tailor', 'designer']) {
      expect(ICON_NAMES).toContain(tradeIcon(slug));
    }
  });

  it('falls back to a generic icon for an unknown trade', () => {
    expect(tradeIcon('unknown-trade')).toBe('briefcase');
  });

  it('ships no emoji in any icon definition', () => {
    // The skill's priority-4 rule: no emoji as icons.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const name of ICON_NAMES) {
      expect(emoji.test(icon(name)), name).toBe(false);
    }
  });
});

describe('starRow', () => {
  it('exposes an accessible text equivalent', () => {
    expect(starRow(4)).toContain('aria-label="4 out of 5 stars"');
  });

  it('rounds a fractional rating', () => {
    expect(starRow(4.7)).toContain('5 out of 5');
  });

  it('always renders five stars', () => {
    expect((starRow(3).match(/<svg/g) || []).length).toBe(5);
  });
});

describe('emptyState', () => {
  it('escapes interpolated content', () => {
    const out = emptyState({
      title: '<script>alert(1)</script>',
      message: 'safe',
    });
    expect(out).not.toContain('<script>');
  });

  it('omits the action button when no label is given', () => {
    expect(emptyState({ title: 'x', message: 'y' })).not.toContain('<button');
  });
});

describe('skeletonCards', () => {
  it('renders the requested count', () => {
    expect((skeletonCards(3).match(/skeleton-card/g) || []).length).toBe(3);
  });

  it('hides skeletons from assistive technology', () => {
    expect(skeletonCards(1)).toContain('aria-hidden="true"');
  });
});

describe('DOM smoke test', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders escaped worker content into the DOM without executing script', () => {
    const div = document.createElement('div');
    div.innerHTML = emptyState({ title: '<img src=x onerror=alert(1)>', message: 'test' });
    document.body.appendChild(div);
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });
});
