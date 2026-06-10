// Pure persistence (de)serialization: the testable core of slice #4, with no Tauri,
// no clock, no I/O. `serialize` turns the live `Config` into a versioned, on-disk-ready
// payload; `deserialize` validates an arbitrary value back into a `Config`, falling
// back to shipped defaults on anything malformed. The on-disk store adapter (Tauri
// plugin-store) lives separately and just hands raw values through these two functions.

import { type Boss, type Config, type SkillCfg, makeConfig } from "./config";
import { type Character, DEFAULT_CHARACTER_NAME, makeCharacter } from "./character";
import type { CooldownDef, RunningCooldown } from "./cooldown";
import type { RecurringDef, RecurringKind, RecurringProgress, RunningRecurring } from "./recurring";
import type { Build, Empire, Race } from "./skillCatalog";
import { DEFAULT_SOUND_ID, isSoundId } from "./sounds";

/**
 * Bumped whenever the persisted shape changes; future migrations branch on it. v2 (multi-character,
 * PRD #47) moves the recurring side under per-character bags; v1 is the legacy singleton shape, which
 * `deserialize` MIGRATES rather than rejects. Any other version deserializes to shipped defaults.
 */
export const SCHEMA_VERSION = 2;

/** The persisted shapes `deserialize` understands: the current v2 and the migratable legacy v1. */
const isKnownVersion = (v: unknown): boolean => v === 1 || v === 2;

export type PersistedConfig = {
  version: number;
  bosses: Boss[];
  cooldowns: CooldownDef[];
  /** Running cooldowns persist their ABSOLUTE expiry, so they keep counting while closed. */
  running: RunningCooldown[];
  /** The player's characters — each owns its recurring catalog/running set/ladder progress (#47). */
  characters: Character[];
  /** Which character is active (null = none). Re-pointed to a survivor on load if it dangles. */
  activeCharacterId: string | null;
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
    characters: c.characters,
    activeCharacterId: c.activeCharacterId,
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
  // Characters own the recurring side (PRD #47). A v2 payload carries an explicit `characters` list;
  // a v1 (legacy singleton) payload is MIGRATED — its top-level recurring data is wrapped into one
  // default character — so existing users lose no chores on upgrade. Bosses/cooldowns are global and
  // deserialize identically for both versions.
  const characters = readCharacters(raw);
  const activeCharacterId = readActiveCharacterId(raw, characters);

  // `recurringSeq` is global (ids unique across every character), so seed it past the max recurring
  // id found in ANY character's catalog; `characterSeq` past the max `character-N`.
  const recurringIds = characters.flatMap((ch) => ch.recurring.map((d) => d.id));
  return {
    bosses,
    cooldowns,
    running,
    characters,
    activeCharacterId,
    bossSeq: maxIdSeq(bosses.map((b) => b.id), "boss"),
    skillSeq: maxIdSeq(skillIds, "skill"),
    cooldownSeq: maxIdSeq(cooldowns.map((c) => c.id), "cooldown"),
    recurringSeq: maxIdSeq(recurringIds, "recurring"),
    characterSeq: maxIdSeq(characters.map((ch) => ch.id), "character"),
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
  // Accept BOTH the current v2 and the legacy v1 (which `readCharacters` migrates); any other version
  // (missing/future/garbage) falls through to shipped defaults. This gate must admit v1 — rejecting it
  // here would wipe every pre-multi-character config to defaults on first launch after upgrade.
  if (!isObj(raw) || !isKnownVersion(raw.version) || !Array.isArray(raw.bosses)) return null;
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
  if (!isObj(r) || !isStr(r.id) || !isStr(r.name) || !isNum(r.durationMs)) return null;
  if (!isRecurringKind(r.kind)) return null; // an unrecognised kind drops the entry (not a default)
  // rebuild explicitly so unknown extra fields are dropped — incl. a legacy `tag` from older configs
  const def: RecurringDef = { id: r.id, name: r.name, durationMs: r.durationMs, kind: r.kind };
  // ladderId is optional + lenient: keep a valid string (the ladder lookup tolerates an unknown id),
  // drop anything else — a pre-ladder config simply has no rank, exactly as it did before #44.
  if (isStr(r.ladderId)) def.ladderId = r.ladderId;
  return def;
}

// ---- recurring progress (lenient + per-item, mirroring the running set) ----

/** Validated ladder progress map, or `[]` when absent (a pre-ladder config — preserved, never nuked). */
function readRecurringProgress(raw: unknown): RecurringProgress[] {
  if (!isObj(raw) || !Array.isArray(raw.recurringProgress)) return [];
  return raw.recurringProgress.map(readProgressEntry).filter((p): p is RecurringProgress => p !== null);
}

function readProgressEntry(p: unknown): RecurringProgress | null {
  if (!isObj(p) || !isStr(p.defId) || !isNum(p.position)) return null;
  return { defId: p.defId, position: p.position };
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

// ---- characters (#47) — the recurring side's owner; v2 reads them, v1 migrates into one default ----

const EMPIRES: Empire[] = ["Shinsoo", "Chunjo", "Jinno"];
const RACES: Race[] = ["Warrior", "Ninja", "Sura", "Shaman", "Lycan"];
const isEmpire = (v: unknown): v is Empire => isStr(v) && (EMPIRES as string[]).includes(v);
const isRace = (v: unknown): v is Race => isStr(v) && (RACES as string[]).includes(v);

/**
 * The characters list. A v2 payload carries an explicit `characters` array (validated per-item,
 * lenient — a malformed character is dropped, the rest survive). Anything WITHOUT a `characters` array
 * is treated as the legacy v1 singleton and MIGRATED: its top-level recurring/running/progress are
 * wrapped into one default character (empire/race unset), so the recurring tools keep their data and
 * gain an owner. The recurring sub-readers are reused verbatim — they read `.recurring`/etc. off
 * whatever object they're handed: the top-level `raw` for the v1 migration, the character for v2.
 */
function readCharacters(raw: unknown): Character[] {
  if (isObj(raw) && Array.isArray(raw.characters)) {
    return raw.characters.map(readCharacter).filter((c): c is Character => c !== null);
  }
  return [
    makeCharacter("character-1", DEFAULT_CHARACTER_NAME, {
      recurring: readRecurring(raw),
      recurringRunning: readRecurringRunning(raw),
      recurringProgress: readRecurringProgress(raw),
    }),
  ];
}

/** Validate one persisted character; null (dropped) if it lacks an id/name. Slices are lenient. */
function readCharacter(c: unknown): Character | null {
  if (!isObj(c) || !isStr(c.id) || !isStr(c.name)) return null;
  const ch = makeCharacter(c.id, c.name, {
    recurring: readRecurring(c),
    recurringRunning: readRecurringRunning(c),
    recurringProgress: readRecurringProgress(c),
  });
  // empire/race are optional (unset on a migrated default) + lenient: keep only known values.
  if (isEmpire(c.empire)) ch.empire = c.empire;
  if (isRace(c.race)) ch.race = c.race;
  // builds are the create flow's (#54) free-form strings; keep the string entries, drop anything else.
  if (Array.isArray(c.builds)) ch.builds = c.builds.filter(isStr) as Build[];
  return ch;
}

/**
 * The active character id: the persisted value if it points at a surviving character, else the first
 * character's id (the migrated default), else null. Keeps `activeCharacterId` from dangling after the
 * character it referenced was dropped as malformed (or after a v1 migration that minted a fresh id).
 */
function readActiveCharacterId(raw: unknown, characters: Character[]): string | null {
  const ids = new Set(characters.map((c) => c.id));
  if (isObj(raw) && isStr(raw.activeCharacterId) && ids.has(raw.activeCharacterId)) return raw.activeCharacterId;
  return characters[0]?.id ?? null;
}
