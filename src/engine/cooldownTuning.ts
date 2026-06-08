// Pure tuning engine for the velocity-wheel duration picker (issue #26). Like the
// timer/cooldown/config engines it owns no clock, no React, no storage — the shell feeds
// in the time gap between wheel notches and these functions decide how big a step each
// notch takes. A deliberate single notch always moves by 1 minute; only *sustained* fast
// spinning ramps the step up, and a pause or a row-switch resets that streak — so one
// stray flick can never overshoot. (See issue #26; the catalog duration it tunes lives in
// engine/config.ts via `setCooldownDuration`.)

const M = 60_000;
const H = 3_600_000;

/**
 * The maximum time between two wheel notches for them to count as "the same fast spin".
 * Notches closer than this build the streak; a longer pause is read as a deliberate stop
 * and resets it. Calibrated by feel — see issue #26 (re-tune during the build).
 */
export const GAP_MS = 160;

/** A tuned duration is held inside [1 minute, 12 hours] — the wheel never escapes this. */
export const MIN_TUNE_MS = 1 * M;
export const MAX_TUNE_MS = 12 * H;

/** Clamp a duration into the tunable [1m, 12h] band (rounded to whole ms). */
export function clampDuration(ms: number): number {
  return Math.max(MIN_TUNE_MS, Math.min(MAX_TUNE_MS, Math.round(ms)));
}

/**
 * The streak after the next notch, given the gap since the previous one and whether it
 * landed on the same picker row. The streak only grows while the spin stays fast *and* on
 * one row; a pause at/over `GAP_MS` or a switch to another row resets it to 0, so a single
 * stray flick can never carry a ramped chunk into a fresh row.
 */
export function nextStreak(prevStreak: number, gapMs: number, sameRow: boolean): number {
  return gapMs < GAP_MS && sameRow ? prevStreak + 1 : 0;
}

/**
 * Round a duration onto the current chunk's grid, so a ramped step lands on a round value
 * (2h27 tuned at the 15m chunk reads 2h30, not 2h27). On the 1m chunk this is the identity
 * to the minute, so a slow precise notch never drifts.
 */
export function snapTo(ms: number, chunk: number): number {
  return Math.round(ms / chunk) * chunk;
}

/**
 * The duration step a single wheel notch takes, given the current run of fast notches.
 * Streak-based so a slow, deliberate notch (streak 0) is always a precise 1 minute, and
 * only sustained spinning ramps the chunk up through 5m / 15m / 30m / 1h.
 */
export function chunkForStreak(streak: number): number {
  if (streak >= 18) return 1 * H;
  if (streak >= 11) return 30 * M;
  if (streak >= 6) return 15 * M;
  if (streak >= 3) return 5 * M;
  return 1 * M;
}

/** The result of one wheel notch: the new tuned duration, plus state for the next notch
 *  and the badge. `streak`/`chunkMs` drive the transient on-screen step-size badge. */
export type Notch = { durationMs: number; streak: number; chunkMs: number };

/**
 * Apply one wheel notch to a row's current duration. The deep entry point the overlay
 * calls per `wheel` event: it advances the streak (from the gap since the last notch and
 * whether this is the same row), picks the chunk that streak earns, steps the duration by
 * `direction` (+1 = scroll up = add, -1 = down = subtract), and snaps the result onto the
 * chunk grid, clamped to [1m, 12h]. The shell stays thin — it only tracks `prevStreak`,
 * the last row id, and the last timestamp, and persists the returned `durationMs`.
 */
export function applyNotch(
  currentMs: number,
  prevStreak: number,
  direction: 1 | -1,
  gapMs: number,
  sameRow: boolean,
): Notch {
  const streak = nextStreak(prevStreak, gapMs, sameRow);
  const chunkMs = chunkForStreak(streak);
  const durationMs = clampDuration(snapTo(currentMs, chunkMs) + direction * chunkMs);
  return { durationMs, streak, chunkMs };
}
