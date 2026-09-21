/**
 * KaamMilega — application entry point.
 *
 * A small hand-rolled router over the History API. No framework: the whole app
 * is ~25 KB of JS gzipped, which matters on a 3G connection in a tier-3 town —
 * the actual usage context for this product.
 */

import '@fontsource-variable/inter/index.css';
import './styles/main.css';

import { icon } from './lib/icons.js';
import {
  toast, openDialog, closeDialog, wireDialog, showFormErrors, clearFormErrors,
  setButtonLoading, announce,
} from './lib/ui.js';
import {
  initAuth, onAuthChange, sendOtp, verifyOtp, signOut, authErrorMessage,
} from './lib/auth.js';
import { isDemoMode, initAnalytics } from './lib/firebase.js';
import { validatePhoneStep, validateOtpStep, FIELD_LABELS } from './lib/validation.js';
import { rateLimit } from './lib/security.js';

import { CATEGORIES } from './data/categories.js';
import { renderHome, hydrateHome } from './pages/home.js';
import { renderWorkers, hydrateWorkers } from './pages/workers.js';
import { renderJobs, hydrateJobs } from './pages/jobs.js';
import { renderProfile, hydrateProfile } from './pages/profile.js';
import {
  renderAbout, renderPrivacy, renderTerms, renderNotFound,
} from './pages/static.js';

/* ------------------------------------------------------------------ Routes */

const ROUTES = {
  '/': {
    name: 'home',
    title: 'KaamMilega — Find Verified Local Workers Near You in India',
    description:
      'Find verified electricians, plumbers, carpenters, tailors and photographers near you. Call or WhatsApp local skilled workers directly.',
    render: renderHome,
    hydrate: hydrateHome,
  },
  '/workers': {
    name: 'workers',
    title: 'Find Skilled Workers Near You | KaamMilega',
    description:
      'Search verified electricians, plumbers, carpenters and more by city and trade. See ratings, reviews and day rates.',
    render: renderWorkers,
    hydrate: hydrateWorkers,
  },
  '/jobs': {
    name: 'jobs',
    title: 'Open Jobs for Skilled Workers | KaamMilega',
    description: 'Browse open work near you and apply directly. Free to post, free to apply.',
    render: renderJobs,
    hydrate: hydrateJobs,
  },
  '/profile': {
    name: 'profile',
    title: 'My Worker Profile | KaamMilega',
    description: 'Create and manage your free worker listing on KaamMilega.',
    render: renderProfile,
    hydrate: hydrateProfile,
    noindex: true,
  },
  '/about': {
    name: 'about',
    title: 'About KaamMilega — No Commission, No Middleman',
    description: 'Why KaamMilega exists, what verification means, and how to stay safe.',
    render: renderAbout,
  },
  '/privacy': {
    name: 'privacy',
    title: 'Privacy Policy | KaamMilega',
    description: 'What data KaamMilega collects, how it is used, and your rights.',
    render: renderPrivacy,
  },
  '/terms': {
    name: 'terms',
    title: 'Terms of Use | KaamMilega',
    description: 'The terms that apply when you use KaamMilega.',
    render: renderTerms,
  },
};

const view = document.getElementById('view');
let currentRoute = null;

/**
 * Resolve the current URL to a route + params.
 *
 * `/workers/<trade>` is a real, prerendered, individually-canonical landing
 * page for each category — those are the highest-intent queries this product
 * can rank for. The client router has to understand them too, or hydrating a
 * page a crawler just indexed would fall through to "Page not found".
 */
function resolve(pathname = location.pathname, search = location.search) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const params = Object.fromEntries(new URLSearchParams(search));

  const category = clean.match(/^\/workers\/([a-z][a-z-]*)$/);
  if (category) {
    const cat = CATEGORIES.find((c) => c.slug === category[1]);
    if (cat) {
      return {
        route: {
          ...ROUTES['/workers'],
          title: `${cat.name}s Near You — Verified & Rated | KaamMilega`,
          description:
            `Find verified ${cat.name.toLowerCase()}s (${cat.hindi}) near you. ` +
            `Typical rate around ₹${cat.typicalRate}/day. See ratings and reviews, ` +
            `then call or WhatsApp directly — no commission, no middleman.`,
        },
        params: { ...params, trade: cat.slug },
        path: clean,
      };
    }
  }

  return { route: ROUTES[clean], params, path: clean };
}

/** Update the document head for the active route (SEO for a client-side app). */
function updateHead(route, path) {
  document.title = route?.title ?? 'Page not found | KaamMilega';

  const setMeta = (selector, attr, value) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };

  const desc = route?.description ?? 'Page not found on KaamMilega.';
  setMeta('meta[name="description"]', 'content', desc);
  setMeta('meta[property="og:description"]', 'content', desc);
  setMeta('meta[property="og:title"]', 'content', document.title);
  setMeta('meta[name="twitter:title"]', 'content', document.title);
  setMeta('meta[name="twitter:description"]', 'content', desc);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = new URL(path, location.origin).href;
  setMeta('meta[property="og:url"]', 'content', new URL(path, location.origin).href);

  // Keep private pages out of the index.
  const robots = document.querySelector('meta[name="robots"]');
  if (robots) {
    robots.content = route?.noindex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  }
}

/** Mark the active nav item in both the header and the bottom bar. */
function updateNav(name) {
  document.querySelectorAll('[data-route]').forEach((el) => {
    if (el.dataset.route === name && el.tagName === 'A') {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}

async function navigate(url, { replace = false, restoreScroll = null } = {}) {
  const target = new URL(url, location.origin);
  if (replace) history.replaceState({}, '', target);
  else history.pushState({}, '', target);
  await render({ restoreScroll });
}

async function render({ restoreScroll = null } = {}) {
  const { route, params, path } = resolve();

  view.setAttribute('aria-busy', 'true');
  view.innerHTML = route ? route.render(params) : renderNotFound(path);
  view.setAttribute('aria-busy', 'false');

  updateHead(route, path);
  updateNav(route?.name ?? '');
  hydrateIcons(view);
  currentRoute = route?.name ?? '404';

  // Focus the main region on navigation so screen-reader and keyboard users
  // land on the new content instead of staying at the top of a stale page.
  if (restoreScroll === null) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('main')?.focus({ preventScroll: true });
  } else {
    window.scrollTo({ top: restoreScroll, behavior: 'instant' });
  }

  try {
    await route?.hydrate?.(params, {
      openDialog, closeDialog, wireDialog, onSignOut: handleSignOut,
    });
  } catch (err) {
    console.error('[router] hydrate failed', err);
    toast('Something went wrong loading this page.', 'error');
  }
}

/* ----------------------------------------------------------- Icon hydration */

/**
 * Replace `<span data-icon="name">` placeholders with real SVG. Keeping icons
 * out of index.html keeps the HTML readable and the markup in one place.
 */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.iconDone) return;
    el.innerHTML = icon(el.dataset.icon, { size: Number(el.dataset.iconSize) || 18 });
    el.dataset.iconDone = 'true';
  });
}

/* ------------------------------------------------------------- Link routing */

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (!link) return;

  const href = link.getAttribute('href');
  // Let the browser handle external links, new tabs, downloads, and non-HTTP schemes.
  if (
    !href ||
    link.target === '_blank' ||
    link.hasAttribute('download') ||
    href.startsWith('http') ||
    href.startsWith('tel:') ||
    href.startsWith('mailto:') ||
    href.startsWith('#') ||
    e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
  ) {
    return;
  }

  const url = new URL(href, location.origin);
  if (url.origin !== location.origin) return;
  // /security.txt and other real files must not be intercepted.
  if (!ROUTES[url.pathname.replace(/\/+$/, '') || '/'] && url.pathname.includes('.')) return;

  e.preventDefault();
  navigate(url.href);
});

window.addEventListener('popstate', () => render({ restoreScroll: 0 }));
window.addEventListener('km:navigate', (e) => navigate(e.detail.url));

/* --------------------------------------------------------------- Auth flow */

function setupAuthDialog() {
  const dialog = document.getElementById('auth-dialog');
  const form = document.getElementById('auth-form');
  const submit = document.getElementById('auth-submit');
  const back = document.getElementById('auth-back');
  const phoneStep = form.querySelector('[data-step="phone"]');
  const otpStep = form.querySelector('[data-step="otp"]');
  const subtitle = document.getElementById('auth-subtitle');

  wireDialog(dialog);
  let stage = 'phone';

  function toPhoneStage() {
    stage = 'phone';
    phoneStep.hidden = false;
    otpStep.hidden = true;
    back.hidden = true;
    submit.querySelector('.btn-label').textContent = 'Send code';
    subtitle.textContent = 'We will send a 6-digit code to your mobile.';
    clearFormErrors(form);
    form.querySelector('#auth-phone').focus();
  }

  function toOtpStage(phone, hint) {
    stage = 'otp';
    phoneStep.hidden = true;
    otpStep.hidden = false;
    back.hidden = false;
    submit.querySelector('.btn-label').textContent = 'Verify and login';
    subtitle.textContent = hint
      ? `Demo mode — use code ${hint} for +91 ${phone}.`
      : `Code sent to +91 ${phone}.`;
    clearFormErrors(form);
    form.querySelector('#auth-otp').focus();
  }

  // Numeric-only inputs, without breaking paste or backspace.
  ['#auth-phone', '#auth-otp'].forEach((sel) => {
    form.querySelector(sel)?.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
  });

  back.addEventListener('click', toPhoneStage);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    if (stage === 'phone') {
      const { valid, errors, data: clean } = validatePhoneStep(data);
      if (!valid) return showFormErrors(form, errors, FIELD_LABELS);

      const limit = rateLimit(`otp:${clean.phone}`, { max: 3, windowMs: 300_000 });
      if (!limit.allowed) {
        return showFormErrors(
          form,
          { phone: `Too many code requests. Try again in ${limit.retryAfter} seconds.` },
          FIELD_LABELS,
        );
      }

      clearFormErrors(form);
      setButtonLoading(submit, true, 'Sending…');
      try {
        const res = await sendOtp(clean.phone);
        toOtpStage(clean.phone, res?.hint);
        announce('Verification code sent');
      } catch (err) {
        console.error('[auth] sendOtp failed', err);
        showFormErrors(form, { phone: authErrorMessage(err) }, FIELD_LABELS);
      } finally {
        setButtonLoading(submit, false);
      }
      return;
    }

    const { valid, errors, data: clean } = validateOtpStep(data);
    if (!valid) return showFormErrors(form, errors, FIELD_LABELS);

    clearFormErrors(form);
    setButtonLoading(submit, true, 'Verifying…');
    try {
      await verifyOtp(clean.otp);
      closeDialog(dialog);
      form.reset();
      toPhoneStage();
      toast('Logged in successfully.', 'success');
      if (currentRoute === 'profile') await render();
    } catch (err) {
      console.error('[auth] verifyOtp failed', err);
      showFormErrors(form, { otp: authErrorMessage(err) }, FIELD_LABELS);
    } finally {
      setButtonLoading(submit, false);
    }
  });

  return { dialog, reset: toPhoneStage };
}

async function handleSignOut() {
  await signOut();
  toast('You have been logged out.', 'info');
  await navigate('/');
}

/* ------------------------------------------------------------------- Theme */

function setupTheme() {
  const toggle = document.getElementById('theme-toggle');
  const stored = localStorage.getItem('km:theme');
  if (stored) document.documentElement.dataset.theme = stored;

  function currentIsDark() {
    const explicit = document.documentElement.dataset.theme;
    if (explicit) return explicit === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function paint() {
    const dark = currentIsDark();
    toggle.innerHTML = icon(dark ? 'sun' : 'moon', { size: 18 });
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#0b1a15' : '#047857';
  }

  toggle.addEventListener('click', () => {
    const next = currentIsDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('km:theme', next);
    paint();
    announce(`${next === 'dark' ? 'Dark' : 'Light'} theme enabled`);
  });

  paint();
}

/* ----------------------------------------------------------------- Consent */

function setupConsent() {
  const dialog = document.getElementById('consent-dialog');
  wireDialog(dialog);
  const stored = localStorage.getItem('km:consent');

  if (stored === 'granted') {
    initAnalytics();
    return;
  }
  if (stored === 'denied') return;

  // Don't interrupt the first paint; ask once the page is settled.
  setTimeout(() => {
    if (!dialog.open) dialog.showModal();
  }, 2500);

  document.getElementById('consent-accept')?.addEventListener('click', () => {
    localStorage.setItem('km:consent', 'granted');
    dialog.close();
    initAnalytics();
    toast('Thank you — analytics enabled.', 'success');
  });

  document.getElementById('consent-reject')?.addEventListener('click', () => {
    localStorage.setItem('km:consent', 'denied');
    dialog.close();
  });
}

/* ------------------------------------------------------------- Connectivity */

function setupConnectivity() {
  const banner = document.getElementById('offline-banner');
  const sync = () => {
    banner.hidden = navigator.onLine;
  };
  window.addEventListener('online', () => {
    sync();
    toast('Back online.', 'success');
  });
  window.addEventListener('offline', () => {
    sync();
    announce('You are offline');
  });
  sync();
}

/* -------------------------------------------------------------------- Boot */

async function boot() {
  hydrateIcons(document);
  setupTheme();
  setupConnectivity();
  document.getElementById('year').textContent = String(new Date().getFullYear());

  const authUI = setupAuthDialog();
  const authButton = document.getElementById('auth-button');

  onAuthChange((user) => {
    if (user) {
      authButton.innerHTML =
        `${icon('user', { size: 18 })}<span class="btn-label">My profile</span>`;
      authButton.setAttribute('aria-label', 'Go to my profile');
      authButton.onclick = () => navigate('/profile');
    } else {
      authButton.innerHTML =
        `${icon('logIn', { size: 18 })}<span class="btn-label">Login</span>`;
      authButton.setAttribute('aria-label', 'Login to KaamMilega');
      authButton.onclick = (e) => {
        authUI.reset();
        openDialog(authUI.dialog, { returnFocusTo: e.currentTarget });
      };
    }
  });

  if (isDemoMode) {
    const el = document.getElementById('build-mode');
    if (el) {
      el.innerHTML =
        `${icon('info', { size: 14 })} Demo mode — no backend connected. ` +
        `<a href="https://github.com/shivanshvishwakrma869-ctrl/kaam-milega#connect-firebase" ` +
        `rel="noopener noreferrer">Connect Firebase</a>`;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '6px';
    }
  }

  await initAuth();
  await render();
  setupConsent();

  // Service worker: offline shell. Registered late so it never competes with
  // the first paint for bandwidth.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[sw] registration failed', err);
      });
    });
  }
}

boot().catch((err) => {
  console.error('[boot] fatal', err);
  view.innerHTML =
    '<div class="empty-state"><h1>Something went wrong</h1>' +
    '<p>Please reload the page. If it keeps happening, check your connection.</p>' +
    '<button class="btn btn-primary" onclick="location.reload()">Reload</button></div>';
});
