# DragonsAid

*A boss-respawn-timer overlay that works with Metin2.*

A desktop **overlay** of draining boss respawn timers for Metin2. It shows a
small, transparent, always-on-top window of countdown chips that you start and
reset with **global hotkeys** — so the timers keep working while the game has
keyboard focus. A separate settings window lets you pick which bosses/skills to
track and bind hotkeys; your selection and the overlay's on-screen position are
remembered between launches.

Built with [Tauri](https://tauri.app) (Rust core + a React/TypeScript UI).

## Try it in your browser

A live web demo runs the same overlay over a mock game scene — no install:

**→ https://metin-boss-timers.vercel.app**

It's the real UI (pick a boss, draining bars, per-skill hotkeys, audio cues,
draggable panel, inline settings). Two things only the desktop app can do:
hotkeys fire while *another* window is focused, and the window is truly
always-on-top and frameless. In the browser the panel floats over an
illustrative backdrop instead.

## What it does — and does not — do

- **No network calls.** The app never talks to the internet: no telemetry, no
  accounts, no auto-update. There is no HTTP capability compiled into the build,
  so this is verifiable from source (`src-tauri/capabilities/`) — not just a
  promise.
- **Global hotkeys** are the one capability that looks unusual. They exist for a
  single reason: you need to start/reset a timer without alt-tabbing out of a
  full-screen game. They are not a keylogger — only the specific key
  combinations you bind in settings are registered.
- **Always-on-top + hidden taskbar entry** keep the overlay visible over the
  game without cluttering your taskbar.

That behaviour profile (global hotkeys + always-on-top + hidden taskbar) is the
kind of thing antivirus heuristics flag — which is exactly why DragonsAid ships
**only** through the Microsoft Store (Microsoft signs it, so there's no "unknown
publisher" warning) and keeps its **source public** so the claims above are
verifiable, not just promised. See the trust story below.

## Get DragonsAid

DragonsAid is a paid app on the **Microsoft Store**. Distributing through the
Store means Microsoft signs the package — so there's no "unknown publisher" /
SmartScreen warning to click through, and updates arrive automatically.

<!-- STORE LINK: replace this line with the apps.microsoft.com listing once the app is published (#17 / #18). -->
**→ Microsoft Store listing — _link goes live when the app is published._**

Prefer to try before you buy? The [free web demo](https://metin-boss-timers.vercel.app)
runs the same UI in your browser — no install, no account.

## Trust & verification

DragonsAid registers global hotkeys and draws an always-on-top window — behaviour
worth being skeptical about. Two things let you *check* it rather than trust it:

1. **Microsoft-signed.** The Store package is signed by Microsoft during
   certification, so Windows shows a known publisher — no unsigned-binary warning.
2. **Source-available.** This repository stays **public** even though installer
   binaries are no longer published here, so anyone can read exactly what the app
   does. In particular there is **no HTTP capability** in the build
   (`src-tauri/capabilities/`), so the "no network calls" claim is verifiable from
   source — not just a promise. The Store package is built only in CI from a
   tagged public commit and carries a signed SLSA provenance attestation.

## Development

```sh
npm install
npm run dev          # Vite dev server for the UI only
npx tauri dev        # full desktop app (overlay + settings windows)
npm run test:run     # unit tests (timer/config/hotkey/persist/position engines)
npm run build        # type-check + bundle the frontend
```

The Microsoft Store package is produced by [`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml),
triggered by pushing a `v*` tag whose version matches `src-tauri/tauri.conf.json`:

```sh
git tag v0.4.0
git push origin v0.4.0
```

It packs a `.msix` (see [`src-tauri/msix/`](src-tauri/msix/)) with a provenance
attestation and uploads it as a CI artifact for Partner Center submission, where
Microsoft signs it for the Store. It no longer publishes free `.exe`/`.msi`
installers to GitHub Releases — the Store is the sole distribution channel.

## License

Source-available, **not** open-source — see [`LICENSE`](LICENSE). You may read
the code and build it for personal use; redistributing or selling it (or a
rebrand) is not permitted. The official paid build is the Microsoft Store listing.
