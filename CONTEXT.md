# DungeonAid

A desktop overlay (and matching web demo) that times Metin2 boss respawns and
dungeon cooldowns over the running game, driven by global hotkeys. This glossary
fixes the domain language; it is not a spec.

## Language

**Boss**:
A named grouping of **Skills** the overlay tracks together; the overlay shows one
Boss's chips at a time.

**Skill**:
A single relative, repeating countdown belonging to a **Boss** (e.g. a 20s
rotation cue), rendered as a draining chip with audio cues in its final seconds.
_Avoid_: ability, move (those are the in-game things a Skill _times_, not the Skill itself)

**Timer**:
The running countdown state of a **Skill** — relative, cyclic (auto-loops on
reaching zero), and session-only (rebuilt fresh on every launch).

**Cooldown**:
A one-shot countdown to a single future moment — dungeon re-entry availability,
or a mob/boss spawn — that the user starts manually, anchored to an absolute
wall-clock time, and that persists across app sessions until it elapses.
_Avoid_: alarm, reminder, dungeon timer, respawn (respawn names the Boss/Skill side)

**Tag**:
The short, user-editable label that identifies a **Cooldown** in the compact
strip — initials auto-derived from its name (Hydra → "Hyd", Balathor → "Bal").
_Avoid_: icon (there is no image; the Tag is text)

## Relationships

- A **Boss** groups one or more **Skills**
- A **Skill** has exactly one **Timer** (its running state)
- A **Timer** is relative + cyclic + session-only; a **Cooldown** is absolute + one-shot + persistent — they are deliberately distinct categories

## Flagged ambiguities

- "dungeon cooldown" vs "mob spawn" — both resolved as one concept, **Cooldown**: a one-shot wait for a future moment that survives app restarts.
- **Timer** vs **Cooldown** — not the same thing: a Timer loops within a session; a Cooldown counts down once to an absolute deadline and persists.
