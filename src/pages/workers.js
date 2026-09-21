/**
 * Worker directory — filters, search, results.
 */

import { icon, tradeIcon } from '../lib/icons.js';
import { escapeHTML, telURL, whatsappURL, rateLimit } from '../lib/security.js';
import { CATEGORIES, CITIES, categoryName } from '../data/categories.js';
import { listWorkers, listReviews } from '../lib/api.js';
import {
  skeletonCards, initials, formatINR, emptyState, debounce,
  toast, starRow, timeAgo,
} from '../lib/ui.js';

/** Shared worker card — also used by the home page. */
export function workerCard(w) {
  const tel = telURL(w.phone);
  const wa = whatsappURL(
    w.phone,
    `Hello ${w.name}, I found your profile on KaamMilega and would like to discuss some work.`,
  );

  return `
    <article class="card worker-card" data-worker-id="${escapeHTML(w.id)}">
      <div class="worker-head">
        <span class="avatar" aria-hidden="true">${escapeHTML(initials(w.name))}</span>
        <div class="worker-id">
          <h3 class="worker-name">
            ${escapeHTML(w.name)}
            ${w.verified
              ? `<span class="badge badge-verified">${icon('shieldCheck', { size: 12 })}Verified</span>`
              : `<span class="badge badge-neutral">Unverified</span>`}
          </h3>
          <p class="worker-trade">
            ${icon(tradeIcon(w.trade), { size: 14 })}${escapeHTML(categoryName(w.trade))}
            <span aria-hidden="true">•</span>
            ${icon('mapPin', { size: 14 })}${escapeHTML(w.city)}
          </p>
        </div>
      </div>

      ${w.bio ? `<p class="text-sm muted">${escapeHTML(w.bio)}</p>` : ''}

      <div class="worker-stats">
        <span class="rating">
          ${icon('star', { size: 16 })}
          <span>${escapeHTML(String(w.rating))}</span>
          <span class="muted">(${escapeHTML(String(w.reviewCount))})</span>
        </span>
        <span class="muted">${escapeHTML(String(w.jobsDone))} jobs done</span>
        <span class="worker-rate">${escapeHTML(formatINR(w.rate))}<span class="muted text-sm">/day</span></span>
      </div>

      <div>
        ${w.available
          ? `<span class="badge badge-available">${icon('checkCircle', { size: 12 })}Available now</span>`
          : `<span class="badge badge-busy">${icon('clock', { size: 12 })}Busy — booked up</span>`}
        <span class="badge badge-neutral">${escapeHTML(String(w.experienceYears))} yrs experience</span>
      </div>

      ${w.reviewCount > 0
        ? `<details class="worker-reviews" data-reviews-for="${escapeHTML(w.id)}">
             <summary>
               ${icon('star', { size: 15 })}
               <span>Read ${escapeHTML(String(w.reviewCount))} review${w.reviewCount === 1 ? '' : 's'}</span>
               ${icon('chevronRight', { size: 16, className: 'disclosure-chevron' })}
             </summary>
             <div class="worker-reviews-body" data-reviews-slot>
               <p class="muted text-sm">Loading reviews…</p>
             </div>
           </details>`
        : ''}

      <div class="worker-actions">
        ${tel
          ? `<a class="btn btn-primary" href="${escapeHTML(tel)}" data-track="call"
                aria-label="Call ${escapeHTML(w.name)}">
               ${icon('phone', { size: 18 })}<span class="btn-label">Call</span></a>`
          : `<button class="btn btn-primary" type="button" disabled>Number unavailable</button>`}
        ${wa
          ? `<a class="btn btn-whatsapp" href="${escapeHTML(wa)}" target="_blank" rel="noopener noreferrer"
                data-track="whatsapp" aria-label="Message ${escapeHTML(w.name)} on WhatsApp">
               ${icon('whatsapp', { size: 18 })}<span class="btn-label">WhatsApp</span></a>`
          : ''}
      </div>
    </article>`;
}

/**
 * Lazily load a worker's reviews the first time their disclosure is opened.
 *
 * The skill's anti-patterns for this product type flag "hidden reviews", so
 * they must be reachable from the card itself rather than only in aggregate.
 * Fetching on open rather than upfront keeps the directory to one query.
 *
 * Note: no database match was found for a disclosure-widget guideline, so the
 * native <details> element is used here as a built-in default — it gives
 * keyboard operation and correct expanded/collapsed semantics for free.
 */
export function wireWorkerReviews(container) {
  container.addEventListener('toggle', async (e) => {
    const el = e.target;
    if (!el.matches('[data-reviews-for]') || !el.open || el.dataset.loaded) return;
    el.dataset.loaded = 'true';

    const slot = el.querySelector('[data-reviews-slot]');
    try {
      const rows = await listReviews({ workerId: el.dataset.reviewsFor, limit: 5 });
      slot.innerHTML = rows.length
        ? rows.map(reviewLine).join('')
        : '<p class="muted text-sm">No written reviews yet.</p>';
    } catch (err) {
      console.error('[workers] reviews failed', err);
      slot.innerHTML = '<p class="muted text-sm">Could not load reviews right now.</p>';
      el.dataset.loaded = '';
    }
  }, true); // capture: `toggle` does not bubble
}

function reviewLine(r) {
  return `
    <article class="worker-review">
      <div class="worker-review-head">
        <strong>${escapeHTML(r.author)}</strong>
        ${starRow(r.rating)}
        <span class="muted text-sm">${escapeHTML(timeAgo(r.date))}</span>
      </div>
      <p class="review-body">${escapeHTML(r.body)}</p>
    </article>`;
}

export function renderWorkers(params = {}) {
  const trade = params.trade ?? '';
  const city = params.city ?? '';
  const q = params.q ?? '';

  // On a category landing page the heading must name the trade: it is the
  // page's single strongest on-page ranking signal, and a user arriving from
  // a search for "electrician" should see that word, not a generic title.
  const cat = trade ? CATEGORIES.find((c) => c.slug === trade) : null;
  const heading = cat ? `${escapeHTML(cat.name)}s near you` : 'Find a skilled worker';
  const intro = cat
    ? `<p class="section-sub">Verified ${escapeHTML(cat.name.toLowerCase())}s
         (${escapeHTML(cat.hindi)}) — typical rate around
         ₹${escapeHTML(String(cat.typicalRate))}/day. Call or WhatsApp directly.</p>`
    : '';

  return `
    ${cat
      ? `<nav class="breadcrumb" aria-label="Breadcrumb">
           <ol>
             <li><a href="/" data-route="home">Home</a></li>
             <li><a href="/workers" data-route="workers">Workers</a></li>
             <li><span aria-current="page">${escapeHTML(cat.name)}s</span></li>
           </ol>
         </nav>`
      : ''}

    <div class="section-head" style="margin-top:var(--space-6)">
      <div>
        <p class="eyebrow">Workers</p>
        <h1 class="section-title" id="workers-title">${heading}</h1>
        ${intro}
        <p class="section-sub" id="result-count" role="status">Loading workers…</p>
      </div>
    </div>

    <form id="filter-form" role="search" aria-labelledby="workers-title">
      <div class="form-row" style="margin-bottom:var(--space-4)">
        <div class="field">
          <label for="f-q">Search</label>
          <div class="search-field">
            ${icon('search', { size: 18 })}
            <input class="input" id="f-q" name="q" type="search" value="${escapeHTML(q)}"
                   placeholder="Name, trade or keyword" autocomplete="off">
          </div>
        </div>

        <div class="field">
          <label for="f-city">City</label>
          <select class="select" id="f-city" name="city">
            <option value="">All cities</option>
            ${CITIES.map(
              (c) => `<option value="${escapeHTML(c)}"${c === city ? ' selected' : ''}>${escapeHTML(c)}</option>`,
            ).join('')}
          </select>
        </div>

        <div class="field">
          <label for="f-sort">Sort by</label>
          <select class="select" id="f-sort" name="sort">
            <option value="rating">Highest rated</option>
            <option value="jobs">Most jobs done</option>
            <option value="rate">Lowest day rate</option>
          </select>
        </div>
      </div>

      <fieldset style="border:0;padding:0;margin:0">
        <legend class="visually-hidden">Filter by trade</legend>
        <div class="chip-row" id="trade-chips">
          <button type="button" class="chip" data-trade="" aria-pressed="${trade === '' ? 'true' : 'false'}">All trades</button>
          ${CATEGORIES.map(
            (c) =>
              `<button type="button" class="chip" data-trade="${escapeHTML(c.slug)}" aria-pressed="${
                c.slug === trade ? 'true' : 'false'
              }">${escapeHTML(c.name)}</button>`,
          ).join('')}
        </div>
      </fieldset>

      <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;margin-bottom:var(--space-6)">
        <label class="checkbox-field">
          <input type="checkbox" name="availableOnly" id="f-available">
          <span>Available now only</span>
        </label>
        <label class="checkbox-field">
          <input type="checkbox" name="verifiedOnly" id="f-verified">
          <span>Verified workers only</span>
        </label>
      </div>
    </form>

    <div class="grid grid-3" id="worker-grid" aria-busy="true">
      ${skeletonCards(6)}
    </div>
  `;
}

export async function hydrateWorkers(params = {}) {
  const form = document.getElementById('filter-form');
  const grid = document.getElementById('worker-grid');
  const countEl = document.getElementById('result-count');
  if (!form || !grid) return;

  let state = {
    trade: params.trade ?? '',
    city: params.city ?? '',
    q: params.q ?? '',
    sort: 'rating',
    availableOnly: false,
    verifiedOnly: false,
  };

  async function load() {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = skeletonCards(6);

    let rows = [];
    try {
      rows = await listWorkers({ ...state, limit: 60 });
    } catch (err) {
      console.error('[workers] load failed', err);
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = emptyState({
        title: 'Could not load workers',
        message: 'Something went wrong on our side. Check your connection and try again.',
        actionLabel: 'Retry',
        actionId: 'retry-workers',
        iconName: 'alertTriangle',
      });
      document.getElementById('retry-workers')?.addEventListener('click', load);
      return;
    }

    grid.setAttribute('aria-busy', 'false');

    if (rows.length === 0) {
      grid.innerHTML = emptyState({
        title: 'No workers match those filters',
        message: 'Try removing a filter, choosing a different city, or searching a broader term.',
        actionLabel: 'Clear all filters',
        actionId: 'clear-filters',
        iconName: 'search',
      });
      document.getElementById('clear-filters')?.addEventListener('click', () => {
        state = { trade: '', city: '', q: '', sort: 'rating', availableOnly: false, verifiedOnly: false };
        form.reset();
        document.querySelectorAll('#trade-chips .chip').forEach((c) => {
          c.setAttribute('aria-pressed', c.dataset.trade === '' ? 'true' : 'false');
        });
        syncURL();
        load();
      });
    } else {
      grid.innerHTML = rows.map(workerCard).join('');
    }

    // #result-count is itself role="status", so updating its text already
    // announces the new count. Calling announce() as well would make a screen
    // reader say the result twice on every keystroke.
    const msg =
      rows.length === 0
        ? 'No workers found'
        : `${rows.length} worker${rows.length === 1 ? '' : 's'} found`;
    if (countEl) countEl.textContent = msg;
  }

  function syncURL() {
    const sp = new URLSearchParams();
    if (state.trade) sp.set('trade', state.trade);
    if (state.city) sp.set('city', state.city);
    if (state.q) sp.set('q', state.q);
    const qs = sp.toString();
    // replaceState keeps filter changes out of the back-button history,
    // so Back returns to the previous page rather than the previous filter.
    history.replaceState({}, '', `/workers${qs ? `?${qs}` : ''}`);
  }

  const debouncedSearch = debounce(() => {
    syncURL();
    load();
  }, 300);

  form.querySelector('#f-q')?.addEventListener('input', (e) => {
    state.q = e.target.value;
    debouncedSearch();
  });

  form.querySelector('#f-city')?.addEventListener('change', (e) => {
    state.city = e.target.value;
    syncURL();
    load();
  });

  form.querySelector('#f-sort')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    load();
  });

  form.querySelector('#f-available')?.addEventListener('change', (e) => {
    state.availableOnly = e.target.checked;
    load();
  });

  form.querySelector('#f-verified')?.addEventListener('change', (e) => {
    state.verifiedOnly = e.target.checked;
    load();
  });

  document.getElementById('trade-chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.trade = chip.dataset.trade ?? '';
    document.querySelectorAll('#trade-chips .chip').forEach((c) => {
      c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
    });
    syncURL();
    load();
  });

  form.addEventListener('submit', (e) => e.preventDefault());

  // Reviews load on first open of each card's disclosure.
  wireWorkerReviews(grid);

  // Light client-side guard against accidental contact spamming.
  grid.addEventListener('click', (e) => {
    const link = e.target.closest('[data-track]');
    if (!link) return;
    const { allowed, retryAfter } = rateLimit('contact', { max: 12, windowMs: 60_000 });
    if (!allowed) {
      e.preventDefault();
      toast(`Slow down a moment — try again in ${retryAfter}s.`, 'info');
    }
  });

  await load();
}
