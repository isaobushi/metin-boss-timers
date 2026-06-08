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
const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * The live strip readout for a remaining duration. At or above an hour, seconds are
 * noise, so it reads hours+minutes (`2h59`, `1h00`); under an hour it reads `mm:ss`
 * (`59:12`, `0:08`); at or below zero it reads the sticky `Ready`. Seconds are ceil'd
 * so a value of 8.001s still reads `0:08` until the whole second has passed.
 */
export function readout(ms: number): string {
  if (ms <= 0) return "Ready";
  if (ms >= MS_PER_HOUR) {
    const h = Math.floor(ms / MS_PER_HOUR);
    const m = Math.floor((ms % MS_PER_HOUR) / MS_PER_MIN);
    return `${h}h${pad2(m)}`;
  }
  const totalSec = Math.ceil(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${pad2(totalSec % 60)}`;
}

/**
 * The catalog/duration label for a definition: `3h00` / `1h00` for hour-scale waits,
 * `15m` below an hour. Unlike `readout` this never shows seconds or `Ready` — it labels
 * a definition's length, not a live countdown.
 */
export function fmtDur(ms: number): string {
  const h = Math.floor(ms / MS_PER_HOUR);
  const m = Math.round((ms % MS_PER_HOUR) / MS_PER_MIN);
  return h ? `${h}h${pad2(m)}` : `${m}m`;
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
