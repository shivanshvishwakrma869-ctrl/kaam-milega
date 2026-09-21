/**
 * Home / landing page.
 *
 * Structure follows the skill's resolved landing pattern — Funnel (3-Step
 * Conversion) blended with hero-testimonials-cta, because the product search
 * also returned "Classifieds / Buy-Sell" whose anti-patterns explicitly warn
 * against hidden reviews. So: Hero -> Categories -> 3 steps -> Featured
 * workers -> Reviews (visible, not buried) -> CTA.
 */

import { icon, tradeIcon } from '../lib/icons.js';
import { escapeHTML } from '../lib/security.js';
import { CATEGORIES } from '../data/categories.js';
import { listWorkers, listReviews, getStats } from '../lib/api.js';
import {
  skeletonCards, starRow, initials, formatINR, timeAgo, announce,
} from '../lib/ui.js';
import { workerCard } from './workers.js';

export function renderHome() {
  return `
    <section class="hero" aria-labelledby="hero-title">
      <div>
        <p class="eyebrow">Local work • Direct contact</p>
        <h1 class="hero-title" id="hero-title">
          Kaam chahiye? <em>Worker chahiye?</em>
        </h1>
        <p class="hero-lede">
          Search verified skilled workers near you, check their ratings and real
          reviews, then call or WhatsApp them directly. No commission, no middleman.
        </p>

        <form class="hero-search" id="hero-search-form" role="search">
          <label class="visually-hidden" for="hero-q">Search for a trade or worker</label>
          <div class="search-row">
            <div class="search-field">
              ${icon('search', { size: 18 })}
              <input class="input" id="hero-q" name="q" type="search"
                     placeholder="Try electrician, tailor, photographer…"
                     autocomplete="off" enterkeyhint="search">
            </div>
            <button type="submit" class="btn btn-accent btn-lg">
              ${icon('search', { size: 18 })}<span class="btn-label">Search</span>
            </button>
          </div>
        </form>

        <div class="hero-meta">
          <span>${icon('shieldCheck', { size: 16 })} ID-verified workers</span>
          <span>${icon('phone', { size: 16 })} Direct calling</span>
          <span>${icon('star', { size: 16 })} Real customer reviews</span>
        </div>
      </div>

      <aside class="hero-panel" aria-labelledby="stats-title">
        <h2 id="stats-title">On KaamMilega today</h2>
        <div class="stat-grid" id="stat-grid">
          ${statTile('—', 'Workers listed')}
          ${statTile('—', 'Jobs posted')}
          ${statTile('—', 'Cities covered')}
          ${statTile('—', 'Avg. response')}
        </div>
      </aside>
    </section>

    <section class="section" aria-labelledby="cats-title">
      <div class="section-head">
        <div>
          <p class="eyebrow">Categories</p>
          <h2 class="section-title" id="cats-title">What do you need done?</h2>
        </div>
        <a class="btn btn-secondary" href="/workers" data-route="workers">
          <span class="btn-label">See all workers</span>${icon('arrowRight', { size: 18 })}
        </a>
      </div>
      <div class="grid grid-4">
        ${CATEGORIES.map(categoryTile).join('')}
      </div>
    </section>

    <section class="section" aria-labelledby="how-title">
      <div class="section-head">
        <div>
          <p class="eyebrow">How it works</p>
          <h2 class="section-title" id="how-title">Three steps to getting the job done</h2>
        </div>
      </div>
      <ol class="steps">
        <li class="step">
          <span class="step-number" aria-hidden="true">1</span>
          <h3>Search your trade</h3>
          <p>Pick a category or type what you need. Filter by your city and see who is available right now.</p>
        </li>
        <li class="step">
          <span class="step-number" aria-hidden="true">2</span>
          <h3>Check the profile</h3>
          <p>Every listing shows ratings, jobs completed, day rate and reviews from real customers.</p>
        </li>
        <li class="step">
          <span class="step-number" aria-hidden="true">3</span>
          <h3>Call or WhatsApp</h3>
          <p>Contact the worker directly and agree your own price. KaamMilega takes nothing from either side.</p>
        </li>
      </ol>
    </section>

    <section class="section" aria-labelledby="featured-title">
      <div class="section-head">
        <div>
          <p class="eyebrow">Top rated</p>
          <h2 class="section-title" id="featured-title">Featured workers</h2>
          <p class="section-sub">Highest-rated verified profiles across all cities.</p>
        </div>
      </div>
      <div class="grid grid-3" id="featured-grid" aria-busy="true">
        ${skeletonCards(3)}
      </div>
    </section>

    <section class="section" aria-labelledby="reviews-title">
      <div class="section-head">
        <div>
          <p class="eyebrow">Social proof</p>
          <h2 class="section-title" id="reviews-title">What customers say</h2>
          <p class="section-sub">Unedited reviews from people who hired through KaamMilega.</p>
        </div>
      </div>
      <div class="grid grid-2" id="reviews-grid" aria-busy="true">
        ${skeletonCards(2)}
      </div>
    </section>

    <section class="cta-band">
      <h2>Are you a skilled worker looking for kaam?</h2>
      <p>Create a free profile and start getting calls from customers in your own city. It takes two minutes.</p>
      <div class="cta-actions">
        <a class="btn btn-accent btn-lg" href="/profile" data-route="profile">
          ${icon('plus', { size: 18 })}<span class="btn-label">List yourself free</span>
        </a>
        <a class="btn btn-secondary btn-lg" href="/jobs" data-route="jobs">
          <span class="btn-label">Browse open jobs</span>
        </a>
      </div>
    </section>
  `;
}

function statTile(value, label) {
  return `<div class="stat"><p class="stat-value">${escapeHTML(value)}</p><p class="stat-label">${escapeHTML(label)}</p></div>`;
}

function categoryTile(cat) {
  return `
    <a class="card card-interactive category-card" href="/workers/${encodeURIComponent(cat.slug)}"
       data-route="workers" style="text-decoration:none;color:inherit">
      <span class="category-icon">${icon(tradeIcon(cat.slug), { size: 22 })}</span>
      <h3>${escapeHTML(cat.name)}</h3>
      <span class="category-count" lang="hi">${escapeHTML(cat.hindi)}</span>
      <span class="category-count">from ${escapeHTML(formatINR(cat.typicalRate))}/day</span>
    </a>`;
}

function reviewCard(review) {
  return `
    <article class="card review">
      <div class="review-head">
        <span class="avatar" aria-hidden="true">${escapeHTML(initials(review.author))}</span>
        <div>
          <h3 style="font-size:var(--text-base)">${escapeHTML(review.author)}</h3>
          <p class="muted text-sm">${escapeHTML(timeAgo(review.date))}</p>
        </div>
        <div style="margin-left:auto">${starRow(review.rating)}</div>
      </div>
      <p class="review-body">“${escapeHTML(review.body)}”</p>
    </article>`;
}

/** Load the async parts after first paint. */
export async function hydrateHome() {
  const featured = document.getElementById('featured-grid');
  const reviews = document.getElementById('reviews-grid');
  const statGrid = document.getElementById('stat-grid');

  const [workersResult, reviewsResult, stats] = await Promise.allSettled([
    listWorkers({ limit: 3, sort: 'rating', verifiedOnly: true }),
    listReviews({ limit: 4 }),
    getStats(),
  ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)));

  if (featured) {
    featured.setAttribute('aria-busy', 'false');
    featured.innerHTML = workersResult?.length
      ? workersResult.map(workerCard).join('')
      : `<p class="muted">Could not load featured workers right now.</p>`;
  }

  if (reviews) {
    reviews.setAttribute('aria-busy', 'false');
    reviews.innerHTML = reviewsResult?.length
      ? reviewsResult.map(reviewCard).join('')
      : `<p class="muted">No reviews yet.</p>`;
  }

  if (statGrid && stats) {
    statGrid.innerHTML = [
      statTile(stats.workers, 'Workers listed'),
      statTile(stats.jobsPosted, 'Jobs posted'),
      statTile(stats.cities, 'Cities covered'),
      statTile(stats.avgResponse, 'Avg. response'),
    ].join('');
  }

  const form = document.getElementById('hero-search-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new FormData(form).get('q')?.toString().trim() ?? '';
    const url = q ? `/workers?q=${encodeURIComponent(q)}` : '/workers';
    window.dispatchEvent(new CustomEvent('km:navigate', { detail: { url } }));
  });

  announce('Home page loaded');
}
