# Metin Boss Timers

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

That behaviour profile (global hotkeys + always-on-top + hidden taskbar) is
exactly what antivirus heuristics tend to flag on an unsigned binary, which is
why the trust/verification story below exists.

## Download

Get the latest build from the releases page (no app store, no account):

**→ https://github.com/isaobushi/metin-boss-timers/releases/latest**

Under **Assets**, pick the installer that suits you:

| Asset | Use it if |
|---|---|
| `Metin.Boss.Timers_<version>_x64-setup.exe` (NSIS) | **Most users** — normal double-click install. |
| `Metin.Boss.Timers_<version>_x64_en-US.msi` (WiX) | Silent / IT / scripted install. |
| `SHA256SUMS.txt` | Checksums, to verify your download (see below). |

Asset URLs are version-stamped and change each release, so link to the
`/releases/latest` **page** above rather than a direct file.

### First-launch warnings (and why)

Because the app is **not code-signed yet**, you'll see one or two scary-looking
warnings the first time. They're expected for an unsigned tool — here's how to
get through them:

1. **Browser "uncommon download" / "isn't commonly downloaded"** — choose
   **Keep** (in Chrome/Edge, click the `…` on the download → **Keep**).
2. **Windows SmartScreen "Windows protected your PC" / "unknown publisher"** —
   click **More info → Run anyway**.

The installer then runs normally and adds a Start-menu shortcut. Removing these
warnings entirely requires Authenticode code signing — a possible future step.
Before clicking through, you can confirm the download is the genuine artifact
using the steps below.

## Verify your download

Every release installer is built **only in CI**, on a GitHub-hosted Windows
runner, from the exact tagged public commit — never from a local machine. That
gives a verifiable chain from public source to artifact:

1. **Provenance attestation** (signed SLSA, links artifact → workflow run → commit):
   ```sh
   gh attestation verify <installer-file> --repo isaobushi/metin-boss-timers
   ```
2. **Checksums** — `SHA256SUMS.txt` is attached to each release. Compare:
   ```powershell
   Get-FileHash <installer-file> -Algorithm SHA256
   ```
3. **VirusTotal** — when configured, scan links are included in the release
   notes; otherwise you can upload the installer to
   [virustotal.com](https://www.virustotal.com) yourself.

## Development

```sh
npm install
npm run dev          # Vite dev server for the UI only
npx tauri dev        # full desktop app (overlay + settings windows)
npm run test:run     # unit tests (timer/config/hotkey/persist/position engines)
npm run build        # type-check + bundle the frontend
```

The Windows release is produced by [`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml),
triggered by pushing a `v*` tag whose version matches `src-tauri/tauri.conf.json`:

```sh
git tag v0.1.0
git push origin v0.1.0
```

It bundles the `.msi`/`.exe`, attaches them to a **draft** release with checksums
and a provenance attestation, and (optionally) runs a VirusTotal scan when a
`VT_API_KEY` repository secret is present.
