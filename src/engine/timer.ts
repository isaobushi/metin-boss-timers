// Pure timer engine. Slice 1 was a single free-running anchored countdown; Slice 2
// grows it into a full control model (start/stop/reset/trigger) over a set of timers
// that emits cue events the app renders as audio. It still owns neither the clock nor
// the render loop — every function takes the wall-clock time `now`, which is what makes
// the whole engine testable with an injected fake clock.

/** Audio cues emitted as a running timer crosses the final seconds and the 0 boundary. */
export type Cue = "tick3" | "tick2" | "tick1" | "hit";

export type Timer = {
  id: string;
  label: string;
  /** Length of one countdown cycle, in milliseconds. */
  durationMs: number;
  /** Which bundled sample the audio adapter plays for this timer's cues; opaque here. */
  soundId: string;
  running: boolean;
  /** Wall-clock time (ms) the current cycle ends — valid only while running. */
  endsAt: number | null;
  /** Frozen remaining time (ms), held while stopped. */
  remainingMs: number;
  /** Last whole-second value observed, so each cue fires once per boundary crossing. */
  lastSec: number;
};

export type TimerInit = { id: string; label: string; durationMs: number; soundId: string };

/** A fresh, stopped timer sitting at a full cycle. */
export function makeTimer(init: TimerInit): Timer {
  return {
    ...init,
    running: false,
    endsAt: null,
    remainingMs: init.durationMs,
    lastSec: Math.ceil(init.durationMs / 1000),
  };
}

/**
 * Milliseconds remaining at wall-clock time `now`, always in `(0, durationMs]`.
 *
 * Stopped → the frozen `remainingMs`. Running → derived from `endsAt`, and if `now`
 * has overshot the cycle end (a dropped/late frame skipped past 0, possibly across
 * whole cycles) the modulo wraps it back to the correct point in the current cycle.
 * The result depends only on `now`, never on how many frames fired.
 */
export function remainingMsAt(timer: Timer, now: number): number {
  if (!timer.running || timer.endsAt == null) return timer.remainingMs;
  const rem = timer.endsAt - now;
  if (rem > 0) return rem;
  const m = rem % timer.durationMs; // in (-durationMs, 0]
  return m === 0 ? timer.durationMs : m + timer.durationMs;
}

/** Remaining fraction of the current cycle at `now`, in `(0, 1]` (1 = full). */
export function progressAt(timer: Timer, now: number): number {
  return remainingMsAt(timer, now) / timer.durationMs;
}

/** Start from the frozen remaining time, anchoring the cycle end to `now`. */
export function start(timer: Timer, now: number): Timer {
  return {
    ...timer,
    running: true,
    endsAt: now + timer.remainingMs,
    lastSec: Math.ceil(timer.remainingMs / 1000),
  };
}

/** Stop, freezing whatever time currently remains. */
export function stop(timer: Timer, now: number): Timer {
  return { ...timer, running: false, endsAt: null, remainingMs: remainingMsAt(timer, now) };
}

/** Start if stopped, stop if running. */
export function toggle(timer: Timer, now: number): Timer {
  return timer.running ? stop(timer, now) : start(timer, now);
}

/** Snap back to a full cycle. If running, re-anchor so it keeps running cleanly. */
export function reset(timer: Timer, now: number): Timer {
  const base = { ...timer, remainingMs: timer.durationMs, lastSec: Math.ceil(timer.durationMs / 1000) };
  return timer.running ? { ...base, endsAt: now + timer.durationMs } : base;
}

/** Reset *and* start, from any state — the hotkey action (fires the skill on demand). */
export function trigger(timer: Timer, now: number): Timer {
  return {
    ...timer,
    running: true,
    remainingMs: timer.durationMs,
    endsAt: now + timer.durationMs,
    lastSec: Math.ceil(timer.durationMs / 1000),
  };
}

/**
 * Advance a running timer to `now`, returning the updated timer and any cues that fired
 * since the last tick. Crossing into 3/2/1 seconds emits `tick3`/`tick2`/`tick1`; reaching
 * 0 emits a single `hit` and auto-loops to a fresh full cycle (skipping whole cycles a
 * lagged frame jumped over). A stopped timer is inert. Pure: no clock, no audio.
 */
export function tick(timer: Timer, now: number): { timer: Timer; cues: Cue[] } {
  if (!timer.running || timer.endsAt == null) return { timer, cues: [] };

  const cues: Cue[] = [];
  let endsAt = timer.endsAt;
  let lastSec = timer.lastSec;

  if (now >= endsAt) {
    cues.push("hit");
    while (endsAt <= now) endsAt += timer.durationMs; // skip cycles a lagged frame jumped
    lastSec = Math.ceil((endsAt - now) / 1000);
  } else {
    const s = Math.ceil((endsAt - now) / 1000);
    if (s !== lastSec) {
      lastSec = s;
      if (s === 3) cues.push("tick3");
      else if (s === 2) cues.push("tick2");
      else if (s === 1) cues.push("tick1");
    }
  }

  const changed = endsAt !== timer.endsAt || lastSec !== timer.lastSec;
  return { timer: changed ? { ...timer, endsAt, lastSec } : timer, cues };
}
