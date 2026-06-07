# Prototype / demo — Metin2 boss timer overlay

A browser prototype (Vite + React) for a planned **Tauri desktop overlay** that times Metin2
boss skill cycles. Now polished into a **shareable web demo**.

- **Live demo:** https://metin-boss-timers.vercel.app (Vercel, personal scope `andreagoys-projects`)
- Run locally: `npm run dev` → http://localhost:5173/
- Typecheck: `npx tsc --noEmit` · Build: `npm run build`

Everything in `src/proto/` is throwaway prototype code (inline-style soup on purpose). When this
folds into the real Tauri app, **rewrite properly** — see "Promoting to Tauri" at the bottom.

## What it does (locked behaviour)
Pick-boss-first flow, one screen at a time:
1. **SELECT BOSS** screen — choose a boss; each boss has a ⚙ gear → per-boss settings.
2. **TIMER** screen — that boss's skills as **draining chips** (the winning visual, see Verdict).

Timer engine (`useBossTimers.ts`), all wall-clock anchored:
- Per-timer countdown; **beeps at 3 / 2 / 1 and a louder hit at 0**, then auto-loops.
- `toggle` (start/stop), `reset` (snap to full; re-syncs if running), `trigger` (reset **and**
  start — used by hotkeys, fires from any state).
- Switching boss stops + resets every timer (only the active boss runs).

### Fully user-configurable
- **Bosses**: add / rename / delete; accent colors cycled from a palette; `FALLBACK_BOSS` keeps
  `eng.boss` defined even if all are deleted.
- **Skills (per boss)**: add / rename / set duration / remove; each auto-assigned a distinct beep
  pitch from `PITCHES`. Generic default labels ("Skill 1", "Skill 2").
- **Hotkeys (per skill)**: bind a key or modifier combo (click the key button, press combo;
  Esc clears). Stored normalized (`"k"`, `"ctrl+shift+k"`, `"alt+space"`), shown pretty. Helpers
  `comboFromEvent` / `keyLabel` live in `CommandDeck.tsx`. The global listener is mounted **only on
  the timer screen** (so only the active boss's keys fire) and ignores keystrokes while an
  INPUT/TEXTAREA is focused.
- **Persistence**: bosses + skills + durations + hotkeys are saved to `localStorage`
  (`metin-boss-timers:v1`) and restored on load. Seq counters (`idSeq`/`bossSeq`) are seeded past
  any persisted ids via `maxSeq` so regenerated ids never collide after reload. `resetConfig()`
  wipes everything back to shipped defaults.

### Audio (`audio.ts`)
A **kick-drum sample** (`src/assets/kick-drum-timer.wav`, imported so Vite bundles+hashes it),
pitch-shifted per timer via `playbackRate = freq / 660`. Final (0s) hit louder than the 3-2-1
ticks. Decoded once on first gesture (`unlockAudio`, hooked in `App.tsx`). **Synth beep retained as
fallback** until decode completes / if load fails.
> The pitch spread is subjective — may sound too boomy low / clicky high. Easy to narrow the ratio
> or pin the final hit to a fixed beefier rate.

### Demo shell (`App.tsx`)
- **Faux game scene** behind the overlay (pure CSS/SVG — depth gradients, torch/magic glows,
  drifting fog, perspective ground grid, rising embers, a red-eyed boss silhouette, and a faux HUD:
  boss health bar, HP/MP orbs, player bars, 8-slot hotbar). **No copyrighted art ships**; carries an
  "illustrative mock, not affiliated with Metin2" line.
- **Intro/help overlay** — first-visit modal (remembered via `metin-boss-timers:seen-intro:v1`)
  explaining the interaction model + the browser-reserved-combo caveat + audio-after-first-click.
  A floating **?** button reopens it; includes a "Reset demo data" link → `resetConfig()`.

## Files
- `useBossTimers.ts` — engine: state, rAF loop, config edits, persistence.
- `variants/CommandDeck.tsx` — the winning UI (chips, boss-select, settings panel, hotkey capture).
- `audio.ts` — kick-drum + synth-fallback beeps.
- `colors.ts` — `urgencyColor(progress)` ramp for the chip fill.
- `App.tsx` (outside proto) — demo host: game scene + intro overlay.

## ⚠️ GOTCHA — animate fills with `transform`, never `width`
Animating the draining fill with `width` (even with a CSS transition) did **not** repaint
frame-to-frame in real Chrome while a rAF loop drove it — the number/color updated but the bar
looked frozen at full, then snapped correct on the next click (which forces a sync flush). Headless
Chrome **hid** the bug because taking a screenshot forces a repaint.
**Fix:** GPU-composited `transform: scaleX()` (+ `translateX` for the leading-edge glow), no CSS
transition — rAF drives each frame. `CHIP_W = 268` is a hard constant tied to the 270px chip width
so the `translateX` math stays exact; if chips ever flex to panel width, that constant must become
*measured*. **Use transforms, never `width`, for timer fills.**

## VERDICT (UI exploration — resolved)
Three variants were prototyped: A (horizontal rings), B (vertical slim bars), C (draining chips).
**Winner: C — Draining Chips** (compact bar, transform-driven draining fill, urgency color ramp).
A and B were dropped; the variant switcher is gone. Chip interaction: **left-click = start/stop,
right-click = reset**, running state shown purely visually (stopped chips dim).

## Promoting to Tauri (not started / not approved)
Clean rewrite (no inline-style soup), then: frameless **always-on-top** overlay, **real global
hotkeys** (Tauri — the web demo's browser-reserved-combo limitation goes away), separate settings
window, persistence (already prototyped via localStorage — port to a real store), and a GitHub
Actions Windows `.msi`/`.exe` build (this dev machine is macOS).

## Accounts (for deploy / repo)
Use the **personal** accounts, not the Good On You (work) ones:
- Vercel: `--scope andreagoys-projects` (never the `goy` org).
- GitHub `gh`: active account `isaobushi` (`gh auth switch --hostname github.com --user isaobushi`).
- Global git identity is still the work one; if a git repo is ever initialized, set a personal
  name/email repo-locally first.
