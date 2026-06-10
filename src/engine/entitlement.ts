// The entitlement gate (PRD #48, issue #53) — the sole, pure owner of "what is allowed in this tier".
// Given an entitlement state and the current `Config` it answers three questions: what are the active
// CAPS, how does the model-C LIVE/FROZEN partition fall, and is a given mutation ALLOWED. Like the
// rest of the engine it owns no clock, no I/O, no Store: the state is a plain enum that a later slice's
// `storeLicense` adapter will supply (here it's dev-settable, `DEV_ENTITLEMENT`).
//
// The load-bearing insight: this module never MUTATES a config — it only computes a VIEW over it. So a
// "thaw" on resubscribe is just re-partitioning the same untouched config with everything live (zero
// data loss, for free), and a `never`-paid user is distinguished from a `lapsed`-over-cap one purely by
// what their config holds (frozen is empty when the config is within caps, populated when it isn't) —
// not by branching on the state. Lapse and trial-end share one code path because they share one cap set.

import type { Config } from "./config";
import { activeCharacter } from "./character";

/** The app's paid state, derived (later) from the OS-cached Store license. Drives every cap + the split. */
export type Entitlement = "subscribed" | "trial" | "lapsed" | "never";

/** Pro = a paying or trialling user: everything uncapped. Lite = `lapsed`/`never`: the caps below apply. */
export const isPro = (e: Entitlement): boolean => e === "subscribed" || e === "trial";

/**
 * The entitlement the app runs as until a real `storeLicense` adapter (a later slice) supplies one from
 * the OS-cached Store license. `subscribed` so every cap is lifted and current behaviour is unchanged —
 * the seam is wired and exercisable, but nothing is gated yet. Dev-settable in `useConfig` for testing.
 */
export const DEV_ENTITLEMENT: Entitlement = "subscribed";

/**
 * The active per-collection limits. `null` = uncapped. `cooldowns` is `null` in BOTH tiers — they're
 * the deliberate zero-maintenance retention hook and never gated (PRD #48). `reminders` is the SHARED
 * Routine+Elapsable pool of the live character.
 */
export type Caps = {
  bosses: number | null;
  prebuiltSequences: number | null;
  cooldowns: number | null;
  reminders: number | null;
  characters: number | null;
};

/** The free-tier floor: 1 custom Boss, 0 prebuilt sequences, uncapped Cooldowns, 3 reminders, 1 character. */
export const LITE_CAPS: Caps = {
  bosses: 1,
  prebuiltSequences: 0,
  cooldowns: null,
  reminders: 3,
  characters: 1,
};

/** Pro lifts every cap. */
export const PRO_CAPS: Caps = {
  bosses: null,
  prebuiltSequences: null,
  cooldowns: null,
  reminders: null,
  characters: null,
};

/** The caps in force for a state: Pro states are uncapped, Lite states (lapse/never) take the floor. */
export const capsFor = (e: Entitlement): Caps => (isPro(e) ? PRO_CAPS : LITE_CAPS);

/**
 * The character that stays live when the rest freeze on lapse — the "most-recently-active": the current
 * active pointer if it still points at a real character, else the first character, else null (no
 * characters at all). The user is never forced through a decision the moment they stop paying.
 */
export const liveCharacterId = (c: Config): string | null => {
  const active = c.characters.find((ch) => ch.id === c.activeCharacterId);
  return (active ?? c.characters[0])?.id ?? null;
};

/** One gated collection split into the ids the user may operate (`live`) and the read-only rest (`frozen`). */
export type Split = { live: string[]; frozen: string[] };

/**
 * The model-C view of a config under a given state. Each gated collection is split live/frozen; under
 * a Pro state every `frozen` is empty (nothing is capped). `reminders` is the LIVE character's shared
 * Routine+Elapsable pool only — a frozen character is wholly read-only via `characters`, so its reminders
 * aren't enumerated here.
 */
export type Partition = {
  bosses: Split;
  characters: Split;
  reminders: Split;
};

/** Split an ordered id list at a cap: the first `cap` stay live, the rest freeze. `null` = all live. */
const splitByCap = (ids: string[], cap: number | null): Split =>
  cap == null ? { live: ids, frozen: [] } : { live: ids.slice(0, cap), frozen: ids.slice(cap) };

/**
 * Characters split unlike bosses/reminders: the live slot(s) are filled by the most-recently-active
 * character FIRST (so lapse keeps the character you were just playing, not merely the first in the
 * array), then by array order up to the cap. The rest freeze in array order. `null` = all live.
 */
const partitionCharacters = (c: Config, cap: number | null): Split => {
  const ids = c.characters.map((ch) => ch.id);
  if (cap == null) return { live: ids, frozen: [] };
  const liveId = liveCharacterId(c);
  const prioritized = liveId == null ? ids : [liveId, ...ids.filter((id) => id !== liveId)];
  return { live: prioritized.slice(0, cap), frozen: prioritized.slice(cap) };
};

/** The recurring (reminder) ids of the character that stays live — the pool the reminder cap applies to. */
const liveCharacterReminders = (c: Config): string[] => {
  const liveId = liveCharacterId(c);
  const live = c.characters.find((ch) => ch.id === liveId);
  return live?.recurring.map((d) => d.id) ?? [];
};

/** Compute the live/frozen partition of `c` under state `e` — a pure VIEW; `c` is never mutated. */
export function partition(e: Entitlement, c: Config): Partition {
  const caps = capsFor(e);
  return {
    bosses: splitByCap(c.bosses.map((b) => b.id), caps.bosses),
    characters: partitionCharacters(c, caps.characters),
    reminders: splitByCap(liveCharacterReminders(c), caps.reminders),
  };
}

// ---- the write-path seam ----
// `allows` is the guard the #47/#48 create/add paths consult BEFORE running their pure transform, so
// caps are enforced at the seam from day one rather than retrofitted. Under a dev `subscribed` state it
// is always true (every cap is null), so wiring it in changes no behaviour until a real adapter feeds a
// Lite state. Cooldowns have no mutation here — they're uncapped by design and never gated.

/** A capped add the seam guards. A new reminder (gate or deadline) lands in the active character's pool. */
export type Mutation = "addBoss" | "addCharacter" | "addReminder";

/** True while a count is still below its cap (`null` = uncapped = always allowed). */
const underCap = (count: number, cap: number | null): boolean => cap == null || count < cap;

/** Whether mutation `m` is permitted under state `e` given the current config — the seam's verdict. */
export function allows(e: Entitlement, c: Config, m: Mutation): boolean {
  const caps = capsFor(e);
  switch (m) {
    case "addBoss":
      return underCap(c.bosses.length, caps.bosses);
    case "addCharacter":
      return underCap(c.characters.length, caps.characters);
    case "addReminder":
      return underCap(activeCharacter(c)?.recurring.length ?? 0, caps.reminders);
  }
}
