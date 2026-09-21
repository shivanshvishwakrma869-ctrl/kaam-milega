/**
 * Jobs board — browse open work, and post a new job.
 */

import { icon, tradeIcon } from '../lib/icons.js';
import { escapeHTML } from '../lib/security.js';
import { CATEGORIES, CITIES, categoryName } from '../data/categories.js';
import {
  listJobs, createJob, applyToJob, loadLocalApplications, callableErrorMessage,
} from '../lib/api.js';
import { validateJob, FIELD_LABELS } from '../lib/validation.js';
import { getUser } from '../lib/auth.js';
import {
  skeletonCards, formatRange, timeAgo, emptyState, toast, announce,
  showFormErrors, clearFormErrors, setButtonLoading,
} from '../lib/ui.js';

const URGENCY = {
  urgent: { label: 'Urgent', cls: 'badge-busy' },
  'this-week': { label: 'This week', cls: 'badge-available' },
  scheduled: { label: 'Scheduled', cls: 'badge-neutral' },
};

function jobCard(j, isApplied = false) {
  const u = URGENCY[j.urgency] ?? URGENCY.scheduled;
  return `
    <article class="card job-card">
      <div class="job-main">
        <h3 class="job-title">${escapeHTML(j.title)}</h3>
        <div class="job-meta">
          <span>${icon(tradeIcon(j.trade), { size: 15 })}${escapeHTML(categoryName(j.trade))}</span>
          <span>${icon('mapPin', { size: 15 })}${escapeHTML(j.city)}</span>
          <span>${icon('clock', { size: 15 })}${escapeHTML(timeAgo(j.postedAt))}</span>
          <span>${icon('users', { size: 15 })}${escapeHTML(String(j.applicants ?? 0))} applied</span>
        </div>
        <p class="text-sm muted" style="margin-top:var(--space-3)">${escapeHTML(j.description)}</p>
      </div>
      <div class="job-side">
        <span class="badge ${u.cls}">${escapeHTML(u.label)}</span>
        <p class="job-budget">${escapeHTML(formatRange(j.budgetMin, j.budgetMax))}</p>
        ${isApplied
          ? `<button type="button" class="btn btn-secondary btn-sm" data-apply="${escapeHTML(j.id)}"
                     aria-disabled="true">
               ${icon('checkCircle', { size: 16 })}<span class="btn-label">Applied</span>
             </button>`
          : `<button type="button" class="btn btn-primary btn-sm" data-apply="${escapeHTML(j.id)}"
                     aria-label="Apply to ${escapeHTML(j.title)}">
               <span class="btn-label">Apply</span>${icon('arrowRight', { size: 16 })}
             </button>`}
      </div>
    </article>`;
}

export function renderJobs() {
  return `
    <div class="section-head" style="margin-top:var(--space-6)">
      <div>
        <p class="eyebrow">Jobs</p>
        <h1 class="section-title" id="jobs-title">Open work near you</h1>
        <p class="section-sub" id="jobs-count" role="status">Loading jobs…</p>
      </div>
      <button type="button" class="btn btn-accent" id="post-job-btn">
        ${icon('plus', { size: 18 })}<span class="btn-label">Post a job</span>
      </button>
    </div>

    <div class="chip-row" id="job-chips">
      <button type="button" class="chip" data-trade="" aria-pressed="true">All trades</button>
      ${CATEGORIES.slice(0, 8)
        .map(
          (c) =>
            `<button type="button" class="chip" data-trade="${escapeHTML(c.slug)}" aria-pressed="false">${escapeHTML(c.name)}</button>`,
        )
        .join('')}
    </div>

    <div class="grid" id="job-list" aria-busy="true" style="gap:var(--space-4)">
      ${skeletonCards(3)}
    </div>

    <dialog class="modal" id="job-dialog" aria-labelledby="job-dialog-title">
      <div class="modal-box">
        <div class="modal-head">
          <div>
            <h2 id="job-dialog-title">Post a job</h2>
            <p class="muted text-sm">Tell workers what you need. Free to post.</p>
          </div>
          <button type="button" class="modal-close" data-close-dialog aria-label="Close post job dialog">
            ${icon('x', { size: 20 })}
          </button>
        </div>

        <form id="job-form" novalidate>
          <div class="error-summary" data-error-summary tabindex="-1" role="alert" hidden></div>
          <div class="form" style="gap:var(--space-4)">

            <div class="field">
              <label for="j-title">Job title <span class="required" aria-hidden="true">*</span></label>
              <input class="input" id="j-title" name="title" type="text" maxlength="100" required
                     placeholder="e.g. Bathroom tap replacement" data-autofocus>
              <p class="field-error" data-error-for="title" role="alert"></p>
            </div>

            <div class="form-row">
              <div class="field">
                <label for="j-trade">Trade needed <span class="required" aria-hidden="true">*</span></label>
                <select class="select" id="j-trade" name="trade" required>
                  <option value="">Choose a trade</option>
                  ${CATEGORIES.map((c) => `<option value="${escapeHTML(c.slug)}">${escapeHTML(c.name)}</option>`).join('')}
                </select>
                <p class="field-error" data-error-for="trade" role="alert"></p>
              </div>

              <div class="field">
                <label for="j-city">City <span class="required" aria-hidden="true">*</span></label>
                <select class="select" id="j-city" name="city" required>
                  <option value="">Choose a city</option>
                  ${CITIES.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('')}
                </select>
                <p class="field-error" data-error-for="city" role="alert"></p>
              </div>
            </div>

            <div class="form-row">
              <div class="field">
                <label for="j-min">Budget from (₹) <span class="required" aria-hidden="true">*</span></label>
                <input class="input" id="j-min" name="budgetMin" type="text" inputmode="numeric"
                       maxlength="7" required placeholder="800">
                <p class="field-error" data-error-for="budgetMin" role="alert"></p>
              </div>
              <div class="field">
                <label for="j-max">Budget up to (₹) <span class="required" aria-hidden="true">*</span></label>
                <input class="input" id="j-max" name="budgetMax" type="text" inputmode="numeric"
                       maxlength="7" required placeholder="2000">
                <p class="field-error" data-error-for="budgetMax" role="alert"></p>
              </div>
            </div>

            <div class="field">
              <label for="j-desc">Describe the work <span class="required" aria-hidden="true">*</span></label>
              <textarea class="textarea" id="j-desc" name="description" maxlength="1000" required
                        placeholder="What needs doing, when, and anything a worker should bring."
                        aria-describedby="j-desc-count"></textarea>
              <p class="char-count" id="j-desc-count" aria-live="polite">0 / 1000</p>
              <p class="field-error" data-error-for="description" role="alert"></p>
            </div>

            <div class="field">
              <label for="j-phone">Your mobile number <span class="required" aria-hidden="true">*</span></label>
              <input class="input" id="j-phone" name="phone" type="tel" inputmode="numeric"
                     autocomplete="tel-national" maxlength="10" required placeholder="98765 43210"
                     aria-describedby="j-phone-hint">
              <p class="hint" id="j-phone-hint">Workers will use this to contact you. Shown only to applicants.</p>
              <p class="field-error" data-error-for="phone" role="alert"></p>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="job-submit">
              <span class="btn-label">Post job</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  `;
}

export async function hydrateJobs(params = {}, { openDialog, wireDialog, closeDialog }) {
  const list = document.getElementById('job-list');
  const countEl = document.getElementById('jobs-count');
  const dialog = document.getElementById('job-dialog');
  let trade = params.trade ?? '';

  // Applications already made, so switching a filter or reloading does not
  // present an Apply button for a job the user has already applied to.
  const applied = new Set(loadLocalApplications());

  wireDialog(dialog);

  async function load() {
    list.setAttribute('aria-busy', 'true');
    list.innerHTML = skeletonCards(3);

    let rows = [];
    try {
      rows = await listJobs({ trade });
    } catch (err) {
      console.error('[jobs] load failed', err);
      list.setAttribute('aria-busy', 'false');
      list.innerHTML = emptyState({
        title: 'Could not load jobs',
        message: 'Check your connection and try again.',
        actionLabel: 'Retry',
        actionId: 'retry-jobs',
        iconName: 'alertTriangle',
      });
      document.getElementById('retry-jobs')?.addEventListener('click', load);
      return;
    }

    list.setAttribute('aria-busy', 'false');
    list.innerHTML = rows.length
      ? rows.map((j) => jobCard(j, applied.has(j.id))).join('')
      : emptyState({
          title: 'No open jobs in this trade',
          message: 'Nothing posted here yet. Check another trade, or post the first job yourself.',
          actionLabel: 'Post a job',
          actionId: 'empty-post-job',
          iconName: 'briefcase',
        });

    document.getElementById('empty-post-job')?.addEventListener('click', () => {
      openDialog(dialog);
    });

    // #jobs-count is role="status"; setting its text is the announcement.
    // An extra announce() call would duplicate it for screen-reader users.
    const msg = `${rows.length} open job${rows.length === 1 ? '' : 's'}`;
    if (countEl) countEl.textContent = msg;
  }

  document.getElementById('job-chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    trade = chip.dataset.trade ?? '';
    document.querySelectorAll('#job-chips .chip').forEach((c) => {
      c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
    });
    load();
  });

  document.getElementById('post-job-btn')?.addEventListener('click', (e) => {
    openDialog(dialog, { returnFocusTo: e.currentTarget });
  });

  /**
   * Put a button into its terminal "Applied" state.
   *
   * Uses aria-disabled rather than the disabled property on purpose: browsers
   * blur a focused element the moment it becomes disabled, which would throw a
   * keyboard user back to the top of the page right after they pressed Enter.
   * The element stays focusable and announces as unavailable; the click
   * handler enforces the actual no-op.
   */
  function markApplied(btn) {
    btn.setAttribute('aria-disabled', 'true');
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    btn.innerHTML = `${icon('checkCircle', { size: 16 })}<span class="btn-label">Applied</span>`;
  }

  list?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-apply]');
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;

    if (!getUser()) {
      toast('Please log in first so the customer can contact you back.', 'info');
      document.getElementById('auth-button')?.click();
      return;
    }

    const jobId = btn.dataset.apply;
    setButtonLoading(btn, true, 'Applying…');
    try {
      await applyToJob(jobId);
      applied.add(jobId);
      setButtonLoading(btn, false);
      markApplied(btn);
      toast('Application sent. The customer can now see your profile.', 'success');
      announce('Application sent');
    } catch (err) {
      console.error('[jobs] apply failed', err);
      setButtonLoading(btn, false);
      // Already-applied is not a failure the user needs to retry; reflect the
      // real state instead of leaving an actionable-looking button.
      if (String(err?.code || '').includes('already-exists')) {
        applied.add(jobId);
        markApplied(btn);
        toast('You have already applied to this job.', 'info');
      } else {
        toast(callableErrorMessage(err), 'error');
      }
    }
  });

  // Live character counter.
  const desc = document.getElementById('j-desc');
  const counter = document.getElementById('j-desc-count');
  desc?.addEventListener('input', () => {
    const len = desc.value.length;
    counter.textContent = `${len} / 1000`;
    counter.dataset.over = String(len > 1000);
  });

  const form = document.getElementById('job-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submit = document.getElementById('job-submit');
    const raw = Object.fromEntries(new FormData(form));
    const { valid, errors, data } = validateJob(raw);

    if (!valid) {
      showFormErrors(form, errors, FIELD_LABELS);
      return;
    }
    clearFormErrors(form);

    setButtonLoading(submit, true, 'Posting…');
    try {
      await createJob(getUser()?.uid ?? 'anonymous', data);
      closeDialog(dialog);
      form.reset();
      counter.textContent = '0 / 1000';
      toast('Job posted. Workers in your city can see it now.', 'success');
      await load();
    } catch (err) {
      console.error('[jobs] create failed', err);
      showFormErrors(form, { title: 'Could not post the job. Please try again.' }, FIELD_LABELS);
    } finally {
      setButtonLoading(submit, false);
    }
  });

  await load();
}
