import { describe, expect, it } from "vitest";
import { addBoss, addSkill, makeConfig, setSkillHotkey, setSkillSound, type Config } from "./config";
import { SCHEMA_VERSION, deserialize, serialize } from "./persist";
import { DEFAULT_SOUND_ID } from "./sounds";

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
