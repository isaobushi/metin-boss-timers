---
status: accepted
---

# Cooldowns are a separate category with absolute-expiry persistence

## Context

DragonsAid's existing countdowns are **Skills** grouped under a **Boss**, whose
running state (a **Timer**) is *relative*, *cyclic* (auto-loops on reaching zero),
*session-only* (rebuilt fresh on every launch), and clamped to `[1s, 999s]`. The
v0.5.0 ask is to track dungeon re-entry locks and mob/boss spawns — waits of
**hours** that the user starts manually and that must **keep counting while the
app is closed** (gaps are long enough that the app is often not even running).

## Decision

Model **Cooldown** as a new top-level category, *not* as new seed-data or a flag
on the Boss/Skill/Timer model. A Cooldown is a one-shot countdown to a single
**absolute wall-clock expiry** (epoch ms), persisted across sessions; remaining
time is derived as `expiry - now` and clamped at zero ("Ready"). It is ticked by a
cheap app-level 1-second interval, never the 60fps rAF skill-timer loop.

## Considered options

- **Extend Boss/Skill/Timer** (raise the duration clamp, add a `loop:false` flag).
  Rejected: the two concepts differ on three axes at once — timescale (seconds vs
  hours), loop-vs-one-shot, and relative-vs-absolute time — and the README's
  identity is "boss respawn timers", which an hours-long re-entry lock is not.
  Overloading "Skill" to mean both would muddy the model and the engine.
- **Cooldown as a separate category** (chosen). Clean separation; the absolute,
  persistent, one-shot semantics live where they belong and don't pollute the
  snappy cyclic skill engine.

## Consequences

- Net-new persistence: today only `Config` (definitions) is serialized — running
  timer state is in-memory only. Cooldowns must persist their **running expiry**,
  added as an **additive** field validated leniently (default empty when absent),
  **without** bumping `SCHEMA_VERSION` — mirroring the existing lenient `soundId`
  migration path so old configs load unharmed.
- A Cooldown surviving a definition edit/delete, and "one running instance per
  definition", are now explicit rules to implement.
