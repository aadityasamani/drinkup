# 💧 DrinkUp

> **Your tiny desktop hydration buddy.** Drippy walks across your screen, drops a reminder, and disappears — all without stealing your focus.

<br />

Built with [Tauri 2](https://tauri.app) · Rust + vanilla HTML/CSS/JS · MIT License

---

## What is this?

DrinkUp sits quietly in your system tray all day. At whatever interval you choose, **Drippy** — a friendly animated water-drop — strolls in from the right side of your screen, pops up a speech bubble, and waits for you to click **Done ✓ I drank** or **skip**.

No Electron. No 300 MB runtime. No subscriptions. Just a lightweight `.exe` that does one thing really well.

---

## Features

| | |
|---|---|
| 🎭 | **Custom avatars** — upload any PNG and replace Drippy with your own character |
| 🌙 | **Dark mode** — toggle live in settings, remembered on restart |
| ⏱️ | **Flexible intervals** — 15 · 30 · 45 min · 1 hr · 90 min (+ 1 min for testing) |
| 🖱️ | **Click-through overlay** — only the speech bubble captures clicks; nothing blocks your work |
| 🔔 | **Gentle chime** — a soft two-tone audio cue when Drippy arrives |
| ⏸️ | **Pause / Resume** — snooze all reminders when you need deep focus |
| 🗂️ | **Tray-first** — closing the settings window keeps the app alive; only **Quit** exits |

---

## Getting started

### Prerequisites

- [Rust](https://rustup.rs) (stable)
- [Node.js](https://nodejs.org) ≥ 18

### Run in dev mode

```bash
npm install
npm run dev
```

> ⏳ The first run compiles the Rust backend — grab a coffee, it takes a few minutes.
> Every run after that starts in seconds.

On first launch, Drippy says hello after ~6 seconds so you don't have to stare at a blank screen waiting for the timer.

### Build a release installer

```bash
npm run build
```

Output → `src-tauri/target/release/bundle/nsis/DrinkUp_0.1.0_x64-setup.exe`

---

## How it works

```
System tray timer fires
  → Rust positions a transparent, always-on-top overlay window at the bottom-right corner
  → Window becomes visible (opacity guarded by CSS until JS is ready — no flash)
  → Drippy walks in from the right with a bobbing animation
  → Speech bubble slides in beside him after 2 seconds
  → User clicks Done or Skip
  → Drippy hops happily, waves, and walks back off screen
  → Timer resets
```

The overlay is **click-through everywhere except the speech bubble** — so it never blocks your work, your cursor, or your games.

Settings persist to `%APPDATA%\dev.aaditya.drinkup\settings.json`.

---

## Settings

Open from **tray icon → Open Settings** or double-click the tray icon.

- **Status card** — current interval, active/paused state
- **Remind me every** — pick your interval; saved instantly
- **Avatar** — choose Drippy or a custom PNG you've uploaded (rename or delete anytime)
- **Test reminder now** — fires Drippy immediately to preview your setup
- **Pause / Resume** — toggle reminders on/off
- **Dark / Light mode** — live theme switch, persisted across restarts

---

## Project structure

```
drinkup/
├── renderer/               # Frontend — plain HTML, CSS, JS (no framework)
│   ├── index.html          # Reminder overlay window
│   ├── styles.css          # Overlay styles + animations
│   ├── renderer.js         # Overlay logic (walk-in, bubble, chime)
│   ├── settings.html       # Settings window
│   ├── settings.css        # Settings styles (dark mode via CSS custom properties)
│   └── settings.js         # Settings logic (intervals, avatars, theme)
├── src-tauri/
│   ├── src/lib.rs          # All Rust logic — tray, windows, state, IPC commands
│   ├── icons/              # App icon (PNG + ICO)
│   └── tauri.conf.json     # Tauri window + bundle config
├── scripts/
│   ├── make-icon.js        # Generates icon.png from source
│   └── make-ico.js         # Generates icon.ico for Windows
└── package.json
```

---

## Roadmap

- [ ] **macOS + Linux** — Tauri is cross-platform; overlay positioning just needs per-OS testing
- [ ] **Autostart on login** — launch silently with Windows at startup
- [ ] **Quiet hours** — Do Not Disturb schedule (e.g. 10 PM – 8 AM)
- [ ] **More avatar animations** — idle moods, reaction states, exit styles
- [ ] **Hydration goal tracking** — daily sip count, streak

---

## Contributing

Issues and PRs are welcome. If you're planning something big, open an issue first so we can align.

> **Note on avatars:** The repo ships only original artwork. User-uploaded avatars live on your device and are never included in the repo or distributed.

---

## Regenerating the tray icon

```bash
npm run icon
```

---

## License

MIT — see [LICENSE](LICENSE).
