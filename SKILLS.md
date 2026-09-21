# Installed AI Skills

This repo vendors the [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
plugin (MIT licensed) so any AI coding assistant working in this repo has design
intelligence available offline.

- **Source:** `nextlevelbuilder/ui-ux-pro-max-skill`
- **Version:** 2.13.0
- **Vendored commit:** `de5f12b400775997d213524ef02a7c7d2746806f` (2026-09-19)
- **Location:** `.claude/skills/` (7 skills) + `.claude-plugin/` (plugin manifests)
- **Requires:** Python 3.x — no third-party packages, no network access

Nothing in the KaamMilega site (`index.html`, `style.css`, `script.js`) was
changed by this install. These are assistant-facing reference files only.

---

## The 7 skills

| Skill | Use it for |
|---|---|
| **ui-ux-pro-max** | The main one. Searchable design database: styles, palettes, fonts, UX rules, icons, charts, stack guidelines. |
| **ui-styling** | Building accessible UI with shadcn/ui components and Tailwind. |
| **design-system** | Design token architecture (primitive → semantic → component), Tailwind integration. |
| **design** | Umbrella router: brand identity, logos, icons, slides, social/marketing imagery. |
| **brand** | Brand voice, visual identity, messaging frameworks, consistency checklists. |
| **slides** | Strategic HTML presentations with Chart.js and design tokens. |
| **banner-design** | Social media banners, ad creatives, website hero images. |

What `ui-ux-pro-max` has indexed locally:

- 79 searchable styles (50 active)
- 192 product palettes with reasoning profiles
- 74 font pairings + 1,934 Google Fonts
- 119 UX guidelines
- 105 curated icons (1,512 upstream Phosphor icons)
- 17 GSAP motion presets, 25 chart types
- 22 technology stacks / 1,260 stack guidelines

---

## How to run it

The upstream docs use `${CLAUDE_PLUGIN_ROOT}`. In this repo the plugin root is
the repo root, so run from the repo root:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
```

Use `python` or `py -3` if `python3` isn't on your PATH.

### Full design system for a page or project

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "local services marketplace india hire workers" --design-system -p "KaamMilega"
```

Add `--persist --output-dir .` to write `design-system/kaammilega/MASTER.md`.
It will **not** overwrite an existing MASTER.md unless you pass `--force`
— read the existing file first; don't discard decisions already made.

Optional 1–10 dials: `--variance` (minimal → bold), `--motion` (subtle →
choreographed), `--density` (spacious → dashboard-dense).

### Focused searches

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain> -n 5
```

Domains: `style`, `color`, `typography`, `google-fonts`, `product`, `landing`,
`ux`, `icons`, `gsap`, `chart`, `react`, `web`

### Stack-specific guidance

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack html-tailwind
```

Stacks: `react`, `nextjs`, `vue`, `svelte`, `astro`, `nuxtjs`, `nuxt-ui`,
`angular`, `laravel`, `swiftui`, `react-native`, `flutter`, `jetpack-compose`,
`html-tailwind`, `shadcn`, `threejs`, `javafx`, `wpf`, `winui`, `avalonia`,
`uno`, `uwp`

> **Note for this repo:** KaamMilega is vanilla HTML/CSS/JS with no build step.
> There is no exact stack entry for that. `--stack html-tailwind` is the nearest
> match, but treat its Tailwind-specific advice (`@theme`, utility classes) as
> conceptual — translate it to plain CSS custom properties in `style.css`.

### Other flags

`--json` machine-readable · `--full` no truncation · `-f markdown` markdown output

---

## Querying well

Searches are keyword-matched against local CSVs, so query phrasing decides result quality.

- One dominant intent, 2–5 meaningful terms: `"keyboard focus modal"`, not a whole audit checklist
- Pass `--domain` explicitly when auto-detection could misroute (e.g. "font" hits both `typography` and `google-fonts`)
- Search the **semantic UX outcome first**, then the stack — `"error summary validation" --domain ux` before `--stack html-tailwind`
- If results are empty or off-topic, retry **once** with a narrower rewrite. If it's still empty, say the recommendation came from general defaults rather than a database match. Never present a 0-result search as data.
- Treat results as recommendations, not orders — they don't override the user or this repo's conventions

---

## Priority order when reviewing UI

Work top-down; item 1 outranks item 10.

| # | Category | Must have | Avoid |
|---|---|---|---|
| 1 | Accessibility | 4.5:1 contrast, alt text, keyboard nav, aria-labels | Removing focus rings, icon-only buttons with no label |
| 2 | Touch & interaction | 44×44px targets, 8px+ spacing, loading feedback | Hover-only affordances, 0ms state changes |
| 3 | Performance | WebP/AVIF, lazy loading, reserved space (CLS < 0.1) | Layout thrashing, cumulative layout shift |
| 4 | Style selection | Match product type, stay consistent, SVG icons | **Emoji as icons**, mixing flat + skeuomorphic |
| 5 | Layout & responsive | Mobile-first breakpoints, viewport meta, no h-scroll | Fixed px widths, disabling zoom |
| 6 | Typography & color | 16px base, 1.5 line-height, semantic tokens | Body text < 12px, gray-on-gray, raw hex in components |
| 7 | Animation | Context-aware timing, motion with meaning | One duration for everything, animating width/height, ignoring reduced-motion |
| 8 | Forms & feedback | Visible labels, errors near the field, helper text | Placeholder-as-label, errors only at the top |
| 9 | Navigation | Predictable back, bottom nav ≤ 5, deep linking | Overloaded nav, broken back behavior |
| 10 | Charts & data | Legends, tooltips, accessible colors | Color as the only signal |

Deeper reading, on demand rather than up front:
`.claude/skills/ui-ux-pro-max/references/quick-reference.md` (all 119 rules) and
`.claude/skills/ui-ux-pro-max/references/pro-rules.md` (pre-delivery checklist).

---

## What the skill says about the current KaamMilega UI

Run for reference; not yet applied to the site.

```
"local services marketplace india hire workers" --design-system -p "KaamMilega"
```

- **Pattern:** Funnel (3-step conversion) — hero → problem → solution → action → CTA progression
- **Style:** Minimalism & Swiss Style — clean, grid-based, high contrast
- **Palette:** location green `#059669` primary + action orange `#EA580C` accent, `#ECFDF5` background, `#064E3B` foreground
- **Typography:** Inter / Inter
- **Avoid:** no map, hidden reviews

Gaps it flags in today's build, for whenever you pick the redesign up:

1. **Emoji used as icons** throughout (🛠️ ⚡ 🔧 📸 in the category cards, workforce strip, hero) — priority 4 says replace with SVG (Heroicons/Lucide)
2. **No visible focus states** for keyboard navigation — priority 1
3. **Placeholder-only labels** on every form and login field — priority 8 wants visible labels
4. **No `prefers-reduced-motion` handling** — priority 7
5. Blue `#0757c9` / `#173d88` palette vs. the recommended green + orange
6. Colors are raw hex in `style.css`, not CSS custom-property tokens — priority 6

Note that #1 is a real trade-off: emoji need no asset pipeline and keep this a
zero-dependency single-folder demo. Swapping to inline SVG is the fix that stays
within that constraint.

---

## Updating the vendored copy

```bash
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/skillrepo
rm -rf .claude/skills && cp -r /tmp/skillrepo/.claude/skills .claude/skills
cp /tmp/skillrepo/.claude-plugin/*.json .claude-plugin/
find .claude -name '__pycache__' -type d -prune -exec rm -rf {} +
```

Then update the version and commit hash at the top of this file.
