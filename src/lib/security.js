/**
 * Security helpers.
 *
 * Reminder that outlives the original README note: every check in this file is
 * a UX affordance, not a security boundary. A user can bypass all of it with
 * devtools. The authoritative copies live in Firestore Security Rules
 * (firebase/firestore.rules) and the Cloud Functions in functions/.
 */

/** HTML-escape a value for safe interpolation into innerHTML. */
export function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`=/]/g, (c) => HTML_ENTITIES[c]);
}

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
  '/': '&#47;',
};

/** Escape for use inside an HTML attribute value. */
export function escapeAttr(value) {
  return escapeHTML(value);
}

/**
 * Tagged template that escapes every interpolated value.
 *   html`<h3>${userName}</h3>`
 * Static markup in the template literal passes through untouched.
 */
export function html(strings, ...values) {
  return strings.reduce((out, str, i) => {
    const v = values[i - 1];
    const safe = Array.isArray(v) ? v.join('') : escapeHTML(v);
    return out + safe + str;
  });
}

/** Mark a pre-built, trusted HTML string so `html` won't double-escape it. */
export function raw(markup) {
  // Arrays pass through `html` unescaped — this is the documented escape hatch.
  return [String(markup)];
}

/**
 * Only allow URL schemes we intend to navigate to.
 * Blocks javascript:, data:, vbscript:, file: and friends.
 */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'tel:', 'mailto:']);

export function sanitizeURL(url, { base = window.location.origin } = {}) {
  const raw = String(url ?? '').trim();
  if (!raw) return '#';

  // A string containing a scheme-like prefix ("foo:" / "ht!tp://") must never
  // be silently reinterpreted as a relative path and joined onto our origin.
  // Only resolve against `base` when the input is unambiguously relative.
  const schemeLike = /^[^/?#]*:/.test(raw);
  if (schemeLike) {
    try {
      const direct = new URL(raw);
      return SAFE_SCHEMES.has(direct.protocol) ? direct.href : '#';
    } catch {
      return '#';
    }
  }

  try {
    const parsed = new URL(raw, base);
    if (!SAFE_SCHEMES.has(parsed.protocol)) return '#';
    return parsed.href;
  } catch {
    return '#';
  }
}

/** Build a tel: URI from a validated Indian mobile number. */
export function telURL(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `tel:+91${digits}`;
}

/** Build a wa.me URL with an encoded prefilled message. */
export function whatsappURL(phone, message = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/91${digits}${text}`;
}

/**
 * Strip control characters and clamp length before anything is persisted.
 * Defence in depth — the Cloud Function repeats this server-side.
 */
export function sanitizeText(value, maxLength = 500) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** Collapse runs of whitespace. */
export function normalizeSpace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Simple client-side rate limiter for abuse-prone actions. Purely to stop
 * accidental double-submits and casual spam; the real limit is server-side.
 */
const buckets = new Map();

export function rateLimit(key, { max = 5, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { allowed: false, retryAfter };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfter: 0 };
}

/** Generate a CSRF-ish nonce for form submissions (paired with App Check). */
export function nonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
