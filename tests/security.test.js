import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  escapeHTML, html, raw, sanitizeURL, telURL, whatsappURL,
  sanitizeText, normalizeSpace, rateLimit,
} from '../src/lib/security.js';

describe('escapeHTML', () => {
  it('neutralises a script tag', () => {
    expect(escapeHTML('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('escapes every dangerous character', () => {
    expect(escapeHTML('&')).toBe('&amp;');
    expect(escapeHTML('<')).toBe('&lt;');
    expect(escapeHTML('>')).toBe('&gt;');
    expect(escapeHTML('"')).toBe('&quot;');
    expect(escapeHTML("'")).toBe('&#39;');
    expect(escapeHTML('`')).toBe('&#96;');
    expect(escapeHTML('=')).toBe('&#61;');
    expect(escapeHTML('/')).toBe('&#47;');
  });

  it('handles null and undefined without throwing', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
  });

  it('blocks an attribute-breakout payload', () => {
    const out = escapeHTML('" onerror="alert(1)');
    expect(out).not.toContain('"');
    expect(out).not.toMatch(/onerror="/);
  });
});

describe('html tagged template', () => {
  it('escapes interpolated values but not the static markup', () => {
    const out = html`<h3>${'<img onerror=x>'}</h3>`;
    expect(out.startsWith('<h3>')).toBe(true);
    expect(out).not.toContain('<img');
  });

  it('lets pre-trusted markup through via raw()', () => {
    const out = html`<div>${raw('<b>bold</b>')}</div>`;
    expect(out).toBe('<div><b>bold</b></div>');
  });
});

describe('sanitizeURL', () => {
  const base = 'https://example.com';

  it('blocks javascript: URLs', () => {
    expect(sanitizeURL('javascript:alert(1)', { base })).toBe('#');
  });

  it('blocks data: URLs', () => {
    expect(sanitizeURL('data:text/html,<script>', { base })).toBe('#');
  });

  it('allows http, https, tel and mailto', () => {
    expect(sanitizeURL('https://x.com/', { base })).toContain('https://');
    expect(sanitizeURL('tel:+919876543210', { base })).toContain('tel:');
    expect(sanitizeURL('mailto:a@b.com', { base })).toContain('mailto:');
  });

  it('returns # for malformed input instead of throwing', () => {
    expect(sanitizeURL('ht!tp://%%%', { base })).toBe('#');
  });
});

describe('contact URL builders', () => {
  it('builds a tel: URI for a valid number', () => {
    expect(telURL('9876543210')).toBe('tel:+919876543210');
  });

  it('returns null for an invalid number rather than a broken link', () => {
    expect(telURL('123')).toBeNull();
    expect(telURL('1234567890')).toBeNull();
  });

  it('percent-encodes the WhatsApp message', () => {
    const url = whatsappURL('9876543210', 'Hi & hello');
    expect(url).toContain('wa.me/919876543210');
    expect(url).toContain('%26');
    expect(url).not.toContain('& hello');
  });

  it('does not inject a query when there is no message', () => {
    expect(whatsappURL('9876543210')).toBe('https://wa.me/919876543210');
  });
});

describe('sanitizeText', () => {
  it('removes control characters', () => {
    expect(sanitizeText('a\u0000b\u001Fc')).toBe('abc');
  });

  it('clamps to the requested length', () => {
    expect(sanitizeText('x'.repeat(100), 10).length).toBe(10);
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  hi  ')).toBe('hi');
  });

  it('preserves Devanagari text', () => {
    expect(sanitizeText('बिजली मिस्त्री')).toBe('बिजली मिस्त्री');
  });
});

describe('normalizeSpace', () => {
  it('collapses runs of whitespace', () => {
    expect(normalizeSpace('a   b \n c')).toBe('a b c');
  });
});

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  it('allows up to the limit then blocks', () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, { max: 3, windowMs: 1000 }).allowed).toBe(true);
    }
    expect(rateLimit(key, { max: 3, windowMs: 1000 }).allowed).toBe(false);
  });

  it('reports how long to wait', () => {
    const key = `test-${Math.random()}`;
    rateLimit(key, { max: 1, windowMs: 60_000 });
    const blocked = rateLimit(key, { max: 1, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('lets requests through again once the window passes', () => {
    const key = `test-${Math.random()}`;
    rateLimit(key, { max: 1, windowMs: 1000 });
    expect(rateLimit(key, { max: 1, windowMs: 1000 }).allowed).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(rateLimit(key, { max: 1, windowMs: 1000 }).allowed).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, { max: 1, windowMs: 1000 });
    expect(rateLimit(a, { max: 1, windowMs: 1000 }).allowed).toBe(false);
    expect(rateLimit(b, { max: 1, windowMs: 1000 }).allowed).toBe(true);
  });
});
