import { describe, expect, it } from "vitest";
import {
  addBoss,
  addSkill,
  makeConfig,
  markRecurring,
  setSkillHotkey,
  setSkillSound,
  activeRecurring,
  activeRecurringRunning,
  activeRecurringProgress,
  activeCharacter,
  type Config,
} from "./config";
import { DEFAULT_CHARACTER_NAME } from "./character";
import { readout, remainingMs, start } from "./cooldown";
import { remainingMs as recurringRemainingMs } from "./recurring";
import { SCHEMA_VERSION, deserialize, serialize } from "./persist";
import { DEFAULT_SOUND_ID } from "./sounds";

// Read the active character's recurring slices (the recurring side relocated under a Character, #47).
const rec = (c: Config) => activeRecurring(c);
const recRun = (c: Config) => activeRecurringRunning(c);
const recProg = (c: Config) => activeRecurringProgress(c);

// A pre-feature persisted boss: a v1 skill that carries `pitch` and no `soundId`, exactly
// as configs saved before this feature look on disk.
const legacyBoss = (pitch = 880) => ({
  id: "boss-1",
  name: "Balathor",
  accent: "#7c6cff",
  accent2: "#6a5bff",
  skills: [{ id: "skill-1", label: "Skill 1", durationMs: 20_000, pitch, hotkey: "ctrl+shift+k" }],
});

// Persistence (de)serialization is pure: no disk, no clock. The store adapter just
// pipes raw JSON through these. Tests simulate the disk round-trip with JSON.

const throughDisk = (c: Config) => JSON.parse(JSON.stringify(serialize(c)));

describe("serialize", () => {
  it("tags the payload with the current schema version", () => {
    expect(serialize(makeConfig()).version).toBe(SCHEMA_VERSION);
  });
});

describe("round-trip", () => {
  it("restores the same bosses/skills through a JSON disk hop", () => {
    let c = makeConfig();
    c = addBoss(c);
    c = addSkill(c, c.bosses[0].id);

    const restored = deserialize(throughDisk(c));
    expect(restored.bosses).toEqual(c.bosses);
  });

  it("preserves skill hotkey bindings through the disk hop", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;
    c = setSkillHotkey(c, bid, c.bosses[0].skills[0].id, "ctrl+shift+k");

    const restored = deserialize(throughDisk(c));
    expect(restored.bosses[0].skills[0].hotkey).toBe("ctrl+shift+k");
  });
});

describe("soundId migration (lenient, no version bump)", () => {
  it("preserves a pre-feature skill and gives it the default sound", () => {
    // The crux: an old config (pitch, no soundId) must NOT reset — boss/skill/duration/
    // hotkey survive intact and the skill simply gains the default sound.
    const restored = deserialize({ version: SCHEMA_VERSION, bosses: [legacyBoss()] });
    expect(restored.bosses).toHaveLength(1);
    const skill = restored.bosses[0].skills[0];
    expect(skill.id).toBe("skill-1");
    expect(skill.durationMs).toBe(20_000);
    expect(skill.hotkey).toBe("ctrl+shift+k");
    expect(skill.soundId).toBe(DEFAULT_SOUND_ID);
  });

  it("drops the legacy pitch field rather than carrying it forward", () => {
    const restored = deserialize({ version: SCHEMA_VERSION, bosses: [legacyBoss()] });
    expect("pitch" in restored.bosses[0].skills[0]).toBe(false);
  });

  it("falls back to the default sound for an unknown soundId", () => {
    const payload = {
      version: SCHEMA_VERSION,
      bosses: [{ ...legacyBoss(), skills: [{ id: "skill-1", label: "S", durationMs: 1000, soundId: "trumpet" }] }],
    };
    expect(deserialize(payload).bosses[0].skills[0].soundId).toBe(DEFAULT_SOUND_ID);
  });

  it("round-trips a valid soundId through the disk hop", () => {
    let c = makeConfig();
    c = setSkillSound(c, c.bosses[0].id, c.bosses[0].skills[0].id, "chime");
    const restored = deserialize(throughDisk(c));
    expect(restored.bosses[0].skills[0].soundId).toBe("chime");
  });

  it("serialize omits the legacy pitch field entirely", () => {
    const json = JSON.stringify(serialize(makeConfig()));
    expect(json).not.toContain("pitch");
  });
});

describe("cooldown persistence (additive, no version bump)", () => {
  it("round-trips the cooldown catalog and running instances through a disk hop", () => {
    let c = makeConfig();
    // start one running cooldown so both the catalog and the running set are exercised
    c = { ...c, running: start(c.running, c.cooldowns[0], 1_000) };

    const restored = deserialize(throughDisk(c));
    expect(restored.cooldowns).toEqual(c.cooldowns);
    expect(restored.running).toEqual(c.running);
    expect(restored.cooldownSeq).toBe(c.cooldownSeq); // seq seeded past the persisted ids
  });

  it("keeps a pre-feature config intact with an empty cooldown catalog (never wipes)", () => {
    // a config saved before cooldowns existed: valid bosses, no cooldown fields at all
    const preFeature = { version: SCHEMA_VERSION, bosses: serialize(makeConfig()).bosses };
    const restored = deserialize(preFeature);
    expect(restored.bosses).toEqual(makeConfig().bosses); // bosses/skills survive
    expect(restored.cooldowns).toEqual([]); // default empty, not the seeded catalog
    expect(restored.running).toEqual([]);
    expect(restored.cooldownSeq).toBe(0);
  });

  it("drops a malformed cooldown entry without nuking the rest of the config", () => {
    const valid = { id: "cooldown-1", name: "Hydra", tag: "Hyd", durationMs: 900_000 };
    const payload = {
      version: SCHEMA_VERSION,
      bosses: serialize(makeConfig()).bosses,
      cooldowns: [valid, { id: "cooldown-2", name: "Bad" /* no durationMs */ }],
    };
    const restored = deserialize(payload);
    expect(restored.bosses.length).toBeGreaterThan(0); // config survives
    expect(restored.cooldowns).toEqual([valid]); // bad entry dropped, good one kept
  });

  it("is at the multi-character schema version (v1 still migrates, never wipes — see migration suite)", () => {
    expect(SCHEMA_VERSION).toBe(2);
  });

  it("restores a running cooldown whose expiry already passed as Ready", () => {
    const now = 10_000_000;
    const payload = {
      version: SCHEMA_VERSION,
      bosses: serialize(makeConfig()).bosses,
      running: [{ defId: "cooldown-1", expiry: now - 30 * 60_000, startedAt: now - 90 * 60_000 }],
    };
    const r = deserialize(payload).running[0];
    expect(r.expiry).toBe(now - 30 * 60_000); // absolute expiry restored verbatim
    expect(remainingMs(r, now)).toBe(0);
    expect(readout(remainingMs(r, now))).toBe("Ready"); // silent, sticky Ready on launch
  });
});

// Install a rank on the active character (the "user already has progress in hand" disk setup).
const withActiveProgress = (c: Config, progress: { defId: string; position: number }[]): Config => ({
  ...c,
  characters: c.characters.map((ch) => (ch.id === c.activeCharacterId ? { ...ch, recurringProgress: progress } : ch)),
});

describe("character persistence — v2 round-trip (#47)", () => {
  it("round-trips the active character's recurring catalog and running instances through a disk hop", () => {
    let c = makeConfig();
    // mark one item done so both the catalog and the running set are exercised
    c = markRecurring(c, rec(c)[0].id, 1_000);

    const restored = deserialize(throughDisk(c));
    expect(restored.characters).toEqual(c.characters); // the whole character (incl. its slices) survives
    expect(rec(restored)).toEqual(rec(c));
    expect(recRun(restored)).toEqual(recRun(c));
    expect(restored.activeCharacterId).toBe(c.activeCharacterId);
    expect(restored.recurringSeq).toBe(c.recurringSeq); // seq seeded past the persisted ids
    expect(restored.characterSeq).toBe(c.characterSeq);
  });

  it("round-trips the ladder progress map and a def's ladderId (#44)", () => {
    const base = makeConfig();
    const c = withActiveProgress(base, [{ defId: rec(base)[3].id, position: 12 }]); // Skill Books rank
    const restored = deserialize(throughDisk(c));
    expect(recProg(restored)).toEqual(recProg(c));
    expect(rec(restored)[3].ladderId).toBe("class-skill"); // ladderId survives the disk hop
  });

  it("keeps two characters' chore slices isolated and preserves the active id", () => {
    const payload = {
      version: 2,
      bosses: serialize(makeConfig()).bosses,
      cooldowns: [],
      running: [],
      characters: [
        {
          id: "character-1",
          name: "Warrior",
          empire: "Shinsoo",
          race: "Warrior",
          builds: ["Body"],
          recurring: [{ id: "recurring-1", name: "A", durationMs: 1000, kind: "gate" }],
          recurringRunning: [],
          recurringProgress: [],
        },
        {
          id: "character-2",
          name: "Sura",
          recurring: [{ id: "recurring-2", name: "B", durationMs: 2000, kind: "deadline" }],
          recurringRunning: [],
          recurringProgress: [],
        },
      ],
      activeCharacterId: "character-2",
    };
    const restored = deserialize(payload);
    expect(restored.characters).toHaveLength(2);
    expect(restored.activeCharacterId).toBe("character-2");
    expect(restored.characters[0].empire).toBe("Shinsoo");
    expect(restored.characters[0].race).toBe("Warrior");
    expect(restored.characters[0].builds).toEqual(["Body"]);
    expect(rec(restored).map((d) => d.id)).toEqual(["recurring-2"]); // active char's catalog only
    expect(restored.characterSeq).toBe(2); // seeded past character-2
    expect(restored.recurringSeq).toBe(2); // seeded past the max recurring id across all characters
  });

  it("re-points a dangling activeCharacterId to the first surviving character", () => {
    const payload = {
      version: 2,
      bosses: serialize(makeConfig()).bosses,
      characters: [{ id: "character-1", name: "Main", builds: [], recurring: [], recurringRunning: [], recurringProgress: [] }],
      activeCharacterId: "character-999", // points at no surviving character
    };
    expect(deserialize(payload).activeCharacterId).toBe("character-1");
  });

  it("drops a malformed character (no id/name) without nuking the rest", () => {
    const payload = {
      version: 2,
      bosses: serialize(makeConfig()).bosses,
      characters: [
        { id: "character-1", name: "Main", builds: [], recurring: [], recurringRunning: [], recurringProgress: [] },
        { name: "no id" }, // malformed — dropped
      ],
      activeCharacterId: "character-1",
    };
    expect(deserialize(payload).characters).toHaveLength(1);
  });

  it("drops an unknown empire/race on a character but keeps the character (lenient)", () => {
    const payload = {
      version: 2,
      bosses: serialize(makeConfig()).bosses,
      characters: [
        { id: "character-1", name: "Main", empire: "Atlantis", race: "Dragoon", builds: [], recurring: [], recurringRunning: [], recurringProgress: [] },
      ],
      activeCharacterId: "character-1",
    };
    const ch = activeCharacter(deserialize(payload))!;
    expect(ch.empire).toBeUndefined(); // unknown empire dropped
    expect(ch.race).toBeUndefined(); // unknown race dropped
  });
});

describe("v1 → v2 migration (default-character wrap)", () => {
  // A legacy singleton config exactly as it sat on disk before multi-character: recurring data at the
  // TOP level, no `characters`. Bosses/cooldowns/running are global and must pass through untouched.
  const legacyV1 = () => ({
    version: 1,
    bosses: serialize(makeConfig()).bosses,
    cooldowns: serialize(makeConfig()).cooldowns,
    running: [{ defId: "cooldown-1", expiry: 5_000, startedAt: 1_000 }],
    recurring: [
      { id: "recurring-1", name: "Snow Wolf", durationMs: 259_200_000, kind: "deadline" },
      { id: "recurring-4", name: "Skill Books", durationMs: 86_400_000, kind: "gate", ladderId: "class-skill" },
    ],
    recurringRunning: [{ defId: "recurring-1", expiry: 9_000, startedAt: 1_000 }],
    recurringProgress: [{ defId: "recurring-4", position: 12 }],
  });

  it("wraps the legacy recurring data into one active default character, empire/race unset", () => {
    const legacy = legacyV1();
    const restored = deserialize(legacy);

    expect(restored.characters).toHaveLength(1);
    const ch = activeCharacter(restored)!;
    expect(restored.activeCharacterId).toBe(ch.id);
    expect(ch.id).toBe("character-1");
    expect(ch.name).toBe(DEFAULT_CHARACTER_NAME);
    expect(ch.empire).toBeUndefined();
    expect(ch.race).toBeUndefined();
    expect(ch.builds).toEqual([]);
    // the prior recurring/running/progress are now the default character's, intact
    expect(ch.recurring).toEqual(legacy.recurring);
    expect(ch.recurringRunning).toEqual(legacy.recurringRunning);
    expect(ch.recurringProgress).toEqual(legacy.recurringProgress);
    // seqs seeded past the migrated ids
    expect(restored.characterSeq).toBe(1);
    expect(restored.recurringSeq).toBe(4);
  });

  it("leaves bosses, cooldowns and the running cooldown set untouched by the migration", () => {
    const legacy = legacyV1();
    const restored = deserialize(legacy);
    expect(restored.bosses).toEqual(legacy.bosses);
    expect(restored.cooldowns).toEqual(legacy.cooldowns);
    expect(restored.running).toEqual(legacy.running); // global side survives verbatim
  });

  it("migrates a pre-recurring v1 config into an empty default character (never wipes)", () => {
    const v1NoRecurring = {
      version: 1,
      bosses: serialize(makeConfig()).bosses,
      cooldowns: serialize(makeConfig()).cooldowns,
    };
    const restored = deserialize(v1NoRecurring);
    expect(restored.cooldowns.length).toBeGreaterThan(0); // the older cooldown feature survives
    expect(restored.characters).toHaveLength(1); // an owner still exists for the recurring tools
    expect(rec(restored)).toEqual([]); // empty bag, not the seeded catalog
    expect(recRun(restored)).toEqual([]);
    expect(restored.recurringSeq).toBe(0);
    expect(restored.characterSeq).toBe(1);
  });

  it("drops a malformed recurring entry + legacy tag while migrating, without nuking the rest", () => {
    const expected = { id: "recurring-1", name: "Snow Wolf", durationMs: 259_200_000, kind: "deadline" };
    const payload = {
      version: 1,
      bosses: serialize(makeConfig()).bosses,
      recurring: [
        { id: "recurring-1", name: "Snow Wolf", tag: "Sno", durationMs: 259_200_000, kind: "deadline" }, // legacy tag stripped
        { id: "recurring-2", name: "Bad kind", durationMs: 1000, kind: "weekly" }, // not gate|deadline → dropped
        { id: "recurring-3", name: "No duration", kind: "gate" }, // missing durationMs → dropped
      ],
    };
    const restored = deserialize(payload);
    expect(restored.bosses.length).toBeGreaterThan(0); // config survives
    expect(rec(restored)).toEqual([expected]); // tag stripped, bad entries dropped, good one kept
  });

  it("drops a malformed progress entry while migrating", () => {
    const payload = {
      version: 1,
      bosses: serialize(makeConfig()).bosses,
      recurringProgress: [
        { defId: "recurring-4", position: 7 },
        { defId: "recurring-5" }, // missing position
        { position: 3 }, // missing defId
      ],
    };
    expect(recProg(deserialize(payload))).toEqual([{ defId: "recurring-4", position: 7 }]);
  });

  it("restores a migrated running recurring whose expiry already passed as past-zero (silent)", () => {
    const now = 10_000_000;
    const payload = {
      version: 1,
      bosses: serialize(makeConfig()).bosses,
      recurringRunning: [{ defId: "recurring-1", expiry: now - 30 * 60_000, startedAt: now - 90 * 60_000 }],
    };
    const r = recRun(deserialize(payload))[0];
    expect(r.expiry).toBe(now - 30 * 60_000); // absolute expiry restored verbatim
    expect(recurringRemainingMs(r, now)).toBe(0);
    expect(readout(recurringRemainingMs(r, now))).toBe("Ready"); // silent, sticky past-zero on launch
  });
});

describe("id-sequence seeding", () => {
  it("seeds counters past the max persisted id so reloaded ids don't collide", () => {
    // a default config has boss-1 and skill-1 / skill-2
    const restored = deserialize(throughDisk(makeConfig()));
    expect(restored.bossSeq).toBe(1);
    expect(restored.skillSeq).toBe(2);

    // ids minted after reload must not collide with restored ones
    const grown = addSkill(addBoss(restored), restored.bosses[0].id);
    const ids = [
      ...grown.bosses.map((b) => b.id),
      ...grown.bosses.flatMap((b) => b.skills.map((s) => s.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(grown.bosses[grown.bosses.length - 1].id).toBe("boss-2");
  });

  it("seeds past the true max even when ids are sparse/out of order", () => {
    const payload = {
      version: SCHEMA_VERSION,
      bosses: [
        { id: "boss-5", name: "B", accent: "#fff", accent2: "#000", skills: [{ id: "skill-9", label: "S", durationMs: 1000, pitch: 880 }] },
      ],
    };
    const restored = deserialize(payload);
    expect(restored.bossSeq).toBe(5);
    expect(restored.skillSeq).toBe(9);
    expect(addBoss(restored).bosses[1].id).toBe("boss-6");
  });
});

describe("fallback to shipped defaults", () => {
  const defaults = makeConfig();
  const expectDefaults = (raw: unknown) => {
    const c = deserialize(raw);
    expect(c.bosses).toHaveLength(defaults.bosses.length);
    expect(c.bosses[0].skills).toHaveLength(defaults.bosses[0].skills.length);
  };

  it("falls back on null / non-object", () => {
    expectDefaults(null);
    expectDefaults(undefined);
    expectDefaults(42);
  });

  it("falls back on a missing/unknown schema version", () => {
    expectDefaults({ bosses: [] });
    expectDefaults({ version: 999, bosses: [] });
  });

  it("falls back when bosses isn't an array or a boss is malformed", () => {
    expectDefaults({ version: SCHEMA_VERSION, bosses: "nope" });
    expectDefaults({ version: SCHEMA_VERSION, bosses: [{ id: "boss-1" /* missing fields */ }] });
    expectDefaults({
      version: SCHEMA_VERSION,
      bosses: [{ id: "boss-1", name: "B", accent: "#fff", accent2: "#000", skills: [{ id: "x", label: "S" /* no duration */ }] }],
    });
  });

  it("falls back on an empty boss list so the overlay is never empty", () => {
    expectDefaults({ version: SCHEMA_VERSION, bosses: [] });
  });
});
