/**
 * UI primitives: toasts, dialogs, focus management, formatting.
 * Every pattern here traces to a ui-ux-pro-max guideline (noted inline).
 */

import { icon } from './icons.js';
import { escapeHTML } from './security.js';

/* -------------------------------------------------------------------- Toast */

const TOAST_ICONS = { success: 'checkCircle', error: 'alertCircle', info: 'info' };

/**
 * Announce a transient message.
 * The container is an aria-live region so screen readers hear it too.
 * Errors use role="alert" (assertive); success/info use polite.
 */
export function toast(message, type = 'info', { duration = 5000 } = {}) {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML =
    `${icon(TOAST_ICONS[type] || 'info', { size: 18 })}` +
    `<p>${escapeHTML(message)}</p>` +
    `<button type="button" class="toast-dismiss" aria-label="Dismiss notification">` +
    `${icon('x', { size: 16 })}</button>`;

  el.querySelector('.toast-dismiss').addEventListener('click', () => remove());

  let timer = null;
  const remove = () => {
    clearTimeout(timer);
    el.remove();
  };

  // Pause auto-dismiss while hovered or focused — users need time to read.
  const start = () => {
    timer = setTimeout(remove, duration);
  };
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', start);
  el.addEventListener('focusin', () => clearTimeout(timer));
  el.addEventListener('focusout', start);

  region.appendChild(el);
  start();
  return remove;
}

/* ------------------------------------------------------------------- Dialog */

/**
 * Open a <dialog> with correct focus handling.
 * Native <dialog>.showModal() already gives us focus trapping, Esc-to-close
 * and inert background content — no custom trap needed.
 */
export function openDialog(dialog, { returnFocusTo = document.activeElement } = {}) {
  if (!dialog) return;
  dialog.__returnFocus = returnFocusTo;
  dialog.showModal();

  // Move focus to the first meaningful control, not the close button.
  const target =
    dialog.querySelector('[data-autofocus]') ||
    dialog.querySelector('input, select, textarea, button:not(.modal-close)');
  target?.focus();
}

export function closeDialog(dialog) {
  if (!dialog?.open) return;
  dialog.close();
}

/** Wire standard close affordances once per dialog. */
export function wireDialog(dialog) {
  if (!dialog || dialog.__wired) return;
  dialog.__wired = true;

  dialog.querySelectorAll('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => closeDialog(dialog));
  });

  // Click on the backdrop (outside the box) closes.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog(dialog);
  });

  // Restore focus to whatever opened it.
  dialog.addEventListener('close', () => {
    const el = dialog.__returnFocus;
    if (el && document.contains(el)) el.focus();
  });
}

/* ------------------------------------------------------- Form error display */

/**
 * Render inline field errors plus a focusable error summary.
 * Guideline: keep inline errors AND a summary; link each summary item to its
 * field; move focus to the summary after a failed submit.
 */
export function showFormErrors(form, errors, labels = {}) {
  clearFormErrors(form);

  const entries = Object.entries(errors);
  if (entries.length === 0) return;

  entries.forEach(([field, message]) => {
    const input = form.querySelector(`[name="${CSS.escape(field)}"]`);
    const errorEl = form.querySelector(`[data-error-for="${CSS.escape(field)}"]`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (errorEl?.id) input.setAttribute('aria-describedby', errorEl.id);
    }
    if (errorEl) {
      errorEl.innerHTML = `${icon('alertCircle', { size: 15 })}<span>${escapeHTML(message)}</span>`;
    }
  });

  const summary = form.querySelector('[data-error-summary]');
  if (summary) {
    const items = entries
      .map(([field, message]) => {
        const id = form.querySelector(`[name="${CSS.escape(field)}"]`)?.id;
        const label = labels[field] || field;
        return id
          ? `<li><a href="#${escapeHTML(id)}">${escapeHTML(label)}: ${escapeHTML(message)}</a></li>`
          : `<li>${escapeHTML(label)}: ${escapeHTML(message)}</li>`;
      })
      .join('');

    summary.innerHTML =
      `<h3>${icon('alertTriangle', { size: 18 })}` +
      `There ${entries.length === 1 ? 'is 1 problem' : `are ${entries.length} problems`} with this form</h3>` +
      `<ul>${items}</ul>`;
    summary.hidden = false;

    // Summary links jump to and focus the offending field.
    summary.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const id = a.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        target?.focus();
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    });

    summary.focus();
  }
}

export function clearFormErrors(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  form.querySelectorAll('[data-error-for]').forEach((el) => {
    el.innerHTML = '';
  });
  const summary = form.querySelector('[data-error-summary]');
  if (summary) {
    summary.hidden = true;
    summary.innerHTML = '';
  }
}

/** Toggle a button into a loading state without losing its width. */
export function setButtonLoading(button, loading, loadingLabel = 'Working…') {
  if (!button) return;
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.dataset.loading = 'true';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span class="btn-label">${escapeHTML(loadingLabel)}</span>`;
  } else {
    button.dataset.loading = 'false';
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

/* --------------------------------------------------------------- Formatting */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(value) {
  // Number(null) and Number('') are both 0, which would render a missing rate
  // as "₹0" — i.e. "free". Treat empty/nullish as unknown instead.
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? inr.format(n) : '—';
}

export function formatRange(min, max) {
  return `${formatINR(min)} – ${formatINR(max)}`;
}

/** Relative time, e.g. "2 days ago". */
export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
  const units = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['week', 604800000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(-Math.round(diff / ms), unit);
  }
  return 'just now';
}

/** Star row for a rating, with an accessible text equivalent. */
export function starRow(rating) {
  const rounded = Math.round(Number(rating) || 0);
  const stars = Array.from({ length: 5 }, (_, i) =>
    icon('star', { size: 15, className: i < rounded ? 'star-on' : 'star-off' }),
  ).join('');
  return (
    `<span class="review-stars" role="img" aria-label="${rounded} out of 5 stars">` +
    `${stars}</span>`
  );
}

export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}

/* ------------------------------------------------------------------ Loading */

/** Skeleton cards that reserve the same space as the real card (CLS < 0.1). */
export function skeletonCards(count = 6) {
  return Array.from(
    { length: count },
    () =>
      '<div class="skeleton-card" aria-hidden="true">' +
      '<div style="display:flex;gap:12px;align-items:center">' +
      '<div class="skeleton skeleton-avatar"></div>' +
      '<div style="flex:1;display:grid;gap:8px">' +
      '<div class="skeleton skeleton-title"></div>' +
      '<div class="skeleton skeleton-line-short"></div>' +
      '</div></div>' +
      '<div class="skeleton skeleton-line"></div>' +
      '<div class="skeleton skeleton-line"></div>' +
      '<div class="skeleton skeleton-line-short"></div>' +
      '</div>',
  ).join('');
}

export function emptyState({ title, message, actionLabel, actionId, iconName = 'inbox' }) {
  return (
    '<div class="empty-state">' +
    `<div class="empty-icon">${icon(iconName, { size: 26 })}</div>` +
    `<h3>${escapeHTML(title)}</h3>` +
    `<p>${escapeHTML(message)}</p>` +
    (actionLabel
      ? `<button type="button" class="btn btn-secondary" id="${escapeHTML(actionId)}">${escapeHTML(actionLabel)}</button>`
      : '') +
    '</div>'
  );
}

/** Debounce — used on search inputs to avoid thrashing on every keystroke. */
export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Announce a message to screen readers without a visual toast. */
export function announce(message) {
  const el = document.getElementById('sr-announcer');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => {
    el.textContent = message;
  }, 60);
}
