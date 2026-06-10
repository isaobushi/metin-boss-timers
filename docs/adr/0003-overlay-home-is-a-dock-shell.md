---
status: accepted
---

# The overlay home is a dock shell; recurring chores are a sibling of Cooldown, not a fourth category

## Context

DungeonAid times two things today: **Skills** grouped under a **Boss** (relative, cyclic,
session-only timers) and **Cooldowns** (one-shot, absolute-expiry, persistent). The overlay's
home is the boss-select list, which only fronts those two tools.

A Metin2 player also has standing **real-world-clock chores** that drain over hours to days and
must be kept up or re-done on a rhythm: feed a pet every N days, re-project a costume before it
elapses, hand an item to the biologist every ~22h, read daily books. These are net-new to the
overlay (PRD #34). Two questions fall out: **how is this modelled**, and **where does it live** in
an overlay whose identity is "calm and glanceable, not a thing that does many things"?

## Decision

**1. Recurring chores are a `recurring`-flavoured sibling of Cooldown — not a fourth top-level
category, and not two engines.**

They reuse Cooldown's machinery whole: a single **absolute wall-clock `expiry`** (epoch ms),
persisted, restored already-past-zero if it elapsed while closed, ticked by the existing app-level
1-second interval. Exactly **one axis is flipped**: on completion a recurring item **restamps to a
full cycle** (`expiry = now + durationMs`, rolling from last-done) instead of going one-shot.

ADR-0001 split Cooldown out from Skill because the two diverged on **three** axes at once —
timescale (seconds vs hours), loop-vs-one-shot, and relative-vs-absolute time — and set the test:
**split only on multi-axis divergence**. Recurring diverges from Cooldown on a **single** axis
(recurrence: restamp-on-completion), so that same test says **do not split**. It is modelled as one
pure `recurring` engine carrying a `kind: 'gate' | 'deadline'` flag:

- `gate` (biologist, daily books) — you may act *at/after* zero; `isDue` reads as **ready**.
- `deadline` (pet, costume, mount) — you must act *before* zero or lose the thing; `isDue` reads as
  **overdue** and an under-24h `inAlarm` window drives the red/blink.

`kind` is **pure presentation** — it only selects which derivations the UI calls. The engine does
not branch its behaviour on it. `markDone` is the single completion gesture for both kinds.

**2. The overlay home becomes a dock shell (prototype Variant C), replacing boss-select.**

A single dense status line is the overlay's top-level home — **pinned on top at all times** — each
of five segments showing its most-urgent live datum inline so the whole overlay is readable at a
glance:

`⚔ <boss> · ⏱ <nearest cooldown> · 👘 <soonest item> · ✓ <x/n> · ⚙`

Clicking a tool segment toggles that tool's panel open **directly below the bar** (the bar never
goes away; exactly one panel open at a time; re-clicking collapses it). The panels are today's
existing surfaces, reused unchanged:

- **⚔ Skills** opens the draining-chip timer screen / Templum sequence pad below the bar. It is
  "smart": it lands on the active boss's timer screen if one is selected, else the dungeon picker.
- **⏱ Dungeons** opens the cooldown strip below the bar; the bar's ⏱ segment summarises the nearest
  cooldown so the strip need not be pinned above every screen.
- **👘 Items** and **✓ Routine** open the two genuinely-new tools below the bar.
- **⚙ Settings** opens the existing settings window (not a panel).

The signature draining chips and sequence pad are not redesigned — the bar is a persistent launcher
over them. This unifies every tool under one calm line and answers the "it feels like we do many
things" worry without touching any existing play surface.

**3. Alerting stays UI-only — ADR-0002 stands.**

Recurring chores reuse the Cooldown alert posture exactly: a best-effort in-app sound while the app
is open (via the same live-only `readyCrossings` contract), and a silent, sticky `overdue`/`ready`
on next launch. No OS notifications, no scheduler, **no new capability** — the README's two-capability
trust story (global hotkeys + always-on-top, no network, verifiable from source) is preserved.

## Considered options

- **A fourth top-level category for recurring chores.** Rejected: it diverges from Cooldown on only
  one axis, failing ADR-0001's multi-axis test, and would duplicate the absolute-expiry/persistence
  machinery for no model clarity.
- **Two engines (one per `kind`).** Rejected: gate and deadline differ only in which derivations the
  UI reads, not in the underlying restamp/persist behaviour; one engine with a presentation flag is
  the deeper module.
- **Keep boss-select as home and bolt the new tools onto it.** Rejected: it makes the overlay read as
  a pile of separate tools — the opposite of its glanceable identity — which is exactly what the dock
  shell exists to avoid.
- **Guaranteed/OS-notification alerts for the new chores** (where a missed deadline is a permanent
  loss). Rejected here for the same reasons as ADR-0002; remains a possible later slice that must
  separately justify a new capability and update the trust section.

## Consequences

- A new pure `recurring` engine mirrors `cooldown.ts` (clock-injected, no React/storage), and the
  day-scale readout (`2d 06h` / `18h40` / `12:30`, plus a compact badge form) extends the existing
  formatter rather than duplicating it. Both land in later slices (#36+).
- Persistence is **additive**: the `RecurringDef` catalog and running `expiry`s follow ADR-0001's
  lenient pattern — defaulted-empty when absent, **without** bumping `SCHEMA_VERSION` — so old configs
  load unharmed.
- The dock bar replaces `BossSelect` as the home. `BossSelect`, `TimerScreen`, `SequenceScreen` and
  `CooldownStrip` are reused unchanged as panels rendered below the pinned bar; the picker gains a
  "← close" affordance (the bar itself is the persistent way back).
- The cooldown strip is no longer pinned above every screen — it opens as a panel below the bar via
  ⏱. Standalone cooldowns-only mode (#29) is unaffected.
- This decision is delivered across the #34 slice chain; the shell + this ADR are slice #35, with
  👘/✓ as inert placeholders until their engines and accordions land.
