/**
 * Content-Security-Policy contract tests.
 *
 * A CSP mistake does not fail the build, does not fail a unit test, and does
 * not show up in the sandbox — it fails silently in the user's browser on
 * production, usually on the one code path nobody clicked before shipping.
 * These tests pin the policy against the hosts the app actually talks to.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const toml = readFileSync(resolve(__dirname, '../netlify.toml'), 'utf8');

/** Pull the CSP out of the TOML multi-line string and normalise whitespace. */
function csp() {
  const m = toml.match(/Content-Security-Policy\s*=\s*"""([\s\S]*?)"""/);
  if (!m) throw new Error('CSP not found in netlify.toml');
  return m[1].replace(/\\\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Return the source list for one directive. */
function directive(name) {
  const policy = csp();
  const found = policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  return found ? found.slice(name.length).trim().split(/\s+/).filter(Boolean) : null;
}

describe('CSP structure', () => {
  it('defines the directives that matter', () => {
    for (const d of [
      'default-src', 'script-src', 'style-src', 'img-src', 'connect-src',
      'font-src', 'frame-src', 'object-src', 'base-uri', 'form-action',
      'frame-ancestors',
    ]) {
      expect(directive(d), `missing ${d}`).toBeTruthy();
    }
  });

  it('defaults to self', () => {
    expect(directive('default-src')).toContain("'self'");
  });

  it("never allows 'unsafe-eval'", () => {
    expect(csp()).not.toContain('unsafe-eval');
  });

  it("does not allow 'unsafe-inline' in script-src", () => {
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
  });

  it("blocks plugins and framing", () => {
    expect(directive('object-src')).toContain("'none'");
    expect(directive('frame-ancestors')).toContain("'none'");
  });

  it('pins base-uri and form-action to self', () => {
    expect(directive('base-uri')).toContain("'self'");
    expect(directive('form-action')).toContain("'self'");
  });

  it('uses no wildcard-only source that would defeat the policy', () => {
    for (const d of ['default-src', 'script-src', 'connect-src', 'frame-src']) {
      expect(directive(d), d).not.toContain('*');
    }
  });
});

describe('CSP covers every host the app talks to', () => {
  const connect = () => directive('connect-src').join(' ');

  it('allows Firestore, including its realtime transport', () => {
    expect(connect()).toContain('firestore.googleapis.com');
    expect(connect()).toMatch(/wss:\/\//);
  });

  it('allows Firebase Auth token endpoints', () => {
    expect(connect()).toContain('identitytoolkit.googleapis.com');
    expect(connect()).toContain('securetoken.googleapis.com');
  });

  it('allows App Check', () => {
    expect(connect()).toContain('firebaseappcheck.googleapis.com');
  });

  it('allows callable Cloud Functions', () => {
    // src/lib/api.js calls applyToJob and submitReview via httpsCallable.
    // Functions v2 are served from *.run.app; v1 and the legacy alias use
    // *.cloudfunctions.net. Both must be reachable or Apply silently fails.
    expect(connect()).toContain('cloudfunctions.net');
    expect(connect()).toContain('run.app');
  });

  it('allows the reCAPTCHA frame that phone auth and App Check need', () => {
    const frame = directive('frame-src').join(' ');
    expect(frame).toContain('google.com');
  });

  it('allows the reCAPTCHA and Firebase scripts', () => {
    const script = directive('script-src').join(' ');
    expect(script).toContain('gstatic.com');
    expect(script).toContain('google.com');
  });

  it('allows self-hosted fonts without a third-party origin', () => {
    const font = directive('font-src');
    expect(font).toContain("'self'");
    // Fonts are bundled via @fontsource, so no Google Fonts exception is needed.
    expect(font.join(' ')).not.toContain('fonts.gstatic.com');
  });

  it('allows Firebase Storage images for future profile photos', () => {
    expect(directive('img-src').join(' ')).toContain('firebasestorage.googleapis.com');
  });

  it('allows blob: workers for the service worker', () => {
    expect(directive('worker-src').join(' ')).toContain("'self'");
  });
});

describe('security headers', () => {
  const header = (name) => toml.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`))?.[1];

  it('denies framing at the header level too', () => {
    expect(header('X-Frame-Options')).toBe('DENY');
  });

  it('disables MIME sniffing', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets a long HSTS max-age with preload', () => {
    const hsts = header('Strict-Transport-Security') ?? '';
    const maxAge = Number(hsts.match(/max-age=(\d+)/)?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('sets a privacy-preserving referrer policy', () => {
    expect(header('Referrer-Policy')).toMatch(/strict-origin/);
  });

  it('denies the powerful features the app does not use', () => {
    const pp = header('Permissions-Policy') ?? '';
    for (const feature of ['camera', 'microphone', 'payment', 'usb']) {
      expect(pp, feature).toMatch(new RegExp(`${feature}=\\(\\)`));
    }
  });
});

describe('Netlify routing', () => {
  it('does not force the SPA fallback over prerendered pages', () => {
    // force = true would shadow dist/about/index.html et al.
    const redirect = toml.match(/\[\[redirects\]\][\s\S]*?(?=\n\[|$)/)?.[0] ?? '';
    expect(redirect).toContain('status = 200');
    expect(redirect).not.toMatch(/force\s*=\s*true/);
  });

  it('caches hashed assets immutably but revalidates HTML', () => {
    expect(toml).toMatch(/for = "\/assets\/\*"[\s\S]*?immutable/);
    expect(toml).toMatch(/for = "\/index\.html"[\s\S]*?must-revalidate/);
  });

  it('never caches the service worker', () => {
    expect(toml).toMatch(/for = "\/sw\.js"[\s\S]*?must-revalidate/);
  });
});
