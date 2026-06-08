---
status: accepted
---

# Cooldown alerts are best-effort in-app sound only — no guaranteed fire, no OS toast

## Context

When a Cooldown reaches zero the user may want to be alerted. The strongest version
of that — *guaranteed* firing at an exact future moment hours away, even while the
app is backgrounded or closed — would require OS-scheduled notifications, a Tauri
notification plugin, and a new **capability** in `src-tauri/capabilities/`.
DungeonAid's README makes a headline trust promise: global hotkeys + always-on-top
are the *only* unusual capabilities, no network, **verifiable from source**.

## Decision

The Cooldown alert is **best-effort, in-app sound only**: a "ready" cue fires from
the app-level tick when a cooldown crosses zero *while the app is open*. There is
**no** guaranteed fire-while-closed and **no** OS toast notification. A cooldown
that elapsed while the app was closed simply shows a silent, sticky **`Ready`** on
next launch (no stale chime replayed). The capability surface stays exactly as the
README promises.

## Considered options

- **Guaranteed alert / OS toast.** Rejected for v0.5.0: it adds a third permission
  surface that directly undercuts the "minimal, verifiable capabilities" trust
  story, for marginal gain — fullscreen games routinely suppress OS toasts anyway,
  so the toast often wouldn't show in the exact situation it's wanted.
- **Glance-only, no sound at all.** Rejected: the user is mid-game and can't see
  the overlay; a sound is the one alert that actually reaches them.
- **Best-effort sound only** (chosen). Reaches the user mid-game, costs no new
  capability, fully restart-proof via absolute expiry.

## Consequences

- Reuses the existing bundled-sample audio path; one shared "cooldown ready" cue
  (cooldowns are sparse — per-cooldown sounds would be over-engineering).
- A guaranteed-fire / OS-toast alert remains a possible *later* slice, but it must
  separately justify the new capability against the README's promises and update
  the trust section.
