// Pure Cooldown engine: the deep module that owns the Cooldown vocabulary and every
// transform over it. Like the timer/config engines it holds no clock, no React, no
// storage — derivations take `now` as an argument and the running-set operations are
// pure `(RunningCooldown[], ...) -> RunningCooldown[]`, which is what keeps the whole
// model unit-testable. A Cooldown is a one-shot countdown to a single ABSOLUTE
// wall-clock `expiry` (epoch ms); remaining time is derived as `expiry - now`, clamped
// at zero ("Ready"), so a cooldown that elapsed while the app was closed restores
// already past zero. (See docs/adr/0001 — cooldowns are a separate category.)

/** A cooldown definition: the editable catalog entry the user starts from. */
export type CooldownDef = {
  id: string;
  name: string;
  /** Short label shown in the compact strip; auto-derived from the name (see `deriveTag`). */
  tag: string;
  durationMs: number;
};

/** A started cooldown: its absolute `expiry`, plus `startedAt` for progress derivation. */
export type RunningCooldown = {
  defId: string;
  expiry: number;
  startedAt: number;
};

/** Time left until `expiry`, clamped at zero (a cooldown never reads negative). */
export function remainingMs(r: RunningCooldown, now: number): number {
  return Math.max(0, r.expiry - now);
}

/** Whether the cooldown has elapsed — true the instant `now` reaches `expiry`. */
export function isReady(r: RunningCooldown, now: number): boolean {
  return now >= r.expiry;
}

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * The live readout for a remaining duration, dropping a finer unit as the scale grows so the
 * value stays glanceable: at or above a DAY it reads days+hours (`2d 06h`, `1d 00h` —
 * recurring chores live here; cooldowns cap at 12h and never reach it); at or above an HOUR
 * it reads hours+minutes (`2h59`, `1h00`); under an hour it reads `mm:ss` (`59:12`, `0:08`);
 * at or below zero it reads the sticky `Ready`. Seconds are ceil'd so a value of 8.001s still
 * reads `0:08` until the whole second has passed; coarser bands floor (the dropped remainder
 * is noise at that range).
 */
export function readout(ms: number): string {
  if (ms <= 0) return "Ready";
  if (ms >= MS_PER_DAY) {
    const d = Math.floor(ms / MS_PER_DAY);
    const h = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
    return `${d}d ${pad2(h)}h`;
  }
  if (ms >= MS_PER_HOUR) {
    const h = Math.floor(ms / MS_PER_HOUR);
    const m = Math.floor((ms % MS_PER_HOUR) / MS_PER_MIN);
    return `${h}h${pad2(m)}`;
  }
  const totalSec = Math.ceil(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${pad2(totalSec % 60)}`;
}

/**
 * The catalog/duration label for a definition: `2d 06h` for day-scale recurring chores
 * (a 7-day pet, a 30-day costume), `3h00` / `1h00` for hour-scale waits, `15m` below an
 * hour. Unlike `readout` this never shows seconds or `Ready` — it labels a definition's
 * length, not a live countdown.
 */
export function fmtDur(ms: number): string {
  if (ms >= MS_PER_DAY) {
    const d = Math.floor(ms / MS_PER_DAY);
    const h = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
    return `${d}d ${pad2(h)}h`;
  }
  const h = Math.floor(ms / MS_PER_HOUR);
  const m = Math.round((ms % MS_PER_HOUR) / MS_PER_MIN);
  return h ? `${h}h${pad2(m)}` : `${m}m`;
}

/**
 * The compact single-unit badge for a dense bar segment: only the largest non-zero unit,
 * unpadded (`2d` / `5h` / `12m`), so a recurring item's most-urgent datum reads inline
 * without crowding the dock. A finished/ready item collapses to a tick (`✓`). This is the
 * terse sibling of `readout`; the readout's day/hour/minute bands here drop to one unit.
 */
export function badge(ms: number): string {
  if (ms <= 0) return "✓";
  if (ms >= MS_PER_DAY) return `${Math.floor(ms / MS_PER_DAY)}d`;
  if (ms >= MS_PER_HOUR) return `${Math.floor(ms / MS_PER_HOUR)}h`;
  return `${Math.floor(ms / MS_PER_MIN)}m`;
}

/**
 * Auto-derive a Tag from a Cooldown's name: the first three letters, title-cased
 * (`Hydra` → `Hyd`, `balathor` → `Bal`). Non-letters are ignored so spacing/punctuation
 * never leak into the short label. The Tag stays user-editable; this is just the seed.
 */
export function deriveTag(name: string): string {
  const head = name.replace(/[^a-zA-Z]/g, "").slice(0, 3);
  return head ? head[0].toUpperCase() + head.slice(1).toLowerCase() : "";
}

// ---- running-set operations (pure `(RunningCooldown[], ...) -> RunningCooldown[]`) ----

/** The most cooldowns that may run at once; a fresh start beyond this is refused. */
export const MAX_RUNNING = 8;

/**
 * Start (or re-stamp) a cooldown for `def`, stamping an absolute `expiry = now +
 * durationMs` (defaulting to the definition's own duration). There is at most ONE
 * running instance per definition: starting an already-running def re-stamps it in
 * place rather than duplicating. Other running cooldowns are untouched.
 *
 * The running set is capped at `MAX_RUNNING`: a fresh def that would overflow the cap
 * is refused (the same array is returned unchanged). Re-stamping a def that is already
 * running is always allowed — it replaces rather than grows, so it can't breach the cap.
 */
export function start(
  running: RunningCooldown[],
  def: CooldownDef,
  now: number,
  durationMs: number = def.durationMs,
): RunningCooldown[] {
  const without = running.filter((r) => r.defId !== def.id);
  if (without.length >= MAX_RUNNING) return running; // a fresh def beyond the cap is refused
  return [...without, { defId: def.id, expiry: now + durationMs, startedAt: now }];
}

/**
 * Re-stamp a running cooldown back to the definition's full duration (the click-a-pill
 * gesture). Equivalent to `start` at the default duration — running pills always reset
 * to the catalog length, never to any per-start tuned value.
 */
export function restart(running: RunningCooldown[], def: CooldownDef, now: number): RunningCooldown[] {
  return start(running, def, now);
}

/** Stop and remove the cooldown for a definition; a no-op if it isn't running. */
export function clear(running: RunningCooldown[], defId: string): RunningCooldown[] {
  return running.filter((r) => r.defId !== defId);
}

/**
 * The defIds whose cooldown crossed zero between two consecutive observations of the
 * running set: ready in `cur` (at `now`), but present-and-not-ready in `prev` (at
 * `prevNow`). This is what makes the ready cue *live-only* (ADR-0002) — it fires only on
 * a crossing the running app actually watched. A cooldown already past zero on restore
 * has no prior not-ready observation, so it stays silent; a pill sitting at sticky
 * `Ready` was already ready last tick, so it never re-fires. Running-instance identity is
 * `(defId, expiry)`, so a restart is a fresh instance that re-arms and can cross afresh.
 */
export function readyCrossings(
  prev: RunningCooldown[],
  prevNow: number,
  cur: RunningCooldown[],
  now: number,
): string[] {
  return cur
    .filter((r) => isReady(r, now))
    .filter((r) => prev.some((p) => p.defId === r.defId && p.expiry === r.expiry && !isReady(p, prevNow)))
    .map((r) => r.defId);
}
