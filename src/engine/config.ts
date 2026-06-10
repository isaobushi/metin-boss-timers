// Pure user-config model: the set of bosses and, per boss, the skills the overlay
// times. Like the timer engine this owns no clock, no React, no storage — every
// operation is a pure `(Config, ...) -> Config` transform, which is what makes the
// whole model unit-testable. Id sequencing lives here too (the persistence slice will
// later seed the counters past any restored ids so regenerated ids never collide).

import type { TimerInit } from "./timer";
import { DEFAULT_SOUND_ID, SOUND_IDS, type SoundId } from "./sounds";
import { type CooldownDef, type RunningCooldown, clear, deriveTag, restart, start } from "./cooldown";
import { type RecurringDef, type RecurringKind, type RunningRecurring, markDone } from "./recurring";
import { clampDuration } from "./cooldownTuning";

// A skill is everything the timer engine needs to make a timer (`TimerInit` =
// { id; label; durationMs; soundId }) plus an optional global-hotkey binding. It stays a
// superset of `TimerInit`, so a boss's `skills` feed straight into `useTimers` with no
// mapping (the engine just ignores `hotkey`). The hotkey is a canonical combo string
// (see engine/hotkey.ts); absent means unbound.
export type SkillCfg = TimerInit & { hotkey?: string };

export type Boss = {
  id: string;
  name: string;
  /** Primary accent colour; cycled from `ACCENTS` so bosses read distinctly. */
  accent: string;
  /** Secondary accent, for gradients. */
  accent2: string;
  skills: SkillCfg[];
};

export type Config = {
  bosses: Boss[];
  /** The editable catalog of cooldown definitions the user starts from. */
  cooldowns: CooldownDef[];
  /** The currently-running cooldowns (absolute expiries); persisted across sessions. */
  running: RunningCooldown[];
  /** The editable catalog of recurring-chore definitions (elapsable items + routine). */
  recurring: RecurringDef[];
  /** The currently-running recurring items (absolute expiries); persisted across sessions. */
  recurringRunning: RunningRecurring[];
  /** Monotonic counters owned here so ids never collide (even after deletes). */
  bossSeq: number;
  skillSeq: number;
  cooldownSeq: number;
  recurringSeq: number;
};

// Accent pairs cycled as bosses are added, so each boss reads distinctly. The first is the
// violet the overlay lands on by default (the shipped "Balathor" boss).
export const ACCENTS: ReadonlyArray<readonly [string, string]> = [
  ["#7c6cff", "#6a5bff"],
  ["#ff2d6b", "#ff8a3d"],
  ["#00e5ff", "#8a5bff"],
  ["#39ff88", "#00e5ff"],
  ["#ffd166", "#ff5d8f"],
  ["#b388ff", "#5d9bff"],
  ["#ff7b3d", "#ffd166"],
];

// The shipped first boss's name (the overlay's default landing boss).
const DEFAULT_BOSS_NAME = "Balathor";

// Re-seeded when the last boss is deleted, so the overlay is never empty/broken. Kept the
// generic "Boss" (distinct from the shipped DEFAULT_BOSS_NAME) since it's an emergency seed.
export const FALLBACK_BOSS = { name: "Boss", accent: "#7c6cff", accent2: "#7c6cff" } as const;

const DEFAULT_DURATION_MS = 20_000;
const MIN_DURATION_MS = 1_000;
const MAX_DURATION_MS = 999_000;

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

// The length a freshly-added catalog entry starts at — one hour, mid-band in the tunable
// [1m, 12h] range, so the user nudges it down or up with the h/m control either way.
const DEFAULT_COOLDOWN_MS = 1 * MS_PER_HOUR;

// The example dungeons a fresh install ships with. Durations are "examples not gospel" —
// the user retunes them per server (the catalog editor is a later slice). Tags are
// auto-derived from the names so the seed and any user-added cooldown stay consistent.
const COOLDOWN_SEED: ReadonlyArray<{ name: string; durationMs: number }> = [
  { name: "Hydra", durationMs: 15 * MS_PER_MIN },
  { name: "Razador", durationMs: 1 * MS_PER_HOUR },
  { name: "Nemere", durationMs: 4 * MS_PER_HOUR },
  { name: "Meley", durationMs: 3 * MS_PER_HOUR },
  { name: "Balathor", durationMs: 3 * MS_PER_HOUR },
  { name: "Northwind War Chief", durationMs: 1 * MS_PER_HOUR },
];

// The example recurring items a fresh install ships with. Like the cooldown seed these are
// "examples not gospel": the user retunes durations and adds their own in settings. Two flavours
// ship so each dock tool reads non-empty: the standing `deadline` elapsables (pet, costume, mount
// — you lose the thing if it elapses, 👘 Items) first, then the `gate` routines (a chore that
// rolls back into "do it now" each cycle — biologist hand-in, daily book reading, ✓ Routine).
const RECURRING_SEED: ReadonlyArray<{ name: string; durationMs: number; kind: RecurringKind }> = [
  { name: "Snow Wolf", durationMs: 3 * MS_PER_DAY, kind: "deadline" }, // pet
  { name: "Costume of Flame", durationMs: 14 * MS_PER_DAY, kind: "deadline" }, // costume
  { name: "Battle Horse", durationMs: 18 * MS_PER_HOUR, kind: "deadline" }, // mount
  { name: "Biologist", durationMs: 22 * MS_PER_HOUR, kind: "gate" }, // hand-in cooldown
  { name: "Daily Books", durationMs: 24 * MS_PER_HOUR, kind: "gate" }, // daily reading
];

/** Accent pair for the n-th boss (0-based), wrapping the palette. */
const accentAt = (n: number): readonly [string, string] => ACCENTS[n % ACCENTS.length];

/**
 * The next distinct sound for a boss: the first sound not already in use by its skills;
 * once the set is exhausted, cycle by skill count so a fresh boss's skills stay audibly
 * distinct without configuration. (Mirrors the old `nextPitch` logic.)
 */
const nextSound = (skills: SkillCfg[]): SoundId => {
  const used = new Set(skills.map((s) => s.soundId));
  return SOUND_IDS.find((s) => !used.has(s)) ?? SOUND_IDS[skills.length % SOUND_IDS.length];
};

const makeSkill = (seq: number, label: string, soundId: SoundId): SkillCfg => ({
  id: `skill-${seq}`,
  label,
  durationMs: DEFAULT_DURATION_MS,
  soundId,
});

/** A boss with a single default skill, so it's never empty. */
const makeBoss = (seq: number, skillSeq: number, name: string, accent: string, accent2: string): Boss => ({
  id: `boss-${seq}`,
  name,
  accent,
  accent2,
  skills: [makeSkill(skillSeq, "Skill 1", DEFAULT_SOUND_ID)],
});

/** The seeded cooldown catalog: each example dungeon with a deterministic `cooldown-N` id. */
function seedCooldowns(): CooldownDef[] {
  return COOLDOWN_SEED.map((cd, i) => ({
    id: `cooldown-${i + 1}`,
    name: cd.name,
    tag: deriveTag(cd.name),
    durationMs: cd.durationMs,
  }));
}

/** The seeded recurring catalog: each example chore with a deterministic `recurring-N` id. */
function seedRecurring(): RecurringDef[] {
  return RECURRING_SEED.map((r, i) => ({
    id: `recurring-${i + 1}`,
    name: r.name,
    tag: deriveTag(r.name),
    durationMs: r.durationMs,
    kind: r.kind,
  }));
}

/**
 * The shipped default config: one boss ("Balathor", violet) with two skills, plus the
 * seeded cooldown catalog (six example dungeons) and recurring catalog (three example
 * elapsable items) — nothing running yet on either.
 */
export function makeConfig(): Config {
  let c: Config = {
    bosses: [],
    cooldowns: [],
    running: [],
    recurring: [],
    recurringRunning: [],
    bossSeq: 0,
    skillSeq: 0,
    cooldownSeq: 0,
    recurringSeq: 0,
  };
  c = addBoss(c);
  c = renameBoss(c, c.bosses[0].id, DEFAULT_BOSS_NAME);
  c = addSkill(c, c.bosses[0].id);
  const cooldowns = seedCooldowns();
  const recurring = seedRecurring();
  return { ...c, cooldowns, cooldownSeq: cooldowns.length, recurring, recurringSeq: recurring.length };
}

/** Append a new boss (with one default skill); its accent cycles from the palette. */
export function addBoss(c: Config): Config {
  const bossSeq = c.bossSeq + 1;
  const skillSeq = c.skillSeq + 1;
  const [accent, accent2] = accentAt(bossSeq - 1);
  const boss = makeBoss(bossSeq, skillSeq, `Boss ${bossSeq}`, accent, accent2);
  return { ...c, bosses: [...c.bosses, boss], bossSeq, skillSeq };
}

export function renameBoss(c: Config, id: string, name: string): Config {
  return { ...c, bosses: c.bosses.map((b) => (b.id === id ? { ...b, name } : b)) };
}

/**
 * Delete a boss. If that empties the list, re-seed a fresh `FALLBACK_BOSS` so the
 * overlay is never left empty/broken (the new boss still gets fresh, non-colliding ids).
 */
export function deleteBoss(c: Config, id: string): Config {
  const bosses = c.bosses.filter((b) => b.id !== id);
  if (bosses.length > 0) return { ...c, bosses };
  const bossSeq = c.bossSeq + 1;
  const skillSeq = c.skillSeq + 1;
  const boss = makeBoss(bossSeq, skillSeq, FALLBACK_BOSS.name, FALLBACK_BOSS.accent, FALLBACK_BOSS.accent2);
  return { ...c, bosses: [boss], bossSeq, skillSeq };
}

/** Add a skill to a boss, auto-assigned a distinct sound and a generic default label. */
export function addSkill(c: Config, bossId: string): Config {
  const skillSeq = c.skillSeq + 1;
  return {
    ...c,
    skillSeq,
    bosses: c.bosses.map((b) =>
      b.id === bossId
        ? { ...b, skills: [...b.skills, makeSkill(skillSeq, `Skill ${b.skills.length + 1}`, nextSound(b.skills))] }
        : b,
    ),
  };
}

const editSkill = (c: Config, bossId: string, skillId: string, fn: (s: SkillCfg) => SkillCfg): Config => ({
  ...c,
  bosses: c.bosses.map((b) =>
    b.id === bossId ? { ...b, skills: b.skills.map((s) => (s.id === skillId ? fn(s) : s)) } : b,
  ),
});

export function renameSkill(c: Config, bossId: string, skillId: string, label: string): Config {
  return editSkill(c, bossId, skillId, (s) => ({ ...s, label }));
}

/** Set a skill's duration, clamped to a sane [1s, 999s] range. */
export function setSkillDuration(c: Config, bossId: string, skillId: string, durationMs: number): Config {
  const d = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, Math.round(durationMs) || MIN_DURATION_MS));
  return editSkill(c, bossId, skillId, (s) => ({ ...s, durationMs: d }));
}

/** Set a skill's sound (the bundled sample played on its cues). */
export function setSkillSound(c: Config, bossId: string, skillId: string, soundId: SoundId): Config {
  return editSkill(c, bossId, skillId, (s) => ({ ...s, soundId }));
}

/** Set (or, with `undefined`, clear) a skill's hotkey binding. Combo is stored canonical. */
export function setSkillHotkey(c: Config, bossId: string, skillId: string, hotkey: string | undefined): Config {
  return editSkill(c, bossId, skillId, (s) => {
    if (hotkey) return { ...s, hotkey };
    const next = { ...s };
    delete next.hotkey; // clear → drop the field entirely (not an empty string)
    return next;
  });
}

export function removeSkill(c: Config, bossId: string, skillId: string): Config {
  return {
    ...c,
    bosses: c.bosses.map((b) =>
      b.id === bossId ? { ...b, skills: b.skills.filter((s) => s.id !== skillId) } : b,
    ),
  };
}

export const bossById = (c: Config, id: string | null): Boss | undefined =>
  id == null ? undefined : c.bosses.find((b) => b.id === id);

// ---- cooldown actions (thin Config-level wrappers over the pure running-set ops) ----
// Each resolves a `defId` against the catalog and applies the matching `cooldown.ts`
// transform to `c.running`, leaving the catalog and the rest of the config untouched.

const cooldownById = (c: Config, defId: string): CooldownDef | undefined =>
  c.cooldowns.find((d) => d.id === defId);

/** Map the matching definition through `fn`, leaving siblings/bosses/running untouched. */
const editCooldown = (c: Config, defId: string, fn: (d: CooldownDef) => CooldownDef): Config => ({
  ...c,
  cooldowns: c.cooldowns.map((d) => (d.id === defId ? fn(d) : d)),
});

// ---- catalog CRUD (pure edits to the cooldown *definitions*, issue #28) ----
// Unlike the running-set wrappers (start/restart/clear), these edit the editable catalog
// the user starts from. Each leaves sibling definitions, the bosses and (bar a remove) the
// running set untouched, so the Cooldowns settings section can add / rename / retag /
// set-duration / remove without disturbing anything else. Duration editing reuses
// `setCooldownDuration` (the same [1m, 12h] clamp the velocity wheel uses).

/**
 * Append a blank catalog definition (the "+ add cooldown" gesture), mirroring `addBoss`:
 * a generic `Cooldown N` name with its auto-derived tag and a default one-hour duration,
 * carrying a fresh non-colliding `cooldown-N` id. The user then renames / retags / retunes
 * it in the settings editor.
 */
export function addCooldown(c: Config): Config {
  const cooldownSeq = c.cooldownSeq + 1;
  const name = `Cooldown ${cooldownSeq}`;
  const def: CooldownDef = { id: `cooldown-${cooldownSeq}`, name, tag: deriveTag(name), durationMs: DEFAULT_COOLDOWN_MS };
  return { ...c, cooldowns: [...c.cooldowns, def], cooldownSeq };
}

/**
 * Rename a definition. Because a Tag auto-derives from the name (issue #28), this also
 * re-derives `tag` from the new name, so the short strip label stays in sync as the user
 * types. To override the auto-tag, call `retagCooldown` afterward — a later rename will
 * re-derive it again. An unknown `defId` is a no-op (the same config is returned).
 */
export function renameCooldown(c: Config, defId: string, name: string): Config {
  if (!cooldownById(c, defId)) return c;
  return editCooldown(c, defId, (d) => ({ ...d, name, tag: deriveTag(name) }));
}

/**
 * Set a definition's Tag explicitly — the user override of the name-derived default. A
 * later `renameCooldown` re-derives the tag, clobbering this. Unknown `defId` is a no-op.
 */
export function retagCooldown(c: Config, defId: string, tag: string): Config {
  if (!cooldownById(c, defId)) return c;
  return editCooldown(c, defId, (d) => ({ ...d, tag }));
}

/**
 * Remove a definition from the catalog AND stop any running instance of it, so the strip
 * never holds a running cooldown pointing at a deleted def. Other definitions and the rest
 * of the running set are untouched. Mirrors `removeSkill`: an unknown `defId` simply
 * matches nothing.
 */
export function removeCooldown(c: Config, defId: string): Config {
  return { ...c, cooldowns: c.cooldowns.filter((d) => d.id !== defId), running: clear(c.running, defId) };
}

/**
 * Start (or re-stamp) the cooldown for `defId` at an absolute `expiry = now + durationMs`
 * (defaulting to the definition's own duration). An unknown `defId` is a no-op — the same
 * config is returned. The cap + one-instance-per-def semantics live in `cooldown.start`.
 */
export function startCooldown(c: Config, defId: string, now: number, durationMs?: number): Config {
  const def = cooldownById(c, defId);
  if (!def) return c;
  return { ...c, running: start(c.running, def, now, durationMs ?? def.durationMs) };
}

/**
 * Tune a definition's *catalog* duration (the velocity-wheel gesture in the `+` picker).
 * Unlike `startCooldown`'s per-start `durationMs`, this mutates the definition itself, so
 * the tuned length sticks and persists — future starts and restarts use it. The value is
 * clamped to the tunable [1m, 12h] band (shared with the wheel). An unknown `defId` is a
 * no-op (the same config is returned).
 */
export function setCooldownDuration(c: Config, defId: string, durationMs: number): Config {
  if (!cooldownById(c, defId)) return c;
  return editCooldown(c, defId, (d) => ({ ...d, durationMs: clampDuration(durationMs) }));
}

/** Split a trailing " <n>" off a name; an unsuffixed name counts as copy #1 of its base. */
const splitSuffix = (name: string): { base: string; n: number } => {
  const m = name.match(/^(.+) (\d+)$/);
  return m ? { base: m[1], n: Number(m[2]) } : { base: name, n: 1 };
};

/**
 * Duplicate a definition so the same boss can be tracked twice at once (it spawns in more
 * than one place). The copy keeps the duration and is numbered off its base name —
 * "Hydra" → "Hydra 2", duplicating again → "Hydra 3" — with a number-suffixed Tag
 * ("Hyd2") so the two pills stay distinct in the strip. An unknown `defId` is a no-op.
 */
export function duplicateCooldown(c: Config, defId: string): Config {
  const src = cooldownById(c, defId);
  if (!src) return c;
  const base = splitSuffix(src.name).base;
  const maxN = c.cooldowns
    .map((d) => splitSuffix(d.name))
    .filter((s) => s.base === base)
    .reduce((mx, s) => Math.max(mx, s.n), 0);
  const n = maxN + 1;
  const cooldownSeq = c.cooldownSeq + 1;
  const dup: CooldownDef = {
    id: `cooldown-${cooldownSeq}`,
    name: `${base} ${n}`,
    tag: `${deriveTag(base)}${n}`,
    durationMs: src.durationMs,
  };
  return { ...c, cooldowns: [...c.cooldowns, dup], cooldownSeq };
}

/**
 * Re-stamp the running cooldown for `defId` back to the definition's full catalog
 * duration (the click-a-pill gesture — always the catalog length, never a tuned value).
 * An unknown `defId` is a no-op.
 */
export function restartCooldown(c: Config, defId: string, now: number): Config {
  const def = cooldownById(c, defId);
  if (!def) return c;
  return { ...c, running: restart(c.running, def, now) };
}

/** Stop and remove the running cooldown for `defId`; a no-op if it isn't running. */
export function clearCooldown(c: Config, defId: string): Config {
  return { ...c, running: clear(c.running, defId) };
}

// ---- recurring actions (thin Config-level wrappers over the pure recurring ops) ----
// Like the cooldown wrappers, each resolves a `defId` against the recurring catalog and
// applies the matching `recurring.ts` transform to `c.recurringRunning`, leaving the catalog
// and the rest of the config untouched. `now` is supplied by the caller (the 1s tick).

const recurringById = (c: Config, defId: string): RecurringDef | undefined =>
  c.recurring.find((d) => d.id === defId);

/** Map the matching recurring definition through `fn`, leaving siblings/bosses/running untouched. */
const editRecurring = (c: Config, defId: string, fn: (d: RecurringDef) => RecurringDef): Config => ({
  ...c,
  recurring: c.recurring.map((d) => (d.id === defId ? fn(d) : d)),
});

// The day-scale band a recurring duration is held within — [1 minute, 365 days]. Far wider
// than the cooldown wheel's [1m, 12h] (these chores drain over hours to weeks), so they get
// their own clamp rather than reusing `clampDuration`. The length a freshly-added item starts
// at is one day, mid-band, so the d/h/m control nudges it either way.
const MIN_RECURRING_MS = 1 * MS_PER_MIN;
const MAX_RECURRING_MS = 365 * MS_PER_DAY;
const DEFAULT_RECURRING_MS = 1 * MS_PER_DAY;

/** Clamp a recurring duration into the day-scale [1m, 365d] band (rounded to whole ms). */
const clampRecurringDuration = (ms: number): number =>
  Math.max(MIN_RECURRING_MS, Math.min(MAX_RECURRING_MS, Math.round(ms) || MIN_RECURRING_MS));

/**
 * Mark the recurring item for `defId` done — restamps a full cycle from `now`
 * (`expiry = now + durationMs`, rolling-from-last-done), the single completion gesture for
 * both kinds. Also the start gesture: marking an unstarted def done is how it begins running.
 * One running instance per def (re-stamp in place). An unknown `defId` is a no-op.
 */
export function markRecurring(c: Config, defId: string, now: number): Config {
  const def = recurringById(c, defId);
  if (!def) return c;
  return { ...c, recurringRunning: markDone(c.recurringRunning, def, now) };
}

// ---- recurring catalog CRUD (issue #37/#38) — the day-scale sibling of the cooldown editor ----
// Edits to the editable recurring *definitions*, mirroring addCooldown/rename/retag/remove so the
// settings editor can manage both flavours without touching the running set (bar a remove, which
// also stops any running instance). `addRecurring` takes the `kind`, so the ELAPSABLE ITEMS
// section adds `deadline`s and the ROUTINE section adds `gate`s; duration uses the day-scale clamp.

/**
 * Append a blank definition (the settings "+ add" gesture), mirroring `addCooldown`: a generic
 * name with its auto-derived tag and a one-day default duration, carrying a fresh non-colliding
 * `recurring-N` id. `kind` selects which editor section it belongs to — a `deadline` reads as an
 * "Item N" elapsable, a `gate` as a "Routine N" chore — and defaults to `deadline` (the #37
 * caller). The user then renames / retags / retunes it.
 */
export function addRecurring(c: Config, kind: RecurringKind = "deadline"): Config {
  const recurringSeq = c.recurringSeq + 1;
  const name = `${kind === "gate" ? "Routine" : "Item"} ${recurringSeq}`;
  const def: RecurringDef = {
    id: `recurring-${recurringSeq}`,
    name,
    tag: deriveTag(name),
    durationMs: DEFAULT_RECURRING_MS,
    kind,
  };
  return { ...c, recurring: [...c.recurring, def], recurringSeq };
}

/**
 * Rename a definition, re-deriving its `tag` from the new name (like `renameCooldown`, so the
 * short bar label stays in sync as the user types; `retagRecurring` overrides afterward). An
 * unknown `defId` is a no-op.
 */
export function renameRecurring(c: Config, defId: string, name: string): Config {
  if (!recurringById(c, defId)) return c;
  return editRecurring(c, defId, (d) => ({ ...d, name, tag: deriveTag(name) }));
}

/** Set a definition's Tag explicitly — the user override of the name-derived default. No-op if unknown. */
export function retagRecurring(c: Config, defId: string, tag: string): Config {
  if (!recurringById(c, defId)) return c;
  return editRecurring(c, defId, (d) => ({ ...d, tag }));
}

/** Set a definition's duration, clamped to the day-scale [1m, 365d] band. No-op if unknown. */
export function setRecurringDuration(c: Config, defId: string, durationMs: number): Config {
  if (!recurringById(c, defId)) return c;
  return editRecurring(c, defId, (d) => ({ ...d, durationMs: clampRecurringDuration(durationMs) }));
}

/**
 * Remove a definition from the catalog AND stop any running instance of it, so the dock never
 * holds a running item pointing at a deleted def (mirrors `removeCooldown`). Other definitions
 * and the rest of the running set are untouched; an unknown `defId` simply matches nothing.
 */
export function removeRecurring(c: Config, defId: string): Config {
  return {
    ...c,
    recurring: c.recurring.filter((d) => d.id !== defId),
    recurringRunning: c.recurringRunning.filter((r) => r.defId !== defId),
  };
}
