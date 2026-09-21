/**
 * Static content pages: About, Privacy, Terms, and the 404.
 * Real legal copy matters for an app that collects phone numbers — these are
 * honest starting drafts, clearly marked for review before launch.
 */

import { icon } from '../lib/icons.js';

const wrap = (eyebrow, title, body) => `
  <article class="section" style="max-width:var(--container-narrow);margin-top:var(--space-6)">
    <p class="eyebrow">${eyebrow}</p>
    <h1 class="section-title" style="margin-bottom:var(--space-6)">${title}</h1>
    <div class="stack" style="--flow:var(--space-4)">${body}</div>
  </article>`;

export function renderAbout() {
  return wrap(
    'About',
    'Why KaamMilega exists',
    `
    <p>In most Indian towns, finding a reliable electrician or tailor still runs on
    word of mouth. If you have just moved, or you need someone urgently, that network
    is not available to you. Meanwhile skilled workers with years of experience depend
    entirely on whoever happens to recommend them that week.</p>

    <p>KaamMilega puts both sides in the same place. Workers list themselves for free.
    Customers search by trade and city, see ratings and real reviews, and then contact
    the worker directly by phone or WhatsApp.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">We take no commission</h2>
    <p>There is no cut on either side. You agree your own price with the worker. We do
    not sit in the middle of the payment, which means we never hold anyone's money and
    there is no incentive for us to inflate prices.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">What "verified" means</h2>
    <p>A verified badge means we have confirmed the worker's mobile number by OTP and
    checked a government photo ID against the name on the profile. It is not a
    guarantee of work quality — that is what the ratings and reviews are for. Always
    agree scope and price before work starts.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">Staying safe</h2>
    <ul style="padding-inline-start:var(--space-5);display:grid;gap:var(--space-2)">
      <li>Agree the full price before any work begins.</li>
      <li>Pay directly to the worker. Never send money through KaamMilega — we never ask for it.</li>
      <li>For large jobs, pay in stages as work is completed.</li>
      <li>Report any worker who asks for an advance through the app.</li>
    </ul>
  `,
  );
}

export function renderPrivacy() {
  return wrap(
    'Legal',
    'Privacy policy',
    `
    <p class="muted text-sm">Last updated 21 September 2026. This is a starting draft —
    have it reviewed by a lawyer before you launch commercially.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">What we collect</h2>
    <ul style="padding-inline-start:var(--space-5);display:grid;gap:var(--space-2)">
      <li><strong>Mobile number</strong> — required to log in and for customers to contact you.</li>
      <li><strong>Profile details</strong> — name, trade, city, day rate and description, if you choose to list.</li>
      <li><strong>Analytics</strong> — only if you accept. Which pages and trades are viewed, never tied to your name.</li>
    </ul>

    <h2 class="section-title" style="font-size:var(--text-xl)">What we do not do</h2>
    <p>We do not sell your data. We do not share your number with advertisers. We do
    not read your WhatsApp messages — when you tap WhatsApp, the conversation happens
    entirely between you and the other person.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">Your rights</h2>
    <p>Under India's Digital Personal Data Protection Act you can ask for a copy of your
    data, correct it, or have it deleted. Email
    <a href="mailto:privacy@kaam-milega.example">privacy@kaam-milega.example</a> and we
    will respond within 30 days. Deleting your profile removes your listing immediately.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">Cookies</h2>
    <p>Essential cookies keep you logged in and cannot be switched off. Analytics
    cookies only load after you press Accept, and you can change your mind at any time
    from the footer.</p>
  `,
  );
}

export function renderTerms() {
  return wrap(
    'Legal',
    'Terms of use',
    `
    <p class="muted text-sm">Last updated 21 September 2026. This is a starting draft —
    have it reviewed by a lawyer before you launch commercially.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">We are an introduction service</h2>
    <p>KaamMilega lists workers and jobs. We are not a party to any agreement you make.
    We do not employ the workers listed here, we do not supervise their work, and we do
    not handle payments between you.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">Your responsibilities</h2>
    <ul style="padding-inline-start:var(--space-5);display:grid;gap:var(--space-2)">
      <li>Give accurate information in your profile and job posts.</li>
      <li>Do not post another person's phone number without their permission.</li>
      <li>Do not post illegal work, or work that requires a licence you do not hold.</li>
      <li>Treat other users with respect. Harassment gets an account removed.</li>
    </ul>

    <h2 class="section-title" style="font-size:var(--text-xl)">Reviews</h2>
    <p>Only leave a review for work you actually hired. Fake reviews, whether positive
    or negative, are removed and can result in the account being closed.</p>

    <h2 class="section-title" style="font-size:var(--text-xl)">Liability</h2>
    <p>Because we do not carry out the work, we cannot be responsible for its quality,
    for damage caused, or for any dispute over payment. Check credentials, agree terms
    in writing for large jobs, and use your judgement.</p>
  `,
  );
}

export function renderNotFound(path = '') {
  return `
    <div class="empty-state" style="margin-top:var(--space-16)">
      <div class="empty-icon">${icon('search', { size: 26 })}</div>
      <h1 class="section-title">Page not found</h1>
      <p>We could not find <code>${path.replace(/[<>&"]/g, '')}</code>.
         It may have moved, or the link may be wrong.</p>
      <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;justify-content:center">
        <a class="btn btn-primary" href="/" data-route="home">Go to home</a>
        <a class="btn btn-secondary" href="/workers" data-route="workers">Find workers</a>
      </div>
    </div>`;
}
