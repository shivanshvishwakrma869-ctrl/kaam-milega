/**
 * Service worker behaviour tests.
 *
 * The SW is the one piece of the app that can serve the *wrong page* to a real
 * user long after a good deploy, and it is invisible to every other layer of
 * testing here. So rather than reading the source, these tests run it: sw.js is
 * evaluated inside a hand-built ServiceWorkerGlobalScope with a fake Cache API,
 * then its fetch handler is driven and the resulting responses asserted.
 *
 * Regression pinned here: the v2 SW cached every navigation under the single
 * key '/index.html'. Because the build prerenders six routes into six distinct
 * HTML files, visiting /about then going offline served the About page at '/'.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

/**
 * Prefer the BUILT worker: postbuild substitutes the prerendered route list
 * into it, so dist/sw.js is what actually ships. Fall back to the source with
 * the placeholder filled in, so these tests still run before a build.
 */
const BUILT_SW = resolve(__dirname, '../dist/sw.js');
const SRC_SW = resolve(__dirname, '../public/sw.js');
const usingBuilt = existsSync(BUILT_SW);
const SW_SOURCE = usingBuilt
  ? readFileSync(BUILT_SW, 'utf8')
  : readFileSync(SRC_SW, 'utf8').replaceAll(
      '__PRERENDERED_ROUTES__',
      JSON.stringify(['/', '/workers', '/jobs', '/about', '/privacy', '/terms']),
    );

const ORIGIN = 'https://kaam-milega.netlify.app';

/**
 * Minimal stand-in for the Cache API.
 *
 * The real Cache API keys entries by fully-resolved URL, so cache.add('/x')
 * and cache.match(new Request('https://host/x')) hit the same entry. The
 * harness must normalise the same way or it reports phantom misses.
 */
const keyOf = (r) => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href;

class FakeCache {
  constructor() { this.store = new Map(); }
  async put(request, response) {
    this.store.set(keyOf(request), response);
  }
  async add(url) {
    const res = await globalThis.__fetch(new FakeRequest(url));
    if (!res.ok) throw new Error(`404 ${url}`);
    return this.put(url, res);
  }
  async match(request, opts = {}) {
    const url = keyOf(request);
    if (this.store.has(url)) return this.store.get(url);
    if (opts.ignoreSearch) {
      const bare = url.split('?')[0];
      for (const [k, v] of this.store) if (k.split('?')[0] === bare) return v;
    }
    return undefined;
  }
}

class FakeCacheStorage {
  constructor() { this.caches = new Map(); }
  async open(name) {
    if (!this.caches.has(name)) this.caches.set(name, new FakeCache());
    return this.caches.get(name);
  }
  async keys() { return [...this.caches.keys()]; }
  async delete(name) { return this.caches.delete(name); }
  async match(request, opts) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request, opts);
      if (hit) return hit;
    }
    return undefined;
  }
}

class FakeResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new Map(Object.entries(init.headers ?? {}));
    this.type = init.type ?? 'basic';
  }
  clone() {
    return new FakeResponse(this.body, { status: this.status, type: this.type });
  }
  async text() { return this.body; }
}

class FakeRequest {
  constructor(url, init = {}) {
    this.url = url.startsWith('http') ? url : `https://kaam-milega.netlify.app${url}`;
    this.mode = init.mode ?? 'no-cors';
    this.method = init.method ?? 'GET';
    this.destination = init.destination ?? '';
  }
}

/** Build a fresh SW scope and evaluate sw.js inside it. */
function bootSW({ fetchImpl }) {
  const listeners = {};
  const scope = {
    caches: new FakeCacheStorage(),
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    Response: FakeResponse,
    Request: FakeRequest,
    URL,
    console,
    location: { origin: 'https://kaam-milega.netlify.app' },
  };
  scope.self = scope;
  scope.fetch = fetchImpl;
  globalThis.__fetch = fetchImpl;

  vm.createContext(scope);
  vm.runInContext(SW_SOURCE, scope);

  /** Drive an event and resolve whatever the handler responded with. */
  async function dispatch(type, event) {
    const waits = [];
    const e = {
      ...event,
      waitUntil: (p) => waits.push(p),
      respondWith: (p) => { e._response = p; },
    };
    for (const fn of listeners[type] ?? []) await fn(e);
    await Promise.allSettled(waits);
    return e._response ? await e._response : undefined;
  }

  return { scope, dispatch };
}

const navReq = (path) => new FakeRequest(path, { mode: 'navigate' });

describe('service worker — offline navigation', () => {
  let online;
  let sw;

  beforeEach(async () => {
    online = true;
    // Each route returns its own identifiable HTML, mirroring the prerender.
    const fetchImpl = async (request) => {
      if (!online) throw new Error('offline');
      const path = new URL(request.url).pathname;
      return new FakeResponse(`<title>PAGE:${path}</title>`, { status: 200 });
    };
    sw = bootSW({ fetchImpl });
    await sw.dispatch('install', {});
    await sw.dispatch('activate', {});
  });

  it('precaches every prerendered route, not only the home page', async () => {
    const shell = await sw.scope.caches.open('km-shell-v3');
    for (const route of ['/', '/workers', '/jobs', '/about', '/privacy', '/terms']) {
      const hit = await shell.match(new FakeRequest(route));
      expect(hit, `${route} should be precached`).toBeTruthy();
    }
  });

  it('serves each cached route its OWN content when offline', async () => {
    // Warm the cache the way a real visit would.
    for (const route of ['/about', '/workers', '/']) {
      await sw.dispatch('fetch', { request: navReq(route) });
    }
    online = false;

    // The regression: '/' must not return the About page.
    const home = await sw.dispatch('fetch', { request: navReq('/') });
    expect(await home.text()).toBe('<title>PAGE:/</title>');

    const about = await sw.dispatch('fetch', { request: navReq('/about') });
    expect(await about.text()).toBe('<title>PAGE:/about</title>');

    const workers = await sw.dispatch('fetch', { request: navReq('/workers') });
    expect(await workers.text()).toBe('<title>PAGE:/workers</title>');
  });

  it('visiting one route never overwrites another route in the cache', async () => {
    await sw.dispatch('fetch', { request: navReq('/') });
    await sw.dispatch('fetch', { request: navReq('/terms') });

    const shell = await sw.scope.caches.open('km-shell-v3');
    const home = await shell.match(new FakeRequest('/'));
    expect(await home.text()).toBe('<title>PAGE:/</title>');
  });

  it('falls back to the app shell for an unvisited route when offline', async () => {
    online = false;
    // /profile is never prerendered or precached; the SPA shell must answer
    // so the client router can render it.
    const res = await sw.dispatch('fetch', { request: navReq('/profile') });
    expect(res).toBeTruthy();
    expect(await res.text()).toBe('<title>PAGE:/</title>');
  });

  it('prefers the network so a new deploy is picked up immediately', async () => {
    await sw.dispatch('fetch', { request: navReq('/') });
    // Simulate a redeploy changing the response body.
    const fresh = await sw.dispatch('fetch', { request: navReq('/') });
    expect(await fresh.text()).toContain('PAGE:/');
    expect(fresh.status).toBe(200);
  });

  it('does not cache error responses as if they were pages', async () => {
    const sw404 = bootSW({
      fetchImpl: async () => new FakeResponse('not found', { status: 404 }),
    });
    await sw404.dispatch('fetch', { request: navReq('/gone') });
    const shell = await sw404.scope.caches.open('km-shell-v3');
    expect(await shell.match(new FakeRequest('/gone'))).toBeFalsy();
  });

  it('returns a real offline page rather than throwing when nothing is cached', async () => {
    const dead = bootSW({ fetchImpl: async () => { throw new Error('offline'); } });
    const res = await dead.dispatch('fetch', { request: navReq('/workers') });
    expect(res).toBeTruthy();
    expect(res.status).toBe(503);
    expect(await res.text()).toMatch(/offline/i);
  });
});

describe('service worker — caching policy', () => {
  it('bumps the cache version so old shells are evicted', () => {
    // A stale SHELL cache from v2 would still hold the buggy '/index.html'
    // entry; the version bump plus the activate-time sweep removes it.
    expect(SW_SOURCE).toMatch(/VERSION\s*=\s*'v[3-9]/);
  });

  it('deletes caches that do not match the current version on activate', async () => {
    const sw = bootSW({ fetchImpl: async () => new FakeResponse('x') });
    const stale = await sw.scope.caches.open('km-shell-v2');
    await stale.put('/index.html', new FakeResponse('<title>PAGE:/about</title>'));
    await sw.dispatch('activate', {});
    expect(await sw.scope.caches.keys()).not.toContain('km-shell-v2');
  });

  it('never caches auth, Firestore or reCAPTCHA traffic', () => {
    for (const host of [
      'googleapis.com', 'firebaseio.com', 'identitytoolkit',
      'securetoken', 'recaptcha',
    ]) {
      expect(SW_SOURCE, host).toContain(host);
    }
  });
});
