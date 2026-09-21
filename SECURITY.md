# Security Policy

## Reporting a vulnerability

Email **security@kaam-milega.example** with a description, reproduction steps,
and the impact you believe it has. We aim to acknowledge within 72 hours.

Please report privately first and give us reasonable time to fix the issue
before disclosing it publicly. While testing, do not run automated scanners
against production, and never access, modify or exfiltrate another user's data —
use your own account or the local emulator suite.

A machine-readable contact is published at
[`/.well-known/security.txt`](public/.well-known/security.txt) per RFC 9116.

---

## Where the security boundary actually is

**`firebase/firestore.rules` and `functions/` are the only real boundary.**

Everything in `src/lib/validation.js` and `src/lib/security.js` runs in the
user's browser and can be bypassed with devtools in about ten seconds. It
exists to give honest users fast, clear feedback — not to stop attackers. Any
rule that matters is enforced again server-side.

---

## Controls in place

### Firestore rules
- Default deny; every collection is explicitly allowlisted.
- Owner-only writes, enforced against `request.auth.uid`.
- Field allowlists via `hasOnly()`, so a client cannot inject unexpected fields.
- Clients can **never** write `verified`, `rating`, `reviewCount`, `jobsDone`,
  `featured` or `suspended` — the trust signals that make the product worth
  anything.
- Type and length checks mirroring `LIMITS` in `src/lib/validation.js`.
- App Check (`request.app != null`) required on writes.
- Reviews are deny-all to clients; only Cloud Functions may write them.

### Cloud Functions
- `submitReview` verifies a completed engagement exists between the reviewer
  and the worker before accepting a rating, and enforces one review per pair.
- `applyToJob` increments the applicant counter inside a transaction, so the
  count can never be forged.
- `deleteMyAccount` implements the DPDP Act right to erasure across all
  collections plus the auth record.
- App Check enforced with token consumption on state-changing calls.

### Client
- All dynamic text is HTML-escaped before insertion (`escapeHTML`, `html`).
- URLs are scheme-allowlisted — `javascript:`, `data:` and `vbscript:` are
  rejected, and a scheme-like string is never reinterpreted as a relative path.
- Control characters stripped and lengths clamped before anything is persisted.
- Contact actions and OTP requests are rate-limited.
- Analytics loads only after explicit consent.

### Transport and headers
Configured in `netlify.toml`:
- Strict CSP with **no `unsafe-eval`** and `object-src 'none'`.
- `frame-ancestors 'none'` plus `X-Frame-Options: DENY`.
- HSTS, `max-age=63072000`, `includeSubDomains`, `preload`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` denying camera, microphone, payment, USB and sensors.
- `X-Content-Type-Options: nosniff`.

---

## Known limitations

Recorded honestly rather than hidden.

1. **`style-src` still allows `'unsafe-inline'`.** A handful of layout styles
   are set inline. Removing this needs a nonce-based build step. Until then,
   a CSS-injection vector would not be blocked by CSP alone — though every
   injection point is HTML-escaped first.

2. **Free-text worker search runs client-side.** Firestore has no substring
   search, so `listWorkers` filters in the browser after the indexed query.
   That is fine at current scale but leaks no more than the public listing
   already does. Move to Algolia or Typesense before the directory grows large.

3. **Demo mode is not secure and does not pretend to be.** With no Firebase
   config the app accepts OTP `123456` and stores the profile in
   `localStorage`. It is labelled in the footer and must never be deployed as
   a real service.

4. **Phone numbers are public on worker listings.** That is the product — a
   customer must be able to call. Workers should understand this before
   listing; it is stated in the privacy policy.

5. **`submitReview` is reachable but has no verified-engagement source yet.**
   The function refuses to write a review unless a completed `engagements`
   document exists for that customer and worker, which is the correct gate.
   Nothing in the product creates `engagements` yet — a job application does
   not imply the job was done — so in practice no review can currently be
   submitted through the UI. The seeded reviews exist to populate the demo.
   Closing this needs a "mark this job complete" step that both parties
   confirm; until then, do not relax the check in the function to work around
   it, because an unverified review system is worse than none for a product
   whose only real asset is trust.

6. **Applying to a job reveals the applicant's profile to the job owner.**
   `applyToJob` writes `jobs/{id}/applications/{uid}`, readable by the owner.
   That is intended, but it means an application is not anonymous and cannot
   be withdrawn from the UI yet.

---

## Pre-launch checklist

Before pointing a real domain at this:

- [ ] Deploy `firestore.rules` and `storage.rules` **before** any real data exists
- [ ] Enable App Check with reCAPTCHA v3 and set `VITE_RECAPTCHA_SITE_KEY`
- [ ] Turn on App Check **enforcement** in the Firebase console (registering is not enough)
- [ ] Set Firebase Auth quotas and enable phone-auth abuse protection
- [ ] Deploy the Cloud Functions (reviews are broken without them)
- [ ] Replace every `@kaam-milega.example` address with a real, monitored inbox
- [ ] Update the `Expires` date in `security.txt`
- [ ] Have a lawyer review `/privacy` and `/terms` — the current text is a draft
- [ ] Set up Firebase billing alerts
- [ ] Verify the deployed CSP with an actual browser console, not just the config
- [ ] Confirm HSTS preload is acceptable — it is hard to reverse
