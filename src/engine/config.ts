// Pure user-config model: the set of bosses and, per boss, the skills the overlay
// times. Like the timer engine this owns no clock, no React, no storage — every
// operation is a pure `(Config, ...) -> Config` transform, which is what makes the
// whole model unit-testable. Id sequencing lives here too (the persistence slice will
// later seed the counters past any restored ids so regenerated ids never collide).

import type { TimerInit } from "./timer";
import { DEFAULT_SOUND_ID, SOUND_IDS, type SoundId } from "./sounds";
import { type CooldownDef, type RunningCooldown, deriveTag } from "./cooldown";

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
  /** Monotonic counters owned here so ids never collide (even after deletes). */
  bossSeq: number;
  skillSeq: number;
  cooldownSeq: number;
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

// The example dungeons a fresh install ships with. Durations are "examples not gospel" —
// the user retunes them per server (the catalog editor is a later slice). Tags are
// auto-derived from the names so the seed and any user-added cooldown stay consistent.
const COOLDOWN_SEED: ReadonlyArray<{ name: string; durationMs: number }> = [
  { name: "Hydra", durationMs: 15 * MS_PER_MIN },
  { name: "Razador", durationMs: 1 * MS_PER_HOUR },
  { name: "Nemere", durationMs: 4 * MS_PER_HOUR },
  { name: "Meley", durationMs: 3 * MS_PER_HOUR },
  { name: "Balathor", durationMs: 3 * MS_PER_HOUR },
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

/**
 * The shipped default config: one boss ("Balathor", violet) with two skills, plus the
 * seeded cooldown catalog (five example dungeons, nothing running yet).
 */
export function makeConfig(): Config {
  let c: Config = { bosses: [], cooldowns: [], running: [], bossSeq: 0, skillSeq: 0, cooldownSeq: 0 };
  c = addBoss(c);
  c = renameBoss(c, c.bosses[0].id, DEFAULT_BOSS_NAME);
  c = addSkill(c, c.bosses[0].id);
  const cooldowns = seedCooldowns();
  return { ...c, cooldowns, cooldownSeq: cooldowns.length };
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
