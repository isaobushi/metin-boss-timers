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
  /**
   * Which seeded ladder (if any) this readable climbs — PURE PRESENTATION exactly like `kind`
   * (see the ladder section at the foot of this module). Selects which derivations the UI reads;
   * the engine's running-set behaviour never branches on it. Absent = a plain gate with no rank.
   */
  ladderId?: string;
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

// ---- ladder progression (issue #44) — a presentation LAYER over the gate, not a new axis ----
// A readable has two orthogonal facets: the existing 24h `gate` ("can I read today?", a
// `RunningRecurring` above) and a new ladder RANK ("how far am I?"). The rank advances only on a
// successful read, so it is monotonic lifetime state — kept independent of the daily gate in its
// own `recurringProgress` map (a `position` = the count of *successful* reads, never an estimate of
// the per-read success rate the app cannot know). `ladderId` on a def selects which of the fixed
// seeded structures below it climbs; like `kind` it is pure presentation — the running-set engine
// never branches on it, only the UI's derivations do.
//
// Structures are a hard-coded engine lookup keyed by `ladderId` (not user-editable), shared across
// the thirteen seeded gate defs. Numbers are sourced in the `metin2-readable-presets` memory; the
// per-rung breakdown is exact where the game data pins it (the skill-book M-tier is the triangular
// 1+2+…+10 = 55, transformation steps are 1 apiece) and an even integer spread within the few
// segments the source gives only as a segment total (Leadership's numeric 1–19 and G-tier), where
// "the first few ✓s true it up" — honesty over false precision.

/** One rung on a ladder: its label and the cumulative *successful reads* needed to reach it. */
export type LadderRung = { label: string; entry: number };

/** A fixed seeded ladder structure (keyed by `ladderId`). The last rung is the book-relevant cap. */
export type LadderStructure = {
  id: string;
  /** `rung` → "<rung> · <n>→<next>"; `stage` → "Stage n/N · <item>" (Biologist). */
  style: "rung" | "stage";
  /** Ordered ascending by `entry`; rungs[0] is the floor, the last rung is the cap. */
  rungs: LadderRung[];
  /** `stage`-style per-rung display hint (Biologist's consignment item ×qty), index-aligned to rungs. */
  hints?: string[];
  /** Suffix on the trophy readout, e.g. " (books)" — Skill Books cap at G1 because G→P is Soul Stones. */
  capNote?: string;
};

/** A def's lifetime rank: `position` = its count of successful reads. Parallel to `recurringRunning`. */
export type RecurringProgress = { defId: string; position: number };

/** The derived rung readout for a `position` on a ladder (pure; see `ladderProgress`). */
export type LadderProgress = {
  rungLabel: string;
  /** The next rung's label, or null at the cap. */
  nextRungLabel: string | null;
  /** Successful reads still needed to reach the next rung; 0 at the cap. */
  readsToNextRung: number;
  /** At (or past) the book-relevant cap — the inert/trophy end state. */
  capped: boolean;
};

// Rungs are built from a label list + the per-rung *step cost* (reads to advance to the next rung);
// `entry` is the running sum. `labels.length === steps.length + 1` — the cap rung has no onward step.
function buildRungs(labels: string[], steps: number[]): LadderRung[] {
  let entry = 0;
  return labels.map((label, i) => {
    const rung = { label, entry };
    if (i < steps.length) entry += steps[i];
    return rung;
  });
}

// Spread `total` reads across `n` advancing steps as evenly as possible (integer, remainder
// front-loaded) — used only for the segments the source gives as a lump total, not per-rung.
const spread = (total: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0));

const mTier = Array.from({ length: 10 }, (_, i) => `M${i + 1}`); // M1..M10
const gTier = Array.from({ length: 10 }, (_, i) => `G${i + 1}`); // G1..G10
const triangular10 = Array.from({ length: 10 }, (_, i) => i + 1); // [1..10], sums to 55 (skill-book M-tier)

// Biologist's 10-stage consignment chain (item ×qty per stage; late names carry localization
// aliases — primary shown, alt in the trailing comment). Display-only metadata, no collection counter.
const BIOLOGIST_HINTS = [
  "Orc Tooth ×10",
  "Curse Book ×15",
  "Demon's Keepsake ×15",
  "Ice Marble ×20",
  "Zelkova Branch ×25",
  "Tugyi's Tablet ×30",
  "Red Ghost Tree Branch ×40",
  "Leaders' Notes ×50",
  "Malevolence Jewel ×10",
  "Wisdom Jewel ×20",
];

/** The five fixed seeded ladder structures, keyed by `ladderId` (see module note for sourcing). */
export const LADDERS: Record<string, LadderStructure> = {
  // Skill Books: M1→G1 = 55 reads (triangular). G→P is Soul Stones, not books → cap at G1.
  "class-skill": {
    id: "class-skill",
    style: "rung",
    rungs: buildRungs([...mTier, "G1"], triangular10),
    capNote: " (books)",
  },
  // Transformation pattern (shared by Transformation/Inspiration/Charisma/Mining): 0→M1 = 20, then
  // 1 read per step to P (G11). Total 40 — only the climb to M1 is heavy.
  transformation: {
    id: "transformation",
    style: "rung",
    rungs: buildRungs(["0", ...mTier, ...gTier, "P"], [20, ...Array(20).fill(1)]),
  },
  // Leadership: three Art-of-War books — 1→M1 = 20 (numeric 1–19), M1→G1 = 55 (triangular), G1→P =
  // 155. Total 230. The numeric and G-tier segments are an even spread (source gives only the total).
  leadership: {
    id: "leadership",
    style: "rung",
    rungs: buildRungs(
      [...Array.from({ length: 19 }, (_, i) => String(i + 1)), ...mTier, ...gTier, "P"],
      [...spread(20, 19), ...triangular10, ...spread(155, 10)],
    ),
  },
  // Language books (Jinno/Chunjo/Shinsoo): 20 reads to M1, the ceiling — no M2+/G/P.
  language: {
    id: "language",
    style: "rung",
    rungs: buildRungs(["0", "M1"], [20]),
  },
  // Biologist: 10 sequential stages, one hand-in (can fail) each. Stage shown = position + 1.
  biologist: {
    id: "biologist",
    style: "stage",
    rungs: buildRungs(
      Array.from({ length: 10 }, (_, i) => `Stage ${i + 1}`),
      Array(9).fill(1),
    ),
    hints: BIOLOGIST_HINTS,
  },
};

/** The seeded structure for a `ladderId`, or undefined for a plain (ladder-less) gate. */
export const ladderById = (ladderId: string | undefined): LadderStructure | undefined =>
  ladderId == null ? undefined : LADDERS[ladderId];

/** A ladder's cap — the maximum meaningful `position` (the last rung's entry). */
export const ladderCap = (ladderId: string | undefined): number => {
  const l = ladderById(ladderId);
  return l ? l.rungs[l.rungs.length - 1].entry : 0;
};

/**
 * Derive the rung readout for a `position` on a ladder. Pure: the current rung is the highest whose
 * `entry` is at or below the (clamped, non-negative) position; `capped` is true once the position
 * reaches the last rung's entry, at which point there is no next rung and `readsToNextRung` is 0.
 * Returns null for an unknown/absent `ladderId`.
 */
export function ladderProgress(ladderId: string | undefined, position: number): LadderProgress | null {
  const l = ladderById(ladderId);
  if (!l) return null;
  const pos = Math.max(0, position);
  const capEntry = l.rungs[l.rungs.length - 1].entry;
  const capped = pos >= capEntry;
  // highest rung whose entry <= pos (rungs are ascending; the last is the cap)
  let i = 0;
  for (let k = 0; k < l.rungs.length; k++) if (l.rungs[k].entry <= pos) i = k;
  const next = capped ? null : l.rungs[i + 1];
  return {
    rungLabel: l.rungs[i].label,
    nextRungLabel: next ? next.label : null,
    readsToNextRung: next ? next.entry - pos : 0,
    capped,
  };
}

/**
 * The formatted ladder readout for a `position` (what the Routine row shows beside the gate state).
 * `rung` style reads "M3 · 2→M4", capping to a quiet trophy "G1 ✓ max (books)"; `stage` style (Biologist)
 * reads "Stage 5/10 · Zelkova Branch ×25", capping to "Stage 10/10 ✓". Null for an unknown ladder.
 */
export function ladderText(ladderId: string | undefined, position: number): string | null {
  const l = ladderById(ladderId);
  const p = ladderProgress(ladderId, position);
  if (!l || !p) return null;
  if (l.style === "stage") {
    const total = l.rungs.length;
    const stage = Math.min(total, Math.max(0, position) + 1);
    if (p.capped) return `Stage ${total}/${total} ✓`;
    const hint = l.hints?.[stage - 1];
    return hint ? `Stage ${stage}/${total} · ${hint}` : `Stage ${stage}/${total}`;
  }
  if (p.capped) return `${p.rungLabel} ✓ max${l.capNote ?? ""}`;
  return `${p.rungLabel} · ${p.readsToNextRung}→${p.nextRungLabel}`;
}

// ---- progress-map ops (pure `(RecurringProgress[], ...) -> ...`, parallel to the running-set ops) ----

/** A def's recorded `position` (count of successful reads), or 0 when it has none yet. */
export const positionOf = (progress: RecurringProgress[], defId: string): number =>
  progress.find((p) => p.defId === defId)?.position ?? 0;

/**
 * Upsert a def's `position` in the progress map — clamped to `[0, cap]` for its ladder (a position
 * is never negative, and reading past the book-relevant cap does nothing). Other entries untouched.
 */
export function setPosition(
  progress: RecurringProgress[],
  defId: string,
  position: number,
  ladderId: string | undefined,
): RecurringProgress[] {
  const clamped = Math.max(0, Math.min(position, ladderCap(ladderId)));
  const without = progress.filter((p) => p.defId !== defId);
  return [...without, { defId, position: clamped }];
}

/** Whether a def's ladder has reached its cap — the inert/trophy end state (false for a plain gate). */
export const isCapped = (def: RecurringDef, progress: RecurringProgress[]): boolean =>
  ladderProgress(def.ladderId, positionOf(progress, def.id))?.capped ?? false;

/**
 * The ✓ routine nudge (issue #45): how many gate routines still need doing, of the total — but with
 * capped ladder defs dropped entirely. A maxed ladder is a finished trophy, not an outstanding chore,
 * so it counts toward neither `ready` nor `total` (otherwise the bar would nudge a ladder forever).
 * Over the surviving defs the to-do count is `total - done` (every gate is either done or ready),
 * reusing `doneCount`. Kind-free like its siblings: the caller hands in the gate defs + progress.
 */
export function routineToDo(
  running: RunningRecurring[],
  defs: RecurringDef[],
  progress: RecurringProgress[],
  now: number,
): { ready: number; total: number } {
  const active = defs.filter((d) => !isCapped(d, progress));
  const { done, total } = doneCount(running, active, now);
  return { ready: total - done, total };
}
