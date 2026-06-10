// Pure Recurring engine: a `recurring`-flavoured sibling of Cooldown (ADR-0003), not a
// fourth category. It reuses Cooldown's machinery whole — a single ABSOLUTE wall-clock
// `expiry` (epoch ms), derivations that take `now` and clamp at zero, persisted and
// restored already-past-zero if it elapsed while closed — with exactly ONE axis flipped:
// on completion a recurring item RESTAMPS to a full cycle (`expiry = now + durationMs`,
// rolling from last-done) instead of going one-shot. Like the cooldown/timer engines it
// holds no clock, no React, no storage.
//
// A `kind` flag rides on the definition and is PURE PRESENTATION — it only selects which
// derivations the UI reads, never branching the engine's behaviour:
//   • `gate`     (biologist, daily books) — act at/after zero; `isDue` reads as "ready".
//   • `deadline` (pet, costume, mount)    — act before zero or lose the thing; `isDue`
//                                            reads as "overdue".

/** Which face a recurring item presents (pure presentation; see module header). */
export type RecurringKind = "gate" | "deadline";

/** A recurring definition: the editable catalog entry the user starts from. */
export type RecurringDef = {
  id: string;
  name: string;
  durationMs: number;
  kind: RecurringKind;
};

/** A running recurring item: its absolute `expiry`, plus `startedAt` for progress derivation. */
export type RunningRecurring = {
  defId: string;
  expiry: number;
  startedAt: number;
};

/** Time left until `expiry`, clamped at zero (a recurring item never reads negative). */
export function remainingMs(r: RunningRecurring, now: number): number {
  return Math.max(0, r.expiry - now);
}

/**
 * Whether the item has elapsed — true the instant `now` reaches `expiry`. The valence is
 * the UI's to read from `kind`: a `gate` reads this as "ready" (act now), a `deadline` as
 * "overdue" (you missed it). The engine itself stays valence-free.
 */
export function isDue(r: RunningRecurring, now: number): boolean {
  return now >= r.expiry;
}

/** The default alarm lead time for a `deadline` item: red/blink once under a DAY to elapse. */
export const ALARM_THRESHOLD_MS = 86_400_000;

/**
 * Whether a `deadline` item is in its alarm window — under `threshold` (24h by default) to
 * elapse but NOT yet elapsed. This is the "act now or lose the thing" warning that drives the
 * red/blink; it is the OPEN interval `(0, threshold)`: false at or beyond the threshold (still
 * comfortably far out) and false at/after zero (that's `overdue`, the loss — a distinct state,
 * not an alarm). Purely a `deadline` reading — a `gate` never alarms; the UI calls this only
 * for deadlines, so like every derivation the engine itself stays valence- and kind-free.
 */
export function inAlarm(r: RunningRecurring, now: number, threshold: number = ALARM_THRESHOLD_MS): boolean {
  const rem = remainingMs(r, now);
  return rem > 0 && rem < threshold;
}

/**
 * The deadline analogue of `cooldown.readyCrossings`: the defIds whose item crossed INTO the
 * alarm window between two consecutive observations — in-alarm in `cur` (at `now`), but
 * present-and-not-yet-alarming in `prev` (at `prevNow`). This is what makes the alarm cue
 * *live-only* (ADR-0002 / ADR-0003 §3): it fires only on a crossing the running app watched.
 * An item already in-alarm (or already past zero) on restore has no prior outside observation,
 * so it stays silent; an item sitting in the window was already alarming last tick, so it never
 * re-fires; and the zero crossing (window → overdue) is silent too, since `inAlarm` is false
 * past zero. Running-instance identity is `(defId, expiry)`, so a refresh is a fresh instance
 * that re-arms and can cross afresh. Mirrors `readyCrossings` exactly, swapping the predicate.
 */
export function alarmCrossings(
  prev: RunningRecurring[],
  prevNow: number,
  cur: RunningRecurring[],
  now: number,
  threshold: number = ALARM_THRESHOLD_MS,
): string[] {
  return cur
    .filter((r) => inAlarm(r, now, threshold))
    .filter((r) => prev.some((p) => p.defId === r.defId && p.expiry === r.expiry && !inAlarm(p, prevNow, threshold)))
    .map((r) => r.defId);
}

/**
 * The `gate` analogue of `alarmCrossings` — identical to `cooldown.readyCrossings`, swapping in
 * `isDue` so it watches the ZERO boundary instead of the under-window one: the defIds whose item
 * became due (`isDue` = "ready" for a gate) between two consecutive observations — due in `cur`
 * (at `now`), present-and-not-yet-due in `prev` (at `prevNow`). This is the per-kind cue split: a
 * `deadline` fires on the under-24h alarm crossing (`alarmCrossings`), a `gate` fires here, when
 * the chore rolls back into "do it now". Live-only exactly like its siblings (ADR-0002 /
 * ADR-0003 §3): an item already past zero on restore has no prior not-due observation and stays
 * silent; a sitting-ready item was already due last tick and never re-fires; the `(defId, expiry)`
 * identity means a mark-done is a fresh instance that re-arms and can cross afresh.
 */
export function readyCrossings(
  prev: RunningRecurring[],
  prevNow: number,
  cur: RunningRecurring[],
  now: number,
): string[] {
  return cur
    .filter((r) => isDue(r, now))
    .filter((r) => prev.some((p) => p.defId === r.defId && p.expiry === r.expiry && !isDue(p, prevNow)))
    .map((r) => r.defId);
}

/**
 * The `✓ x/n` routine counter over a set of (gate) definitions: how many are currently "done"
 * (satisfied) versus the total. An item counts as done when it has a running instance that has
 * NOT yet come due again — you completed the chore and it sits on its rolling cooldown until the
 * next window. A `isDue` item reads as "ready" (needs doing → not done); an unstarted def has no
 * instance (never done → not done). `total` is simply the count of defs passed, so the caller
 * hands in the gate defs and reads `done/total`. Kind-free like every derivation: the engine
 * counts over whatever defs it is given; the UI decides those are the gate ones.
 */
export function doneCount(
  running: RunningRecurring[],
  defs: RecurringDef[],
  now: number,
): { done: number; total: number } {
  const done = defs.filter((d) => {
    const r = running.find((x) => x.defId === d.id);
    return r != null && !isDue(r, now);
  }).length;
  return { done, total: defs.length };
}

// ---- running-set operations (pure `(RunningRecurring[], ...) -> RunningRecurring[]`) ----

/** The most recurring items that may run at once; a fresh one beyond this is refused. */
export const MAX_RUNNING = 8;

/**
 * Mark a recurring item done — the single completion gesture for both kinds. It restamps an
 * absolute `expiry = now + def.durationMs` from `now` (rolling-from-last-done: feeding early
 * forfeits the unused time, by design), keeping at most ONE running instance per definition
 * — re-marking a running def re-stamps it in place rather than duplicating. Other running
 * items are untouched. The running set is capped at `MAX_RUNNING`: a fresh def that would
 * overflow the cap is refused (the same array is returned unchanged), while re-stamping an
 * already-running def is always allowed since it replaces rather than grows. This mirrors
 * `cooldown.start`; the one flip is that there is no per-completion duration — a cycle always
 * restamps to the definition's full length.
 */
export function markDone(running: RunningRecurring[], def: RecurringDef, now: number): RunningRecurring[] {
  const without = running.filter((r) => r.defId !== def.id);
  if (without.length >= MAX_RUNNING) return running; // a fresh def beyond the cap is refused
  return [...without, { defId: def.id, expiry: now + def.durationMs, startedAt: now }];
}
