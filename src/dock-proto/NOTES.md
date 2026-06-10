# Prototype — tool-dock UI exploration (#dock)

**Question:** how should a dock of tool-icons (dungeon skills, dungeon cooldowns,
elapsable items, routine checklist, settings) look + behave so the overlay stays
glanceable and doesn't feel like it "does many things"?

Run: `npm run dev` → http://localhost:5173/?variant=A#dock · cycle with ‹ › or ← →.
Throwaway: everything in `src/dock-proto/` + the `#dock` branch in `main.tsx`. Delete on fold-in.

## Variants tried
- **A — Whisper dock:** one tiny pill-bar of 5 collapsed icons; hover → floating popover. Smallest idle footprint, but hides every live number behind a hover.
- **B — Two-tier:** persistent dungeon play-panel + a thin side-rail of chore badges with drawers. Splits by rhythm (watch-constantly vs glance).
- **C — Status line:** one dense bar showing each tool's most-urgent datum INLINE (`Hyd 12:30`, `👘 5h12 ⚠`, `✓ 1/4`); click a segment → inline accordion.

## VERDICT — **C wins** (2026-06-10)
Picked for being **always-glanceable without hover** — the live datum is on the bar,
which is exactly what an at-a-glance mid-game overlay wants, and it answers the user's
"it feels like we're doing many things" worry by unifying every tool into one calm line.

Key pieces validated in the mock:
- **Routine `x/n` counter** with per-chore `done / ready / in 3h` (the "checked 3h before reading" idea).
- **Elapsable alarm mode** — item datum turns red + blinks under 24h to elapse, inline on the bar.

## Resolved scope (2026-06-10)
**C is the overlay's top-level home shell — it replaces the boss-select home screen.**
- The bar has 5 segments, each showing a live glanceable datum:
  `⚔ Templum P2 · ⏱ Hyd 12:30 · 👘 5h12⚠ · ✓ 1/4 · ⚙`.
- Clicking **⚔ Skills** or **⏱ Dungeons** opens TODAY's surfaces UNCHANGED (sequence pad,
  draining-chip timer screen, cooldown strip) — the bar just routes to them. The signature
  draining chips are NOT redesigned.
- Clicking **👘 Items** or **✓ Routine** opens a NEW inline accordion — the two genuinely-new tools.

## The two new tools (the only net-new model)
Both rolling/wall-clock/persistent, modelled like `Cooldown` (absolute expiry, survives restart,
auto-restamp on completion). **No new OS capability — UI-only alerting, no notifications** (earlier decision).
- **Routine** (gate-type: biologist, daily books): `x/n` done counter; each item reads `done / ready / in 3h`
  (executable-countdown). Marking done restamps the rolling timer.
- **Elapsable items** (deadline-type: pet, costume): countdown to elapse; the bar datum turns red + blinks
  in **alarm mode under 24h**. "Projecting" a costume onto a new one = restamp to full.

## Next step
Not yet built. Fold-in = promote C's bar into the real overlay shell (clean rewrite, not the proto soup),
keep existing panels as route targets, build the two new persisted tools. Likely a numbered slice / issue.
