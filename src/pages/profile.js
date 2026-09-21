/**
 * Worker profile editor.
 * Requires auth — an unauthenticated visit shows a sign-in prompt rather than
 * a dead form.
 */

import { icon } from '../lib/icons.js';
import { escapeHTML } from '../lib/security.js';
import { CATEGORIES, CITIES } from '../data/categories.js';
import { validateProfile, FIELD_LABELS } from '../lib/validation.js';
import { getUser } from '../lib/auth.js';
import { saveWorkerProfile, loadDemoProfile, getWorker } from '../lib/api.js';
import { isDemoMode } from '../lib/firebase.js';
import {
  showFormErrors, clearFormErrors, setButtonLoading, toast, announce, initials,
} from '../lib/ui.js';

export function renderProfile() {
  const user = getUser();

  if (!user) {
    return `
      <div class="section-head" style="margin-top:var(--space-6)">
        <div>
          <p class="eyebrow">Profile</p>
          <h1 class="section-title">My worker profile</h1>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">${icon('user', { size: 26 })}</div>
        <h3>Log in to manage your profile</h3>
        <p>Create a free listing so customers in your city can find and call you directly.</p>
        <button type="button" class="btn btn-primary" id="profile-login-cta">
          ${icon('logIn', { size: 18 })}<span class="btn-label">Login with mobile</span>
        </button>
      </div>`;
  }

  return `
    <div class="section-head" style="margin-top:var(--space-6)">
      <div>
        <p class="eyebrow">Profile</p>
        <h1 class="section-title" id="profile-title">My worker profile</h1>
        <p class="section-sub">This is what customers see when they find you in search.</p>
      </div>
    </div>

    <div class="card" style="display:flex;gap:var(--space-4);align-items:center;margin-bottom:var(--space-6)">
      <span class="avatar" id="profile-avatar" aria-hidden="true">${escapeHTML(initials(user.name || 'You'))}</span>
      <div>
        <h2 style="font-size:var(--text-lg)" id="profile-name-display">${escapeHTML(user.name || 'Your name')}</h2>
        <p class="muted text-sm">${escapeHTML(user.phone || '')}</p>
      </div>
      <div style="margin-left:auto;display:flex;gap:var(--space-2);flex-wrap:wrap">
        <span class="badge badge-neutral" id="profile-status">Not listed yet</span>
      </div>
    </div>

    <form id="profile-form" novalidate>
      <div class="error-summary" data-error-summary tabindex="-1" role="alert" hidden></div>

      <div class="form">
        <div class="form-row">
          <div class="field">
            <label for="p-name">Full name <span class="required" aria-hidden="true">*</span></label>
            <input class="input" id="p-name" name="name" type="text" maxlength="60" required
                   autocomplete="name" placeholder="Rahul Kumar">
            <p class="field-error" data-error-for="name" role="alert"></p>
          </div>

          <div class="field">
            <label for="p-trade">Work you do <span class="required" aria-hidden="true">*</span></label>
            <select class="select" id="p-trade" name="trade" required>
              <option value="">Choose your trade</option>
              ${CATEGORIES.map((c) => `<option value="${escapeHTML(c.slug)}">${escapeHTML(c.name)}</option>`).join('')}
            </select>
            <p class="field-error" data-error-for="trade" role="alert"></p>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="p-city">City <span class="required" aria-hidden="true">*</span></label>
            <input class="input" id="p-city" name="city" type="text" maxlength="60" required
                   list="city-options" autocomplete="address-level2" placeholder="Ayodhya">
            <datalist id="city-options">
              ${CITIES.map((c) => `<option value="${escapeHTML(c)}"></option>`).join('')}
            </datalist>
            <p class="field-error" data-error-for="city" role="alert"></p>
          </div>

          <div class="field">
            <label for="p-phone">Mobile number <span class="required" aria-hidden="true">*</span></label>
            <input class="input" id="p-phone" name="phone" type="tel" inputmode="numeric"
                   maxlength="10" required autocomplete="tel-national" placeholder="98765 43210"
                   aria-describedby="p-phone-hint">
            <p class="hint" id="p-phone-hint">Customers will call this number directly.</p>
            <p class="field-error" data-error-for="phone" role="alert"></p>
          </div>
        </div>

        <div class="field">
          <label for="p-rate">Day rate in ₹</label>
          <input class="input" id="p-rate" name="rate" type="text" inputmode="numeric"
                 maxlength="6" placeholder="600" aria-describedby="p-rate-hint">
          <p class="hint" id="p-rate-hint">Optional. A starting price helps customers decide faster.</p>
          <p class="field-error" data-error-for="rate" role="alert"></p>
        </div>

        <div class="field">
          <label for="p-bio">About your work</label>
          <textarea class="textarea" id="p-bio" name="bio" maxlength="500"
                    placeholder="What you specialise in, areas you cover, how quickly you can come."
                    aria-describedby="p-bio-count"></textarea>
          <p class="char-count" id="p-bio-count" aria-live="polite">0 / 500</p>
          <p class="field-error" data-error-for="bio" role="alert"></p>
        </div>

        <label class="checkbox-field">
          <input type="checkbox" name="available" id="p-available" checked>
          <span>I am available for work right now</span>
        </label>

        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
          <button type="submit" class="btn btn-primary btn-lg" id="profile-submit">
            <span class="btn-label">Save profile</span>
          </button>
          <button type="button" class="btn btn-ghost" id="profile-signout">
            ${icon('logOut', { size: 18 })}<span class="btn-label">Log out</span>
          </button>
        </div>

        ${isDemoMode
          ? `<p class="hint">${icon('info', { size: 14 })} Demo mode — your profile is saved in this browser only.
             Connect Firebase to store it for real.</p>`
          : ''}
      </div>
    </form>
  `;
}

export async function hydrateProfile(_params, { onSignOut }) {
  document.getElementById('profile-login-cta')?.addEventListener('click', () => {
    document.getElementById('auth-button')?.click();
  });

  const form = document.getElementById('profile-form');
  if (!form) return;

  const user = getUser();
  const bio = document.getElementById('p-bio');
  const counter = document.getElementById('p-bio-count');

  bio?.addEventListener('input', () => {
    counter.textContent = `${bio.value.length} / 500`;
    counter.dataset.over = String(bio.value.length > 500);
  });

  // Prefill from whatever is already stored.
  try {
    const existing = isDemoMode ? loadDemoProfile() : await getWorker(user.uid);
    if (existing) {
      form.querySelector('#p-name').value = existing.name ?? '';
      form.querySelector('#p-trade').value = existing.trade ?? '';
      form.querySelector('#p-city').value = existing.city ?? '';
      form.querySelector('#p-phone').value = existing.phone ?? '';
      form.querySelector('#p-rate').value = existing.rate ?? '';
      form.querySelector('#p-bio').value = existing.bio ?? '';
      form.querySelector('#p-available').checked = existing.available !== false;
      counter.textContent = `${(existing.bio ?? '').length} / 500`;
      document.getElementById('profile-status').textContent = 'Listed';
      document.getElementById('profile-status').className = 'badge badge-verified';
    }
  } catch (err) {
    console.warn('[profile] prefill failed', err);
  }

  // Prefill the phone from the signed-in number.
  const phoneInput = form.querySelector('#p-phone');
  if (!phoneInput.value && user?.phone) {
    phoneInput.value = String(user.phone).replace(/^\+91/, '');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submit = document.getElementById('profile-submit');
    const raw = Object.fromEntries(new FormData(form));
    raw.available = form.querySelector('#p-available').checked;

    const { valid, errors, data } = validateProfile(raw);
    if (!valid) {
      showFormErrors(form, errors, FIELD_LABELS);
      return;
    }
    clearFormErrors(form);

    setButtonLoading(submit, true, 'Saving…');
    try {
      await saveWorkerProfile(user.uid, data);
      toast('Profile saved. Customers can find you now.', 'success');
      announce('Profile saved successfully');
      document.getElementById('profile-name-display').textContent = data.name;
      document.getElementById('profile-avatar').textContent = initials(data.name);
      const status = document.getElementById('profile-status');
      status.textContent = 'Listed';
      status.className = 'badge badge-verified';
    } catch (err) {
      console.error('[profile] save failed', err);
      showFormErrors(
        form,
        { name: 'Could not save your profile. Please try again.' },
        FIELD_LABELS,
      );
    } finally {
      setButtonLoading(submit, false);
    }
  });

  document.getElementById('profile-signout')?.addEventListener('click', onSignOut);
}
