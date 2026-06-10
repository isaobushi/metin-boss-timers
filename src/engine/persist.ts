// Pure persistence (de)serialization: the testable core of slice #4, with no Tauri,
// no clock, no I/O. `serialize` turns the live `Config` into a versioned, on-disk-ready
// payload; `deserialize` validates an arbitrary value back into a `Config`, falling
// back to shipped defaults on anything malformed. The on-disk store adapter (Tauri
// plugin-store) lives separately and just hands raw values through these two functions.

import { type Boss, type Config, type SkillCfg, makeConfig } from "./config";
import type { CooldownDef, RunningCooldown } from "./cooldown";
import type { RecurringDef, RecurringKind, RunningRecurring } from "./recurring";
import { DEFAULT_SOUND_ID, isSoundId } from "./sounds";

/**
 * Bumped whenever the persisted shape changes; future migrations branch on it. Only
 * v1 is understood today — an unrecognised version deserializes to shipped defaults.
 */
export const SCHEMA_VERSION = 1;

export type PersistedConfig = {
  version: number;
  bosses: Boss[];
  cooldowns: CooldownDef[];
  /** Running cooldowns persist their ABSOLUTE expiry, so they keep counting while closed. */
  running: RunningCooldown[];
  /** The recurring-chore catalog (elapsable items + routine). */
  recurring: RecurringDef[];
  /** Running recurring items persist their ABSOLUTE expiry, like cooldowns. */
  recurringRunning: RunningRecurring[];
};

/**
 * Versioned, JSON-safe snapshot for the on-disk store. Definitions (bosses, cooldown
 * catalog) and the running cooldown set are persisted; the id-sequence counters are
 * *recomputed* on load (seeded past the max persisted id), so they can never drift from
 * the ids actually in the payload. Running cooldowns keep their absolute `expiry` so a
 * wait that elapsed while the app was closed restores already past zero.
 */
export function serialize(c: Config): PersistedConfig {
  return {
    version: SCHEMA_VERSION,
    bosses: c.bosses,
    cooldowns: c.cooldowns,
    running: c.running,
    recurring: c.recurring,
    recurringRunning: c.recurringRunning,
  };
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
  // Cooldowns are ADDITIVE and lenient: absent → empty (a pre-feature config is preserved,
  // never wiped), and a single malformed entry is dropped rather than nuking the config.
  const cooldowns = readCooldowns(raw);
  const running = readRunning(raw);
  // Recurring chores are ADDITIVE and lenient too — same posture as cooldowns: absent → empty
  // (a config saved before this feature is preserved, never wiped), and a malformed entry is
  // dropped rather than nuking the config. Deliberately no SCHEMA_VERSION bump (ADR-0003).
  const recurring = readRecurring(raw);
  const recurringRunning = readRecurringRunning(raw);
  return {
    bosses,
    cooldowns,
    running,
    recurring,
    recurringRunning,
    bossSeq: maxIdSeq(bosses.map((b) => b.id), "boss"),
    skillSeq: maxIdSeq(skillIds, "skill"),
    cooldownSeq: maxIdSeq(cooldowns.map((c) => c.id), "cooldown"),
    recurringSeq: maxIdSeq(recurring.map((r) => r.id), "recurring"),
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

// ---- cooldowns (lenient + per-item: a bad entry is dropped, the config is never nuked) ----

/** Validated cooldown catalog, or `[]` when the field is absent (pre-feature config). */
function readCooldowns(raw: unknown): CooldownDef[] {
  if (!isObj(raw) || !Array.isArray(raw.cooldowns)) return [];
  return raw.cooldowns.map(readCooldownDef).filter((c): c is CooldownDef => c !== null);
}

function readCooldownDef(c: unknown): CooldownDef | null {
  if (!isObj(c) || !isStr(c.id) || !isStr(c.name) || !isStr(c.tag) || !isNum(c.durationMs)) return null;
  // rebuild explicitly so unknown extra fields are dropped (matches readBoss/readSkill)
  return { id: c.id, name: c.name, tag: c.tag, durationMs: c.durationMs };
}

/** Validated running cooldowns, or `[]` when absent. Absolute `expiry` is kept verbatim. */
function readRunning(raw: unknown): RunningCooldown[] {
  if (!isObj(raw) || !Array.isArray(raw.running)) return [];
  return raw.running.map(readRunningCooldown).filter((r): r is RunningCooldown => r !== null);
}

function readRunningCooldown(r: unknown): RunningCooldown | null {
  if (!isObj(r) || !isStr(r.defId) || !isNum(r.expiry) || !isNum(r.startedAt)) return null;
  return { defId: r.defId, expiry: r.expiry, startedAt: r.startedAt };
}

// ---- recurring (lenient + per-item, mirroring cooldowns: a bad entry is dropped, never nuked) ----

const isRecurringKind = (v: unknown): v is RecurringKind => v === "gate" || v === "deadline";

/** Validated recurring catalog, or `[]` when the field is absent (pre-feature config). */
function readRecurring(raw: unknown): RecurringDef[] {
  if (!isObj(raw) || !Array.isArray(raw.recurring)) return [];
  return raw.recurring.map(readRecurringDef).filter((r): r is RecurringDef => r !== null);
}

function readRecurringDef(r: unknown): RecurringDef | null {
  if (!isObj(r) || !isStr(r.id) || !isStr(r.name) || !isStr(r.tag) || !isNum(r.durationMs)) return null;
  if (!isRecurringKind(r.kind)) return null; // an unrecognised kind drops the entry (not a default)
  // rebuild explicitly so unknown extra fields are dropped (matches readCooldownDef)
  return { id: r.id, name: r.name, tag: r.tag, durationMs: r.durationMs, kind: r.kind };
}

/** Validated running recurring items, or `[]` when absent. Absolute `expiry` is kept verbatim. */
function readRecurringRunning(raw: unknown): RunningRecurring[] {
  if (!isObj(raw) || !Array.isArray(raw.recurringRunning)) return [];
  return raw.recurringRunning.map(readRunningRecurring).filter((r): r is RunningRecurring => r !== null);
}

function readRunningRecurring(r: unknown): RunningRecurring | null {
  if (!isObj(r) || !isStr(r.defId) || !isNum(r.expiry) || !isNum(r.startedAt)) return null;
  return { defId: r.defId, expiry: r.expiry, startedAt: r.startedAt };
}
