// Pure user-config model: the set of bosses and, per boss, the skills the overlay
// times. Like the timer engine this owns no clock, no React, no storage — every
// operation is a pure `(Config, ...) -> Config` transform, which is what makes the
// whole model unit-testable. Id sequencing lives here too (the persistence slice will
// later seed the counters past any restored ids so regenerated ids never collide).

import type { TimerInit } from "./timer";

// A skill is, structurally, exactly what the timer engine needs to make a timer
// (`TimerInit` = { id; label; durationMs; pitch }), so a boss's `skills` can be fed
// straight to `useTimers` with no mapping.
export type SkillCfg = TimerInit;

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
  /** Monotonic counters owned here so ids never collide (even after deletes). */
  bossSeq: number;
  skillSeq: number;
};

// Accent pairs cycled as bosses are added, so each boss reads distinctly.
export const ACCENTS: ReadonlyArray<readonly [string, string]> = [
  ["#ff2d6b", "#ff8a3d"],
  ["#00e5ff", "#8a5bff"],
  ["#39ff88", "#00e5ff"],
  ["#ffd166", "#ff5d8f"],
  ["#b388ff", "#5d9bff"],
  ["#ff7b3d", "#ffd166"],
];

// Pitch palette assigned to new skills, so each skill's beep stays distinguishable.
export const PITCHES: readonly number[] = [880, 523, 659, 740, 988, 440, 587, 784];

// Re-seeded when the last boss is deleted, so the overlay is never empty/broken.
export const FALLBACK_BOSS = { name: "Boss", accent: "#7c6cff", accent2: "#7c6cff" } as const;

const DEFAULT_DURATION_MS = 20_000;
const MIN_DURATION_MS = 1_000;
const MAX_DURATION_MS = 999_000;

/** Accent pair for the n-th boss (0-based), wrapping the palette. */
const accentAt = (n: number): readonly [string, string] => ACCENTS[n % ACCENTS.length];

/**
 * The next distinct pitch for a boss: the first palette pitch not already in use by
 * its skills; once the palette is exhausted, cycle by skill count so it still varies.
 */
const nextPitch = (skills: SkillCfg[]): number => {
  const used = new Set(skills.map((s) => s.pitch));
  return PITCHES.find((p) => !used.has(p)) ?? PITCHES[skills.length % PITCHES.length];
};

const makeSkill = (seq: number, label: string, pitch: number): SkillCfg => ({
  id: `skill-${seq}`,
  label,
  durationMs: DEFAULT_DURATION_MS,
  pitch,
});

/** A boss with a single default skill, so it's never empty. */
const makeBoss = (seq: number, skillSeq: number, name: string, accent: string, accent2: string): Boss => ({
  id: `boss-${seq}`,
  name,
  accent,
  accent2,
  skills: [makeSkill(skillSeq, "Skill 1", PITCHES[0])],
});

/** The shipped default config: one boss with two distinct-pitch skills. */
export function makeConfig(): Config {
  let c: Config = { bosses: [], bossSeq: 0, skillSeq: 0 };
  c = addBoss(c);
  c = addSkill(c, c.bosses[0].id);
  return c;
}

/** Append a new boss (with one default skill); its accent cycles from the palette. */
export function addBoss(c: Config): Config {
  const bossSeq = c.bossSeq + 1;
  const skillSeq = c.skillSeq + 1;
  const [accent, accent2] = accentAt(bossSeq - 1);
  const boss = makeBoss(bossSeq, skillSeq, `Boss ${bossSeq}`, accent, accent2);
  return { bosses: [...c.bosses, boss], bossSeq, skillSeq };
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
  return { bosses: [boss], bossSeq, skillSeq };
}

/** Add a skill to a boss, auto-assigned a distinct pitch and a generic default label. */
export function addSkill(c: Config, bossId: string): Config {
  const skillSeq = c.skillSeq + 1;
  return {
    ...c,
    skillSeq,
    bosses: c.bosses.map((b) =>
      b.id === bossId
        ? { ...b, skills: [...b.skills, makeSkill(skillSeq, `Skill ${b.skills.length + 1}`, nextPitch(b.skills))] }
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
