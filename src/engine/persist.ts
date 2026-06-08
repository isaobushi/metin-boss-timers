// Pure persistence (de)serialization: the testable core of slice #4, with no Tauri,
// no clock, no I/O. `serialize` turns the live `Config` into a versioned, on-disk-ready
// payload; `deserialize` validates an arbitrary value back into a `Config`, falling
// back to shipped defaults on anything malformed. The on-disk store adapter (Tauri
// plugin-store) lives separately and just hands raw values through these two functions.

import { type Boss, type Config, type SkillCfg, makeConfig } from "./config";
import { DEFAULT_SOUND_ID, isSoundId } from "./sounds";

/**
 * Bumped whenever the persisted shape changes; future migrations branch on it. Only
 * v1 is understood today — an unrecognised version deserializes to shipped defaults.
 */
export const SCHEMA_VERSION = 1;

export type PersistedConfig = {
  version: number;
  bosses: Boss[];
};

/**
 * Versioned, JSON-safe snapshot for the on-disk store. Only `bosses` is persisted —
 * the id-sequence counters are *recomputed* on load (seeded past the max persisted id),
 * so they can never drift from the ids actually in the payload.
 */
export function serialize(c: Config): PersistedConfig {
  return { version: SCHEMA_VERSION, bosses: c.bosses };
}

/**
 * Validate an arbitrary value (e.g. JSON read from disk) into a `Config`. Anything
 * missing, version-mismatched, or structurally invalid falls back to `makeConfig()`
 * so the app always boots with a usable, non-empty config. The seq counters are seeded
 * past the highest `boss-N` / `skill-N` id so ids minted after a reload never collide.
 */
export function deserialize(raw: unknown): Config {
  const bosses = readBosses(raw);
  if (!bosses || bosses.length === 0) return makeConfig();

  const skillIds = bosses.flatMap((b) => b.skills.map((s) => s.id));
  return {
    bosses,
    bossSeq: maxIdSeq(bosses.map((b) => b.id), "boss"),
    skillSeq: maxIdSeq(skillIds, "skill"),
  };
}

/** Highest numeric suffix of `<prefix>-<n>` ids, or 0 if none match. */
function maxIdSeq(ids: string[], prefix: string): number {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  return ids.reduce((mx, id) => {
    const m = id.match(re);
    return m ? Math.max(mx, Number(m[1])) : mx;
  }, 0);
}

// ---- validation (all-or-nothing: any malformed field → null → defaults) ----

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Returns the validated boss list, or null if the payload isn't a recognised v1 config. */
function readBosses(raw: unknown): Boss[] | null {
  if (!isObj(raw) || raw.version !== SCHEMA_VERSION || !Array.isArray(raw.bosses)) return null;
  const out: Boss[] = [];
  for (const b of raw.bosses) {
    const boss = readBoss(b);
    if (!boss) return null;
    out.push(boss);
  }
  return out;
}

function readBoss(b: unknown): Boss | null {
  if (!isObj(b) || !isStr(b.id) || !isStr(b.name) || !isStr(b.accent) || !isStr(b.accent2)) return null;
  if (!Array.isArray(b.skills)) return null;
  const skills: SkillCfg[] = [];
  for (const s of b.skills) {
    const skill = readSkill(s);
    if (!skill) return null;
    skills.push(skill);
  }
  // rebuild explicitly so unknown extra fields are dropped
  return { id: b.id, name: b.name, accent: b.accent, accent2: b.accent2, skills };
}

function readSkill(s: unknown): SkillCfg | null {
  if (!isObj(s) || !isStr(s.id) || !isStr(s.label) || !isNum(s.durationMs)) return null;
  // soundId is lenient: a known slug is kept, anything else (including a pre-feature skill
  // that only has the dropped `pitch` field) falls back to the default. This is what lets
  // old configs migrate in place instead of being wiped — so we deliberately DON'T bump
  // SCHEMA_VERSION (a bump would route them to the defaults path).
  const soundId = isSoundId(s.soundId) ? s.soundId : DEFAULT_SOUND_ID;
  const skill: SkillCfg = { id: s.id, label: s.label, durationMs: s.durationMs, soundId };
  // hotkey is optional; keep a valid string, drop anything else (rebuilds explicitly so
  // unknown extra fields — including legacy `pitch` — are stripped, matching readBoss).
  if (isStr(s.hotkey)) skill.hotkey = s.hotkey;
  return skill;
}
