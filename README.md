# 💧 DrinkUp

**A tiny desktop app that reminds you to drink water — without getting in your way.**

Your animated buddy lives in the system tray, walks across your screen at your chosen interval, drops a nudge, and disappears. No bloat. No subscriptions. Just one `.exe`.

---

## What it does

At whatever interval you set, your buddy strolls in from the corner of your screen, pops up a friendly message, and waits for you to click **Done ✓ I drank** or **skip** — then walks off. That's it.

The overlay is **click-through everywhere except the bubble**, so it never blocks your work, your cursor, or your games.

---

## Features

| | |
|---|---|
| 🎭 | **Your character** — use the built-in mascot or upload any PNG as your own avatar |
| 🌙 | **Dark mode** — toggle live in settings, remembered on restart |
| ⏱️ | **Flexible intervals** — 15 · 30 · 45 min · 1 hr · 90 min |
| 🖱️ | **Non-intrusive** — click-through overlay, never steals focus |
| 🔔 | **Gentle chime** — a soft audio cue when the reminder appears |
| ⏸️ | **Pause / Resume** — snooze all reminders when you need deep focus |
| 🗂️ | **Tray-first** — closing the window keeps it running; only Quit exits |

---

## Settings

Right-click the tray icon → **Open Settings**, or double-click it.

- Pick your reminder interval — saved instantly
- Swap the avatar: upload any PNG, rename or remove it anytime
- Test a reminder before committing to an interval
- Pause reminders when you need uninterrupted focus
- Toggle dark / light mode live

---

## How it works

```
Timer fires
  → Transparent overlay appears at the bottom-right corner of your screen
  → Your buddy walks in with a little animation
  → Speech bubble slides in with a hydration nudge
  → You click Done or Skip
  → Buddy waves and walks back off
  → Timer resets
```

Settings are saved to `%APPDATA%\dev.aaditya.drinkup\settings.json`.

---

## For developers

Built with [Tauri 2](https://tauri.app) — Rust backend, vanilla HTML/CSS/JS frontend. No framework, no Electron.

```bash
# Prerequisites: Rust (stable) + Node.js ≥ 18
npm install
npm run dev     # First run compiles Rust — takes a few minutes, then fast
npm run build   # Produces the NSIS installer
```

**Project structure**

```
drinkup/
├── renderer/          # Frontend — HTML, CSS, JS
│   ├── index.html     # Reminder overlay
│   ├── settings.html  # Settings window
│   └── *.js / *.css
└── src-tauri/
    ├── src/lib.rs     # All app logic (tray, windows, IPC)
    └── tauri.conf.json
```

PRs and issues welcome. Open an issue before starting something large.

> Avatars in this repo are original artwork. User-uploaded avatars stay on your device only.

---

## License

MIT — see [LICENSE](LICENSE).
