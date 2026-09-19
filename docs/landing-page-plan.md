# Landing page plan

**Status:** plan only — nothing here is built yet.

**Goal:** a small, single-page marketing site for DrinkUp — same Gen-Z "sticker sheet" visual language as the app — that gives it a real front door instead of "find the GitHub repo, read the README." Hero pitch, feature rundown, how-it-works walkthrough, clear download CTA.

---

## Decisions

- **Stack:** Next.js (App Router) + Tailwind, deployed to Vercel's free tier.
- **Location:** new `website/` folder at the repo root, alongside `renderer/` and `src-tauri/` — its own Vercel project with root directory `website`.
- **Scope:** one scrolling page. Room to add pages later (e.g. a changelog), not needed now.
- **Download link:** the generic "latest release" GitHub asset URL (`.../releases/latest/download/<name>`), so it never needs manual updates when a new version ships. **This has a real prerequisite** — see "Before the download button works" below.
- **Platforms shown:** Windows only. No macOS/Linux mentions or "coming soon" buttons — those are still just roadmap items, not real yet.
- **Dark mode:** follows OS preference only (`prefers-color-scheme`), no manual toggle — matches the app's own "Match Windows" default and keeps v1 simple.

If/when this is actually built, it should happen on its own branch, not on `main`.

---

## Design system to port

Source of truth: `renderer/theme.css` + `renderer/settings.css`. Reuse these tokens and motifs exactly — don't reinterpret them.

### Fonts

Copy `renderer/fonts/*.woff2` (OFL-licensed) into `website/public/fonts/`, load via `next/font/local`.

- Display/headings: `Bricolage Grotesque` (weights 500–800), fallback `'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif`
- Labels/tags/microcopy: `Space Mono` 700, fallback `'Cascadia Mono', Consolas, monospace`

### Color tokens

Port `renderer/theme.css`'s `:root` and `:root.dark` blocks verbatim into `website/src/app/globals.css` as CSS custom properties (light block + a `@media (prefers-color-scheme: dark)` override). Map them into `tailwind.config.ts` `theme.extend.colors`: `pool`, `dieCut`, `fizz`, `fizzEdge`, `bubblegum`, `sheet`, `sheetDot`, `card`, `line`, `text`, `muted`, `ink`, `onPool`. Using CSS vars means one dark-mode media query handles every component — no doubled `dark:` classes.

| Token | Light | Dark |
|---|---|---|
| `--pool` (hero blue) | `#2a4df5` | `#161c4f` |
| `--die-cut` (sticker border) | `#ffffff` | `#2e3780` |
| `--fizz` / `--fizz-edge` (lime CTA + offset shadow) | `#d8ff3c` / `#0f1330` | `#d8ff3c` / `#5f7800` |
| `--bubblegum` (pink tag chips) | `#ff7ac6` | `#ff7ac6` |
| `--sheet` / `--sheet-dot` (dot-grid bg) | `#eef1fb` / `#d5dbf0` | `#080a1f` / `#1a2150` |
| `--card` / `--line` | `#ffffff` / `#dce1f3` | `#121840` / `#262d63` |
| `--text` / `--muted` | `#0f1330` / `#5a6190` | `#eef1ff` / `#9ca3d3` |

### Signature motifs (all from `renderer/settings.css`, ~lines 164–296)

1. **Dot-grid background** — `background-color:var(--sheet); background-image:radial-gradient(var(--sheet-dot) 1.5px, transparent 1.5px); background-size:16px 16px; background-attachment:fixed;` applied on `body` in `globals.css`.
2. **Die-cut sticker card** — padded white/navy outer shell around a colored inner card: outer `padding:4px; border-radius:24px; background:var(--die-cut); box-shadow:0 10px 24px var(--shadow-sheet), 0 2px 4px rgba(10,16,60,.08);`; inner `border-radius:20px; background:var(--pool); color:var(--on-pool); padding:18px 18px 16px;`.
3. **Keycap CTA button** — lime pill with a solid offset "pressable" shadow: `background:var(--fizz); color:var(--ink); font-weight:800; padding:8px 16px 7px; border-radius:999px; box-shadow:0 3px 0 var(--fizz-edge);` → hover: `translateY(-1px)` + shadow grows to `0 4px 0`; active: `translateY(2px)` + shadow shrinks to `0 1px 0`.
4. **Rotated tag badge** — small uppercase mono pill (e.g. "DRIPPY SAYS"): `background:var(--bubblegum); color:var(--ink); font-family:var(--label); font-size:10.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:5px 12px 4px; border-radius:999px; box-shadow:0 0 0 3px var(--die-cut); transform:rotate(-3deg);`, placed with negative margin so it overlaps the card below it, like a sticker slapped on top. Use sparingly (1–2 places), not as wallpaper.
5. Generous rounding (18–24px), soft ambient shadows, no hard edges anywhere.

### Assets to reuse directly (don't recreate)

- `docs/images/reminder-light.png` / `reminder-dark.png` — the best available marketing screenshot (Drippy + the reminder sticker bubble). Use as the hero centerpiece via a theme-aware `<picture>` (same technique the README already uses):
  ```html
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="/images/reminder-dark.png">
    <img src="/images/reminder-light.png" alt="A DrinkUp reminder: Drippy the water-drop buddy next to a blue sticker-style speech bubble that says 'water break, bestie' with an 'i drank' button and a 'not rn' link" width="…" height="…">
  </picture>
  ```
  Plain `<picture>`/`<img>` over `next/image` here specifically — `next/image` doesn't support the dark-mode `<source>` swap.
- `src-tauri/icons/icon.png` — app icon, reuse for favicon + nav logo mark.
- There's no standalone Drippy sprite anywhere (the mascot is drawn in-app, not stored as an asset) — not a blocker, the screenshot above is enough for v1.

---

## Site structure

```
website/
├── package.json, next.config.mjs, tailwind.config.ts, tsconfig.json
├── public/
│   ├── fonts/            ← copied from renderer/fonts/
│   ├── images/            ← reminder-light.png, reminder-dark.png copied from docs/images/
│   └── icon.png            ← copied from src-tauri/icons/icon.png
├── src/
│   ├── app/
│   │   ├── layout.tsx      ← fonts via next/font/local, metadata/OG tags, favicon
│   │   ├── page.tsx        ← composes sections in order
│   │   └── globals.css     ← ported color tokens + dot-grid on body
│   └── components/
│       ├── layout/Nav.tsx, layout/Footer.tsx
│       ├── ui/StickerCard.tsx, ui/KeycapButton.tsx, ui/OutlinePillButton.tsx, ui/TagBadge.tsx
│       └── sections/Hero.tsx, Features.tsx, HowItWorks.tsx, DownloadCta.tsx
└── lib/constants.ts        ← GITHUB_REPO_URL, DOWNLOAD_URL, APP_VERSION_LABEL, DOWNLOAD_MICROCOPY (single source of truth, used by Nav + Hero + DownloadCta + Footer)
```

---

## Page sections, in order

### 1. Nav

Sticky (`bg-sheet/90 backdrop-blur border-b border-line`). Logo mark + "DrinkUp" wordmark, "GitHub" link, compact `KeycapButton` "Download". Only two links — no hamburger needed.

### 2. Hero

Two-column on desktop (text left, screenshot right in a `StickerCard`), stacked on mobile.

- `TagBadge` "DRIPPY SAYS" overlapping the top of the screenshot's sticker card.
- H1: *"a tiny water reminder that actually gets out of your way."*
- Sub: *"DrinkUp lives in your Windows tray, splashes a reminder onto your screen when it's time to sip, and dives back out. No accounts, no subscriptions, no nagging popups you have to fight with — just one tiny .exe."*
- Primary `KeycapButton` "⬇ Download for Windows" + secondary text link "View on GitHub →".
- Microcopy: *"Windows 10 / 11 · x64 · v0.2.0 · ~2 MB"*.

### 3. Features

Heading *"everything it does. nothing it doesn't."*, subhead *"nine small things that add up to one buddy who never lets you forget."* Grid of 6 `StickerCard`s (condensed from the README's 9-item table so cards stay distinct, not repetitive): `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

- 💦 Splash-in reminders
- ⏱️ Live countdown & flexible intervals
- 🎭 Your character (custom avatar upload)
- 🌙 Themes that match you (light/dark/match Windows)
- 📌 Always on top, tray-first
- 🚀 Auto-startup, soft sounds, pause anytime

### 4. How It Works

Heading *"how it works"*, subhead *"no accounts. no setup wizard. just a drop that falls right on schedule."* 5-step sequence distilled from the README's flow, wrapped in one large `pool`-toned `StickerCard` to echo the in-app reminder bubble:

timer fires → drop falls, buddy springs out → sticker bubble slaps on → you decide (i drank / not rn) → buddy dives back in, timer resets.

Horizontal row with connectors on desktop, vertical stack with a connecting line on mobile.

### 5. Download CTA band

Full-width `StickerCard` (`tone="pool"`). Heading *"okay, bestie. let's get you hydrated."*, subhead *"one tiny installer. no bloat, no subscriptions, no accounts to make."*, large `KeycapButton` "⬇ Download DrinkUp for Windows", microcopy *"Windows 10 / 11 · x64 · v0.2.0 · ~2 MB · MIT licensed"*, secondary `OutlinePillButton` "Browse releases on GitHub →".

### 6. Footer

Understated, dot-grid still visible behind it. *"© 2026 DrinkUp. MIT licensed."* (links to LICENSE) · GitHub repo link · *"made by Aaditya Samani"* (links to GitHub profile) · small footnote *"Built with Tauri."* No placeholder `href="#"` links anywhere — every link is a real, already-known-valid URL.

---

## Critical files to create

- `website/src/app/layout.tsx` — fonts, metadata, OG tags
- `website/src/app/globals.css` — ported color tokens (light + dark media query) + dot-grid
- `website/tailwind.config.ts` — color tokens mapped to CSS vars, font families
- `website/src/components/ui/StickerCard.tsx`, `KeycapButton.tsx`, `TagBadge.tsx`, `OutlinePillButton.tsx`
- `website/src/components/sections/Hero.tsx`, `Features.tsx`, `HowItWorks.tsx`, `DownloadCta.tsx`
- `website/lib/constants.ts`

---

## Before the download button works

The generic download URL (`.../releases/latest/download/DrinkUp_x64-setup.exe`) will **404 today**: the current NSIS build produces `DrinkUp_0.2.0_x64-setup.exe`, with the version baked into the filename. Before wiring the button live:

- **Fix (recommended):** add a version-free filename override to `src-tauri/tauri.conf.json`'s NSIS bundle config (verify the exact key against Tauri 2's current NSIS bundler schema — expected around `bundle.windows.nsis.fileName`), then cut a new release so the fixed filename exists.
- **Fallback if not fixed before launch:** point `DOWNLOAD_URL` in `lib/constants.ts` at `https://github.com/aadityasamani/drinkup/releases` instead (adjust button copy to "See latest release"), and swap to the direct link once the filename is fixed — a one-line change, no other site code affected.

This is repo/build-config work, out of scope for the website itself.

---

## Verification

1. `cd website && npm install && npm run dev` — loads at `localhost:3000`.
2. Check ~375px width (no horizontal scroll, hero stacks, feature grid goes 1-column, how-it-works goes vertical) and ~1440px width (balanced two-column hero, sensible max-width container).
3. Toggle OS/DevTools `prefers-color-scheme: dark` — confirm every section re-themes (dot-grid, sticker cards, buttons, both screenshot variants swap), and `--muted` text stays legible on `--sheet`/`--card` in both modes.
4. Run Lighthouse (Performance/Accessibility/Best Practices/SEO) — check contrast on lime/pink chip text, alt text on the hero screenshot, single `<h1>`/proper heading order, `font-display: swap` (default via `next/font/local`).
5. Confirm every nav/footer/CTA link resolves to a real URL (repo, releases, LICENSE, GitHub profile) — no dead `#` links.
6. Manually verify current download-URL status matches what "Before the download button works" documents (404 until the NSIS fix ships, or already using the fallback releases-page link).
7. Deploy: connect the GitHub repo to a **new** Vercel project with **Root Directory = `website`**, framework preset Next.js, default build command. Spot-check the production URL on an actual phone if possible.
