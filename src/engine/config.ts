// Pure user-config model: the set of bosses and, per boss, the skills the overlay
// times. Like the timer engine this owns no clock, no React, no storage — every
// operation is a pure `(Config, ...) -> Config` transform, which is what makes the
// whole model unit-testable. Id sequencing lives here too (the persistence slice will
// later seed the counters past any restored ids so regenerated ids never collide).

import type { TimerInit } from "./timer";
import { DEFAULT_SOUND_ID, SOUND_IDS, type SoundId } from "./sounds";
import { type CooldownDef, type RunningCooldown, clear, deriveTag, restart, start } from "./cooldown";
import {
  type RecurringDef,
  type RecurringKind,
  type RecurringProgress,
  type RunningRecurring,
  markDone,
  positionOf,
  rungEntry,
  setPosition,
} from "./recurring";
import { type Character, DEFAULT_CHARACTER_NAME, activeCharacter, makeCharacter } from "./character";
import { type Build, type Empire, type Race, subsetFor } from "./skillCatalog";
import { clampDuration } from "./cooldownTuning";
import { cooldownKey, recurringKey } from "./contentKeys";
import { DEFAULT_LOCALE, type Locale } from "./localeTypes";

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
  /**
   * The player's characters (PRD #47). Each owns the RECURRING side of the app — its own Routine/
   * Elapsable-item catalog, running set, and ladder progress. The recurring fields that used to live
   * at the top of `Config` now live per-character (see `engine/character.ts`); bosses/cooldowns stay
   * global. A fresh or migrated config always has at least one (default) character.
   */
  characters: Character[];
  /** Which character the dock shows and every recurring read resolves against (null = none). */
  activeCharacterId: string | null;
  /** Monotonic counters owned here so ids never collide (even after deletes). `recurringSeq` stays
   *  global so recurring ids are unique across every character (the progress/running maps key on it). */
  bossSeq: number;
  skillSeq: number;
  cooldownSeq: number;
  recurringSeq: number;
  characterSeq: number;
  /**
   * The active content locale (PRD #77, slice #83). Persisted and switchable at runtime; the overlay
   * reads this to resolve seeded item display names through the content catalog. Defaults to `"en"`
   * (the only locale with a content table until Slice 5); first-run is seeded from the OS language via
   * `overlay/osLocale.ts` with a clean English fallback.
   */
  locale: Locale;
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
export const COOLDOWN_SEED: ReadonlyArray<{ name: string; durationMs: number }> = [
  { name: "Hydra", durationMs: 15 * MS_PER_MIN },
  { name: "Razador", durationMs: 1 * MS_PER_HOUR },
  { name: "Nemere", durationMs: 4 * MS_PER_HOUR },
  { name: "Meley", durationMs: 3 * MS_PER_HOUR },
  { name: "Balathor", durationMs: 3 * MS_PER_HOUR },
  { name: "Northwind War Chief", durationMs: 1 * MS_PER_HOUR },
];

// The example recurring items a fresh install ships with. Like the cooldown seed these are
// "examples not gospel": the user retunes durations and adds their own in settings. Two flavours
// ship so each dock tool reads non-empty: the standing `deadline` expiring items (pet, costume,
// mount — you lose the thing if it elapses, ♻ Items) first, then the `gate` routines (a chore that
// rolls back into "do it now" each cycle, ✓ Routine).
//
// The gate seed covers Metin2's recurring "chore" systems. Every readable shares a 24h read
// cooldown and is probabilistic (a failed read still consumes the book) — so as a timer they're
// all identical 24h gates; what differs is the long-term QUOTA, which has no field on
// `RecurringDef` yet (a future quota-tracking slice). The per-row quota is recorded in the
// trailing comment so it survives until then; the full sourced spec lives in the
// `metin2-readable-presets` project memory.
// The trailing quota comments are now made live by `ladderId`: each gate points at one of the five
// seeded ladder *structures* in `recurring.ts` (the rung table + caps), shared — transformation by
// four defs, language by three. `ladderId` is pure presentation (like `kind`); the deadlines carry none.
export const RECURRING_SEED: ReadonlyArray<{ name: string; durationMs: number; kind: RecurringKind; ladderId?: string }> = [
  { name: "Alastor Pet", durationMs: 3 * MS_PER_DAY, kind: "deadline" }, // pet
  { name: "White Navy Uniform Costume", durationMs: 14 * MS_PER_DAY, kind: "deadline" }, // costume
  { name: "Battle Horse", durationMs: 18 * MS_PER_HOUR, kind: "deadline" }, // mount
  { name: "Skill Books", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "class-skill" }, // 55 reads M1→G1; 20k EXP/read
  { name: "Transformation", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "transformation" }, // 0→P = 40 (20 to M1)
  { name: "Inspiration", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "transformation" }, // transformation pattern
  { name: "Charisma", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "transformation" }, // transformation pattern
  { name: "Mining", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "transformation" }, // transformation pattern
  { name: "Leadership", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "leadership" }, // 20+55+155 = 230 (3 Art-of-War books)
  { name: "Jinno Language", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "language" }, // 20 reads to M1 cap
  { name: "Chunjo Language", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "language" }, // 20 reads to M1 cap
  { name: "Shinsoo Language", durationMs: 24 * MS_PER_HOUR, kind: "gate", ladderId: "language" }, // 20 reads to M1 cap
  { name: "Biologist", durationMs: 22 * MS_PER_HOUR, kind: "gate", ladderId: "biologist" }, // hand-in; CAN fail; cd 12–24h
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
    catalogKey: cooldownKey(cd.name),
  }));
}

/**
 * Mint `RecurringDef`s from any catalog/seed sources (the shipped seed or a `skillCatalog` preform
 * subset), numbering each id off `seq` — the global `recurringSeq` — so recurring ids stay unique
 * across every character. Returns the new defs plus the advanced `seq`. A source is a superset of a
 * def (it may carry catalog facets like `category`); only the def fields are copied across.
 */
function mintRecurring(
  sources: ReadonlyArray<{ name: string; durationMs: number; kind: RecurringKind; ladderId?: string; build?: string }>,
  seq: number,
): { defs: RecurringDef[]; seq: number } {
  const defs = sources.map((r, i) => ({
    id: `recurring-${seq + i + 1}`,
    name: r.name,
    durationMs: r.durationMs,
    kind: r.kind,
    // Stable, locale-independent identity (PRD #77), derived from the (English) name so a config-seed
    // chore and the matching skill-catalog preform — same name — agree on one key. The overlay
    // resolves the display name through this; `name` stays the English fallback.
    catalogKey: recurringKey(r.name),
    ...(r.ladderId ? { ladderId: r.ladderId } : {}),
    // A class Ability carries its school (the catalog preform's `build`) so the dock can band the
    // Skill Books by school (#57); pure presentation, like `ladderId`. Non-ability sources have none.
    ...(r.build ? { school: r.build } : {}),
  }));
  return { defs, seq: seq + sources.length };
}

/** The seeded recurring catalog: each example chore with a deterministic `recurring-N` id. */
function seedRecurring(): RecurringDef[] {
  return mintRecurring(RECURRING_SEED, 0).defs;
}

/**
 * The shipped default config: one boss ("Balathor", violet) with two skills, plus the
 * seeded cooldown catalog (six example dungeons) and recurring catalog (three expiring
 * items + the recurring chore gates) — nothing running yet on either.
 */
export function makeConfig(): Config {
  let c: Config = {
    bosses: [],
    cooldowns: [],
    running: [],
    characters: [],
    activeCharacterId: null,
    bossSeq: 0,
    skillSeq: 0,
    cooldownSeq: 0,
    recurringSeq: 0,
    characterSeq: 0,
    locale: DEFAULT_LOCALE,
  };
  c = addBoss(c);
  c = renameBoss(c, c.bosses[0].id, DEFAULT_BOSS_NAME);
  c = addSkill(c, c.bosses[0].id);
  const cooldowns = seedCooldowns();
  // The shipped recurring seed lives under a single default character; bosses/cooldowns stay global.
  const recurring = seedRecurring();
  const character = makeCharacter("character-1", DEFAULT_CHARACTER_NAME, { recurring });
  return {
    ...c,
    cooldowns,
    cooldownSeq: cooldowns.length,
    recurringSeq: recurring.length,
    characters: [character],
    activeCharacterId: character.id,
    characterSeq: 1,
  };
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

// ---- character lifecycle (PRD #47, create flow #54) ----
// The write path the create flow + dock switcher drive. `addCharacter` is the mirror of `addBoss`:
// mint a fresh `character-N` id, seed its recurring chores from the `skillCatalog` subset for the
// chosen axes, and append it. Rename/select/delete round out the switcher. Entitlement gating lives
// at the call site (`allows(…, "addCharacter")` in useConfig), not here — these stay pure.

/** The classification a create flow collects: a name plus the optional Empire ⊥ Race ⊥ Builds axes. */
export type CharacterDraft = { name: string; empire?: Empire; race?: Race; builds?: Build[] };

/**
 * Append a new character built from `draft`, seeding its recurring catalog from
 * `skillCatalog.subsetFor(empire, race, builds)` — the universal chores, the race/build Abilities,
 * and the two foreign Languages — with ids minted off the global `recurringSeq`. The new character
 * becomes active (you land on what you just created); first-run create flows through this same path.
 */
export function addCharacter(c: Config, draft: CharacterDraft): Config {
  const characterSeq = c.characterSeq + 1;
  const id = `character-${characterSeq}`;
  const builds = draft.builds ?? [];
  const { defs: recurring, seq: recurringSeq } = mintRecurring(
    subsetFor(draft.empire, draft.race, builds),
    c.recurringSeq,
  );
  const character: Character = {
    ...makeCharacter(id, draft.name, { recurring }),
    ...(draft.empire ? { empire: draft.empire } : {}),
    ...(draft.race ? { race: draft.race } : {}),
    builds,
  };
  return { ...c, characters: [...c.characters, character], characterSeq, recurringSeq, activeCharacterId: id };
}

/** Rename a character by id; siblings (and an unknown id) are left untouched. */
export function renameCharacter(c: Config, id: string, name: string): Config {
  return { ...c, characters: c.characters.map((ch) => (ch.id === id ? { ...ch, name } : ch)) };
}

/** Order-insensitive Build set equality — the create flow can toggle builds in any order. */
const sameBuilds = (a: Build[], b: Build[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Set (or change) an existing character's name and class axes (empire/race/builds) — the edit path
 * the ✎ flow drives, including classifying the unclassified migrated default. When the axes actually
 * change, the character's GATE chores are re-seeded from `skillCatalog.subsetFor` for the new class
 * (fresh ids off `recurringSeq`), while its `deadline` "expiring items" (pet/costume/mount — not
 * class-bound) are kept; running timers and ladder progress on the replaced gates reset. A name-only
 * edit (axes unchanged) just renames, touching no chores. A no-op for an unknown id.
 */
export function classifyCharacter(c: Config, id: string, draft: CharacterDraft): Config {
  const target = c.characters.find((ch) => ch.id === id);
  if (!target) return c;
  const builds = draft.builds ?? [];
  const axesChanged =
    draft.empire !== target.empire || draft.race !== target.race || !sameBuilds(builds, target.builds);
  if (!axesChanged) return renameCharacter(c, id, draft.name);

  // Keep the deadline items; replace the gate chores with the new class's skill books.
  const deadlines = target.recurring.filter((d) => d.kind === "deadline");
  const { defs: gates, seq: recurringSeq } = mintRecurring(subsetFor(draft.empire, draft.race, builds), c.recurringSeq);
  const kept = new Set(deadlines.map((d) => d.id));
  const updated: Character = {
    ...target,
    name: draft.name,
    empire: draft.empire,
    race: draft.race,
    builds,
    recurring: [...deadlines, ...gates],
    recurringRunning: target.recurringRunning.filter((r) => kept.has(r.defId)),
    recurringProgress: target.recurringProgress.filter((p) => kept.has(p.defId)),
  };
  return { ...c, characters: c.characters.map((ch) => (ch.id === id ? updated : ch)), recurringSeq };
}

/** Switch the active character. A no-op for an unknown id, so the switcher can never point at a ghost. */
export function selectCharacter(c: Config, id: string): Config {
  if (!c.characters.some((ch) => ch.id === id)) return c;
  return { ...c, activeCharacterId: id };
}

/**
 * Delete a character by id. If that removed the active one (or left `activeCharacterId` dangling),
 * re-point active to the first survivor — or null when none remain (the overlay then shows the
 * first-run create flow). An unknown id is a no-op.
 */
export function deleteCharacter(c: Config, id: string): Config {
  const characters = c.characters.filter((ch) => ch.id !== id);
  if (characters.length === c.characters.length) return c;
  const activeSurvives = characters.some((ch) => ch.id === c.activeCharacterId);
  const activeCharacterId = activeSurvives ? c.activeCharacterId : (characters[0]?.id ?? null);
  return { ...c, characters, activeCharacterId };
}

// ---- active-character recurring scoping (PRD #47) ----
// The recurring side of the app belongs to the ACTIVE character: every wrapper below reads/writes
// that character's `recurring*` slices, leaving bosses/cooldowns and every OTHER character untouched.
// `editActiveCharacter` is the single write seam; the `active*` accessors are the read seam the
// overlay/settings use instead of reaching into the shape. With no active character all reads are
// empty and all writes are no-ops, so the engine degrades gracefully.
export { type Character, activeCharacter } from "./character";

const editActiveCharacter = (c: Config, fn: (ch: Character) => Character): Config => ({
  ...c,
  characters: c.characters.map((ch) => (ch.id === c.activeCharacterId ? fn(ch) : ch)),
});

/** The active character's recurring catalog (empty when there's no active character). */
export const activeRecurring = (c: Config): RecurringDef[] => activeCharacter(c)?.recurring ?? [];
/** The active character's currently-running recurring items. */
export const activeRecurringRunning = (c: Config): RunningRecurring[] => activeCharacter(c)?.recurringRunning ?? [];
/** The active character's per-def ladder progress map. */
export const activeRecurringProgress = (c: Config): RecurringProgress[] => activeCharacter(c)?.recurringProgress ?? [];

// ---- recurring actions (thin Config-level wrappers over the pure recurring ops) ----
// Like the cooldown wrappers, each resolves a `defId` against the active character's recurring
// catalog and applies the matching `recurring.ts` transform to that character's running set, leaving
// the catalog and the rest of the config untouched. `now` is supplied by the caller (the 1s tick).

const recurringById = (c: Config, defId: string): RecurringDef | undefined =>
  activeRecurring(c).find((d) => d.id === defId);

/** Map the matching recurring definition (in the active character) through `fn`, siblings untouched. */
const editRecurring = (c: Config, defId: string, fn: (d: RecurringDef) => RecurringDef): Config =>
  editActiveCharacter(c, (ch) => ({ ...ch, recurring: ch.recurring.map((d) => (d.id === defId ? fn(d) : d)) }));

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
  return editActiveCharacter(c, (ch) => ({ ...ch, recurringRunning: markDone(ch.recurringRunning, def, now) }));
}

/**
 * Log the outcome of a ladder read for `defId` (issue #45) — the two-outcome gesture a ladder row
 * shows in place of the plain gate's single ✓. Either outcome restamps the gate (`markDone` — a
 * read/consign happened, so its cooldown starts), but only `success` advances the rank: `position +
 * 1`, clamped to the ladder's cap (a ✓ at the cap is a no-op on position — the row is already the
 * inert trophy). A `fail` burns the book/item with no advance — gate only. An unknown `defId` is a
 * no-op.
 *
 * The gate always restamps, on every read, for both ladder styles: a `rung` read is a daily book
 * read, and a `stage` ✓ is a single item consigned — each consign has its own cooldown (Biologist's
 * 22h), so the timer to the *next* consign starts on every ✓. Used only on ladder-bearing gates; a
 * plain gate keeps `markRecurring`.
 */
export function markRead(c: Config, defId: string, now: number, success: boolean): Config {
  const def = recurringById(c, defId);
  if (!def) return c;
  return editActiveCharacter(c, (ch) => {
    const recurringRunning = markDone(ch.recurringRunning, def, now);
    if (!success) return { ...ch, recurringRunning }; // failed read — gate restamped, rank untouched
    const next = positionOf(ch.recurringProgress, defId) + 1;
    return { ...ch, recurringRunning, recurringProgress: setPosition(ch.recurringProgress, defId, next, def.ladderId) };
  });
}

/**
 * Set a ladder def's current rung (issue #46) — players install with progress already in hand, and
 * this is also the only path to correct a mis-tapped ✓. It maps the chosen rung *label* to that
 * rung's entry-threshold `position` (rung granularity — the first few ✓s true up the within-rung
 * count) and writes the `recurringProgress` map ONLY: the daily gate (`recurringRunning`) is left
 * untouched, so setting your rank never spends today's read. A no-op for an unknown def, a def with
 * no ladder, or a label not on that ladder.
 */
export function setRung(c: Config, defId: string, rungLabel: string): Config {
  const def = recurringById(c, defId);
  if (!def) return c;
  const entry = rungEntry(def.ladderId, rungLabel);
  if (entry == null) return c; // not a rung on this def's ladder (or no ladder) → no-op
  return editActiveCharacter(c, (ch) => ({
    ...ch,
    recurringProgress: setPosition(ch.recurringProgress, defId, entry, def.ladderId),
  }));
}

// ---- recurring catalog CRUD (issue #37/#38) — the day-scale sibling of the cooldown editor ----
// Edits to the editable recurring *definitions*, mirroring addCooldown/rename/remove so the
// settings editor can manage both flavours without touching the running set (bar a remove, which
// also stops any running instance). `addRecurring` takes the `kind`, so the EXPIRING ITEMS
// section adds `deadline`s and the ROUTINE section adds `gate`s; duration uses the day-scale clamp.
// Unlike cooldowns, recurring items carry no short Tag — the accordion shows the full name (the
// dock surfaces a single soonest/count datum, not a dense per-item strip), so there's nothing to
// abbreviate.

/**
 * Append a blank definition (the settings "+ add" gesture), mirroring `addCooldown`: a generic
 * name with a one-day default duration, carrying a fresh non-colliding `recurring-N` id. `kind`
 * selects which editor section it belongs to — a `deadline` reads as an "Item N" expiring item, a
 * `gate` as a "Routine N" chore — and defaults to `deadline` (the #37 caller). The user then
 * renames / retunes it.
 */
export function addRecurring(c: Config, kind: RecurringKind = "deadline"): Config {
  const recurringSeq = c.recurringSeq + 1;
  const name = `${kind === "gate" ? "Routine" : "Item"} ${recurringSeq}`;
  const def: RecurringDef = {
    id: `recurring-${recurringSeq}`,
    name,
    durationMs: DEFAULT_RECURRING_MS,
    kind,
  };
  // `recurringSeq` stays global on Config (ids unique across characters); the def lands in the active one.
  return editActiveCharacter({ ...c, recurringSeq }, (ch) => ({ ...ch, recurring: [...ch.recurring, def] }));
}

/** Rename a definition (like `renameCooldown`, minus the tag re-derive). An unknown `defId` is a no-op. */
export function renameRecurring(c: Config, defId: string, name: string): Config {
  if (!recurringById(c, defId)) return c;
  return editRecurring(c, defId, (d) => ({ ...d, name }));
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
  return editActiveCharacter(c, (ch) => ({
    ...ch,
    recurring: ch.recurring.filter((d) => d.id !== defId),
    recurringRunning: ch.recurringRunning.filter((r) => r.defId !== defId),
  }));
}
