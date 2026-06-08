# Prototype — Cooldown strip (THROWAWAY)

**Question:** What should the Cooldown strip look like, and how does it stay
*subordinate* to the boss-skill chips while still being glanceable?

**Run:** dev server (`npm run dev`), open
`http://localhost:5173/?proto=cooldowns` — flip variants with the bottom bar or ← →.
Each variant is the same live data over the real `DemoScene` + a mock boss panel,
so density is honest. Left-click a cooldown = restart, right-click = clear, `+` =
start from catalog. One seeded cooldown races to zero in ~8s (fires the ready
beep + flips to sticky **Ready**); one is already Ready (silent — elapsed before
the app was "open"); one shows the `2h59` ≥1h format; one ticks in `59:12` mm:ss.

## Variants

- **A — Whisper row.** Text-only pills in the overlay column above the boss panel.
  No bars, low opacity, smallest footprint. Most subordinate; Ready is the only
  thing that lights up.
- **B — Mini-chips.** A 4-col grid echoing the boss chip, each with a hairline
  urgency micro-bar (reuses `urgencyColor`). Most informative, heaviest — tests
  whether a progress bar reads at 3h scale or is just noise.
- **C — Status rail.** A detached full-width ticker pinned to the top *screen*
  edge, monospace `TAG 2h59` segments. Cooldowns as ambient HUD, physically
  separated from the boss overlay.

## VERDICT

**Winner: A — Whisper row.** Text-only pills, maximally subordinate to the boss
chips; only `Ready` lights up. Picked over B (micro-bar adds weight without
reading at 3h scale) and C (screen-pinned rail too separate / HUD-heavy).

Two requirements surfaced *from* the prototype and folded into Variant A:

1. **Standalone "cooldowns-only" mode.** The strip must render *without* the boss
   panel, for users who only want floating dungeon cooldowns. Demoed by the
   `panel: on / cooldowns only` toggle in the bottom bar. Real impl: a mode where
   the overlay shows just the cooldown strip (no boss timer screen).
2. **Velocity-sensitive wheel adjust — on the selection panel only.** Open the `+`
   picker and scroll a row to tune that cooldown's duration *before* starting it;
   the faster consecutive notches arrive, the bigger the chunk — slow = 1m, fast =
   5m/15m/30m, blur-fast = 1h (`wheelChunkMs`). A transient yellow badge shows the
   active step; the row's duration label updates live. Click the row to start at the
   tuned duration. This is the knob for "examples not gospel": seed Meley 3h → flick
   to your server's 2h30 in two spins. Scroll up = add, down = subtract; clamped
   [1m, 12h]. **Resolved:** wheel tunes the *catalog duration at selection time*, NOT
   a running cell — running pills stay click-restart / right-click-clear only.

### Wheel tuning model (refined)

Streak-based, not single-gap-based: a deliberate single notch is **always 1m**
(precise); the chunk only ramps while you *keep* spinning fast — streak ≥3 → 5m,
≥6 → 15m, ≥11 → 30m, ≥18 → 1h (`chunkForStreak`). A pause (gap > 160ms) or
switching rows resets the streak, so one stray fast flick can't overshoot to 1h.
Tuned durations **snap to the active chunk's grid** (`snapTo`) so big steps land
on clean values (2h30, not 2h27). Thresholds are still first-guess — re-calibrate
by feel before folding in.

### Edge-aware placement (build requirement)

The real overlay is **freely draggable** (`useOverlayPosition`), not pinned. So the
strip can't assume a fixed left/right anchor — it must infer placement from where
the panel currently sits and behave accordingly:
- The `+` **picker dropdown must be edge-aware**: open inward **horizontally** (from
  the right edge when the panel is near the right of the screen, else the left) AND
  **vertically** (it opens downward today; near the bottom edge it must flip upward
  or it overflows off-screen).
- Pill **wrap direction** should follow the same left/right inference (minor — the
  strip is only ~316px wide, but it keeps the strip visually attached to the panel).
The prototype's `anchor: left/right` toggle only *demonstrates* the two end states;
the real impl derives the anchor from the live overlay position.

Still TODO before folding in: hours/minutes duration control in settings, the
catalog editor, persistence of running expiries (absolute epoch ms, additive —
no SCHEMA_VERSION bump, mirror the lenient soundId path).

## Cleanup

When a winner is picked: delete this file, delete `_cooldownStripProto.tsx`, and
remove the `?proto=cooldowns` gate + import in `src/main.tsx`. Fold the winning
treatment into the real overlay (rewritten properly — this was built under
prototype constraints: no tests, inline styles, mock data).
