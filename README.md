# KaamMilega

Find verified local skilled workers across India — electricians, plumbers,
carpenters, tailors, photographers and more. Search by trade and city, check
ratings and real reviews, then call or WhatsApp the worker directly.

No commission. No middleman. No payment handling.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

The app runs in **demo mode** out of the box — no Firebase project needed. It
serves the seed data in `src/data/seed.js` so the whole UI is explorable
immediately. A footer notice makes the mode obvious.

```bash
npm run verify       # lint + 190 tests + production build + smoke test
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Sitemap → bundle → prerender 6 routes → verify 14 artefacts |
| `npm run preview` | Serve the production build locally |
| `npm test` | 190 unit + integration + build-contract tests |
| `npm run smoke` | Boot the built bundle in jsdom, assert 20 runtime checks |
| `npm run lint` | ESLint over app, functions, scripts and tests |
| `npm run verify` | All of the above — run this before pushing |
| `npm run emulators` | Firebase emulator suite (auth, firestore, functions) |

---

## Architecture

Vanilla JS, no UI framework. The whole app is **~24 kB gzipped** because the
target user is on a mid-range Android phone on patchy mobile data — a
framework's baseline cost buys nothing here.

```
src/
  main.js              Router, auth flow, theme, consent, boot
  lib/
    icons.js           Inline SVG set (Lucide-derived). No emoji, no icon font.
    security.js        Escaping, URL sanitising, rate limiting
    validation.js      Shared schema — imported by the client AND functions/
    firebase.js        Lazy SDK init; falls back to demo mode
    auth.js            Phone OTP sign-in
    api.js             Data layer; Firestore or seed data behind one interface
    ui.js              Toasts, dialogs, form errors, formatting, skeletons
  pages/               home, workers, jobs, profile, static
  styles/
    tokens.css         Design tokens (primitive → semantic)
    main.css           Components
firebase/              Security rules + indexes
functions/             Cloud Functions (reviews, applications, account deletion)
scripts/               prebuild (sitemap) · prerender · postbuild (verify) · smoke
```

### Why prerendering

The app is client-rendered, so a crawler would otherwise receive an empty
`<div id="view">`. Googlebot executes JavaScript; Bing, DuckDuckGo, and the
WhatsApp/Facebook/Twitter link previewers largely do not — and this product
spreads by people sharing links on WhatsApp.

`scripts/prerender.mjs` writes fully-populated HTML for `/`, `/workers`,
`/jobs`, `/about`, `/privacy` and `/terms`, each with its own title,
description and canonical URL. The SPA hydrates over it. `/profile` is
deliberately excluded — it is per-user and `noindex`.

---

## Connect Firebase

The app works without this. When you're ready for a real backend:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication → Phone**, **Firestore**, and **Storage**.
3. Copy `.env.example` to `.env.local` and fill in the web config from
   *Project settings → General → Your apps*.
4. Deploy the security rules — **do this before any real data exists**:
   ```bash
   firebase deploy --only firestore:rules,storage:rules,firestore:indexes
   firebase deploy --only functions
   ```
5. Enable **App Check** with reCAPTCHA v3 and set `VITE_RECAPTCHA_SITE_KEY`.

> A Firebase web config is **not a secret**. It ships in every client bundle by
> design. What protects your data is `firebase/firestore.rules` plus App Check —
> never hiding those strings. Never put a service-account key in a `VITE_` var.

### Local backend development

```bash
npm run emulators                    # auth :9099, firestore :8080, UI :4000
# then set VITE_USE_EMULATORS=true in .env.local
```

---

## Deploy to Netlify

Connect the repo and Netlify reads `netlify.toml` — build command, publish
directory, redirects and headers are all configured. Add the `VITE_FIREBASE_*`
variables under *Site settings → Environment variables*.

`netlify.toml` sets a strict CSP (no `unsafe-eval`), HSTS with preload,
`frame-ancestors 'none'`, a locked-down `Permissions-Policy`, and immutable
caching for hashed assets.

---

## Security

The real boundary is **`firebase/firestore.rules`**, not the client. Everything
in `src/lib/validation.js` is a UX affordance that devtools can bypass.

Rules enforce: default deny; owner-only writes; field allowlists; and clients
can **never** write `verified`, `rating`, `reviewCount` or `jobsDone`. Reviews
are Cloud-Functions-only, and `submitReview` checks the caller actually hired
the worker before accepting a rating.

Other measures: all dynamic text is HTML-escaped, URLs are scheme-allowlisted
(blocking `javascript:` and `data:`), contact actions are rate-limited
client-side and OTP requests are capped, and `deleteMyAccount` implements the
DPDP Act right to erasure.

See [SECURITY.md](SECURITY.md) for the disclosure process and the pre-launch
checklist.

---

## Design

The UI was built with the [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
skill, vendored in `.claude/skills/`. The generated design system is in
`design-system/kaammilega/MASTER.md`; see [SKILLS.md](SKILLS.md) for how to
query it.

Style: **Minimalism & Swiss Style** — grid-based, high contrast, generous
whitespace. Colour: location green + action orange.

**One documented deviation.** The skill recommended `#059669` primary and
`#EA580C` accent. Measured against white those are 3.77:1 and 3.56:1 — both
below the 4.5:1 that the skill's own priority-1 accessibility rule requires.
Accessibility outranks palette, so the raw hues are used for large fills only
and the darker `-700`/`-800` steps carry all text. The reasoning is recorded at
the top of `src/styles/tokens.css`.

Accessibility: WCAG 2.2 AA targeted. Skip link, visible focus rings, 44×44px
touch targets, visible labels on every field, focusable error summaries,
`prefers-reduced-motion` honoured, full keyboard operation, and `scroll-padding`
so sticky chrome never obscures focus.

---

## Licence

MIT — see [LICENSE](LICENSE).
