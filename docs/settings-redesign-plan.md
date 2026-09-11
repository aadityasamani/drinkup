# Settings redesign plan

**Status:** plan only — nothing here is built yet.
**Branch:** `feat/reminder-glowup` (its PR waits until this is done).

**Goal:** bring the settings window in line with the new sticker-style reminder, fix the layout bugs it has at its normal size, and show what people open it for — when the next reminder is coming.

---

## What's broken now

Checked by rendering `renderer/settings.html` at its real window size, 560 × 720.

### Layout bugs at the real window size

- **The status card is crushed** to one clipped line ("Reminding every 45") and the Active badge is cut off. `.status-card` has `overflow: hidden`, which lets the scrolling flex column (`.content`) shrink it.
- **Your interval is off-screen.** The chips scroll sideways with the scrollbar hidden (`.interval-row::-webkit-scrollbar { height: 0 }`). Only 1, 15 and 30 min show, so the selected 45 min, 1 hr and 90 min can't be seen.
- **The custom row spills out of its card** — "1 to 120 minutes" runs past the edge.
- **The main actions sit below the fold.** "Test reminder now" is half visible; "Pause reminders" needs a scroll.
- **The sidebar takes 200 of 560 px** for a logo and a theme button, which is what squeezes everything else. It stays near-black in light mode.

### Missing or out of sync

- **No "next reminder" time.** The status only repeats the interval.
- **Stale after the first load.** The settings page loads once at startup and is only hidden and shown after that. `init()` in `settings.js` never runs again, and `toggle_pause_state()` in `lib.rs` emits nothing — so pausing from the tray, or reopening the window later, still shows the old state.
- **The version is hardcoded** (`v0.1.1` in `settings.html`), and the **1 min "testing" chip ships** in release builds.

### Feel and access

- **Looks like a different app** from the reminder: Inter, slate greys, stock blue.
- **`alert()` pop-ups** for a bad custom interval and failed uploads.
- **Rename and remove appear only on hover**, and remove happens instantly with no confirm.
- **Interval chips and avatar tiles are `div`s** with click handlers: no keyboard access, no focus ring.
- **The title bar ignores the app's dark mode** (nothing calls `set_theme`), and fonts load from Google at runtime, so an offline launch falls back to Segoe UI.

---

## Direction: a sticker sheet

The reminder is a sticker, so settings becomes the sheet it peels off: a dotted backing sheet as the window background, **one loud sticker at the top** that tells you when the next reminder lands, and quiet white cards for everything else. Same tokens and fonts as the reminder, moved into one shared file.

### Tokens — `renderer/theme.css` (new, shared by both windows)

| Token | Used for | Light | Dark |
|---|---|---|---|
| `--pool` | hero sticker face, reminder face | `#2A4DF5` | `#161C4F` |
| `--die-cut` | sticker border | `#FFFFFF` | `#2E3780` |
| `--select` | picked chip, theme segment, avatar ring | `#2A4DF5` | `#2A4DF5` |
| `--fizz` | primary button, switch on | `#D8FF3C` | `#D8FF3C` |
| `--fizz-edge` | keycap edge under primary buttons | `#0F1330` | `#5F7800` |
| `--bubblegum` | name tag only | `#FF7AC6` | `#FF7AC6` |
| `--sheet` | window background | `#EEF1FB` | `#080A1F` |
| `--sheet-dot` | dot grid on the sheet | `#D5DBF0` | `#1A2150` |
| `--card` | section cards | `#FFFFFF` | `#121840` |
| `--line` | borders and dividers | `#DCE1F3` | `#262D63` |
| `--text` / `--muted` | text | `#0F1330` / `#5A6190` | `#EEF1FF` / `#9CA3D3` |
| `--ink` | text on lime and pink (both themes) | `#0F1330` | `#0F1330` |

### Type

- **Bricolage Grotesque** (bundled, variable, optical sizes 12–96) for everything readable. Scale: 48 countdown · 20 hero line · 15 controls · 13 secondary.
- **Space Mono** Bold for section labels and the name tag: 10.5 px, uppercase, 0.08em tracking.

### Layout — one column, no sidebar, 480 × 720 (min 420 × 560), 20 px gutters

```
DrinkUp                               ─  ▢  ✕
────────────────────────────────────────────
 [DRIPPY SAYS]
 ╭─────────────────────────────────────────╮
 │ next sip in                             │
 │ 23 min                         (Drippy) │
 │ every 45 min                            │
 │ [remind me now]  (pause)                │
 ╰─────────────────────────────────────────╯
 HOW OFTEN
 ╭─────────────────────────────────────────╮
 │ [15 min]   [30 min]   [45 min]          │
 │ [1 hr]     [90 min]   [custom]          │
 │ custom → [−] 20 [+] min       1–120 min │
 ╰─────────────────────────────────────────╯
 YOUR BUDDY
 ╭─────────────────────────────────────────╮
 │ (Drippy ✓)  (Mochi)  (+ add png)        │
 │ rename · remove   ← custom avatars      │
 ╰─────────────────────────────────────────╯
 PREFERENCES
 ╭─────────────────────────────────────────╮
 │ theme        [light|dark|match windows] │
 │ splash sound                       (on) │
 │ start with windows                 (on) │
 ╰─────────────────────────────────────────╯
 DrinkUp v0.1.1                     github ↗
```

The custom stepper row only appears while "custom" is picked; the rename/remove row only while a custom avatar is picked.

### Hero states

| State | Big text | Line under it | Buttons | Look |
|---|---|---|---|---|
| Counting down | `23 min` / `1 hr 5 min` | every 45 min | remind me now · pause | pool sticker, buddy peeking |
| Under a minute | `any sec now` | every 45 min | remind me now · pause | same |
| Paused (app or tray) | `paused` | nothing until you resume | resume | dashed empty outline, sleeping buddy |
| Reminder on screen | `on screen` | drink up, then tap "i drank" | — | pool sticker |

### Components

- **Buttons:** primary is the lime keycap from the reminder (3 px edge, presses down 2 px). Secondary is an outline pill.
- **Selection:** one treatment everywhere — pool-blue face, white text, ink edge — for interval chips, theme segments and the picked avatar ring, plus a small lime "picked" tag on the avatar.
- **Avatar tiles:** die-cut stickers in a 3-column grid; the last tile is a dashed "+ add png". Remove asks inline: "remove mochi? [remove] [keep]". Upload errors show under the grid.
- **Switches:** lime track with an ink thumb when on.
- **Section labels:** Space Mono caps above each card; no titles inside cards.
- **Motion:** only the hero slaps in when the window opens (reuse `slap` from the reminder) and a chip pops when picked. Reduced motion turns both off.

---

## What changes

### Rust — `src-tauri/src/lib.rs`

| Change | Where | Why |
|---|---|---|
| Store when the next reminder fires | `AppState.next_reminder_at: Mutex<Option<SystemTime>>`; set in `schedule()`, cleared in `cancel_pending()` and `show_reminder()` | the hero countdown |
| `get_status` command | returns `{ paused, intervalMin, nextReminderAt (unix ms or null), reminderVisible, avatarName }` | one call for the hero |
| `status-changed` event | emitted from `schedule()`, `toggle_pause_state()`, `set_interval`, `set_avatar`, `show_reminder()`, `close_reminder()` | settings stays in sync with the tray |
| Refresh when settings opens | `open_settings_window()` emits `status-changed` | reopening shows the current state |
| Theme: light / dark / match Windows *(decision 1)* | `Settings.theme` replaces `dark_mode`, reading old `dark_mode` values on load; `set_theme` command replaces `set_dark_mode`; `WebviewWindow::set_theme` on the settings window (`None` for match Windows) | title bar follows the app |
| Splash sound on/off *(decision 2)* | `Settings.sound` (default `true`), sent in the reminder payload | mute plip and chime |

### Frontend

- `renderer/theme.css` **(new)** — tokens, `@font-face` rules, the `slap` keyframes.
- `renderer/fonts/` **(new)** — Bricolage Grotesque and Space Mono woff2 files plus `OFL.txt`.
- `renderer/index.html`, `renderer/styles.css` — use `theme.css`; drop the Google Fonts links. No visual change.
- `renderer/settings.html` — rewritten around real controls: radio inputs for intervals and theme, buttons for avatars, checkbox switches, a `<main>` with labelled sections.
- `renderer/settings.css` — rewritten on the shared tokens: sheet, hero sticker, cards, chips, avatar stickers, switches, focus rings, dark theme, reduced motion. Grids that wrap instead of sideways scrollers.
- `renderer/settings.js` — one state object and a `render()`; `status-changed` listener; countdown; inline validation instead of `alert()`; visible rename/remove with an inline confirm; version from `window.__TAURI__.app.getVersion()` (allowed by `core:default`).
- `src-tauri/tauri.conf.json` — settings window 480 × 720, min 420 × 560, title "DrinkUp".

---

## Build order

1. **Shared theme and local fonts.** Add `theme.css` and `fonts/`, point the reminder at them, remove Google Fonts.
   *Done when* the reminder looks identical and the app makes no font requests.
2. **Live status from Rust.** `next_reminder_at`, `get_status`, `status-changed`, refresh on open.
   *Done when* pausing from the tray updates an open settings window within a second.
3. **Theme and sound settings** (if approved), with migration from `dark_mode`.
   *Done when* an existing `settings.json` with `"dark_mode": true` opens dark, and "match windows" follows a Windows theme change.
4. **Settings markup** and the new window size.
5. **Settings styles**, light and dark.
6. **Settings behaviour** in `settings.js`.
7. **Check and document.** Run the checklist, capture before/after screenshots, update the README.

---

## Test checklist

**Sizes**
- [ ] 480 × 720 and 420 × 560: nothing clipped, nothing scrolls sideways, all intervals visible, hero buttons above the fold
- [ ] Display scale 100%, 125%, 150%

**Themes**
- [ ] Light, dark, match windows — flip the Windows setting while settings is open
- [ ] Title bar follows the theme

**States**
- [ ] Counting down, under a minute, reminder on screen
- [ ] Paused from the app and from the tray
- [ ] Custom interval (1, 20, 120; 0 and 121 show an inline error)
- [ ] Dev build shows the 1 min option; release build doesn't

**Avatars**
- [ ] Drippy only; one custom; six or more
- [ ] 30-character name; rename then Esc; remove then keep
- [ ] Upload a non-PNG, a file over 4 MB, an image over 1024 px — each shows an inline error

**Keyboard and motion**
- [ ] Tab reaches every control; arrow keys move within the interval and theme groups; focus always visible
- [ ] Nothing animates with reduced motion on

**Offline**
- [ ] Launch with no network — fonts still render

---

## Decisions for you

1. **Add a "match windows" theme option?** Follows the Windows light/dark setting. *Recommended: yes.*
2. **Add a splash sound toggle?** *Recommended: yes.*
3. **Keep settings open after "remind me now"?** Today it closes the window. *Recommended: yes, so you can tweak and test again.*
4. **Hide the 1-minute option in release builds?** Keep it in dev. *Recommended: yes.*
5. **Bundle the fonts with the app?** Adds the font files to the installer; works offline. *Recommended: yes.*
6. **Custom sticker-style title bar instead of the native Windows frame?** *Recommended: no — keep the native frame and sync its theme.*

## Later, not in this redesign

- Pause for an hour or until tomorrow
- Daily sip count
- Quiet hours
