import { describe, expect, it } from "vitest";
import { allows, capsFor, liveCharacterId, partition } from "./entitlement";
import { addBoss, makeConfig, type Config } from "./config";
import { makeCharacter } from "./character";
import type { RecurringDef } from "./recurring";

// A fresh config carries exactly one boss ("Balathor"); chain `addBoss` to reach the over-cap shapes.
const withBosses = (count: number): Config => {
  let c = makeConfig();
  while (c.bosses.length < count) c = addBoss(c);
  return c;
};

// Build a config with N characters (ids character-1..N) and a chosen active pointer, reusing the real
// constructor so the shape stays honest. Bosses/cooldowns are irrelevant to character/reminder tests.
const withCharacters = (count: number, activeCharacterId: string | null): Config => ({
  ...makeConfig(),
  characters: Array.from({ length: count }, (_, i) => makeCharacter(`character-${i + 1}`, `Char ${i + 1}`)),
  activeCharacterId,
});

// The entitlement gate (PRD #48, issue #53) is the sole owner of "what is allowed in this tier".
// Like the rest of the engine it's pure: every export is a function of (Entitlement, Config) with no
// clock, no I/O, no Store. These tests assert external behaviour only — feed a state + config, assert
// the returned caps/partition/verdict — never reaching into implementation structure.

describe("capsFor", () => {
  it("caps Lite (never/lapsed) at 1 boss / 0 prebuilt / 3 reminders / 1 character, cooldowns uncapped", () => {
    for (const state of ["never", "lapsed"] as const) {
      expect(capsFor(state)).toEqual({
        bosses: 1,
        prebuiltSequences: 0,
        cooldowns: null,
        reminders: 3,
        characters: 1,
      });
    }
  });

  it("lifts every cap for Pro (subscribed/trial) — all uncapped", () => {
    for (const state of ["subscribed", "trial"] as const) {
      expect(capsFor(state)).toEqual({
        bosses: null,
        prebuiltSequences: null,
        cooldowns: null,
        reminders: null,
        characters: null,
      });
    }
  });
});

describe("liveCharacterId — the most-recently-active character kept live on lapse", () => {
  it("is the active pointer when it points at a real character", () => {
    expect(liveCharacterId(withCharacters(3, "character-2"))).toBe("character-2");
  });

  it("falls back to the first character when the pointer is null or dangles", () => {
    expect(liveCharacterId(withCharacters(3, null))).toBe("character-1");
    expect(liveCharacterId(withCharacters(3, "character-99"))).toBe("character-1");
  });

  it("is null when there are no characters", () => {
    expect(liveCharacterId(withCharacters(0, null))).toBeNull();
  });
});

describe("partition — bosses (cap 1 under Lite)", () => {
  it("keeps the first boss live and freezes the excess under Lite", () => {
    const c = withBosses(3);
    const { bosses } = partition("lapsed", c);
    expect(bosses.live).toEqual([c.bosses[0].id]);
    expect(bosses.frozen).toEqual([c.bosses[1].id, c.bosses[2].id]);
  });

  it("keeps every boss live under Pro", () => {
    const c = withBosses(3);
    const { bosses } = partition("subscribed", c);
    expect(bosses.live).toEqual(c.bosses.map((b) => b.id));
    expect(bosses.frozen).toEqual([]);
  });
});

describe("partition — characters (cap 1 under Lite)", () => {
  it("keeps the most-recently-active character live (not merely the first) and freezes the rest", () => {
    const c = withCharacters(3, "character-2");
    const { characters } = partition("lapsed", c);
    expect(characters.live).toEqual(["character-2"]);
    expect(characters.frozen).toEqual(["character-1", "character-3"]);
  });

  it("keeps every character live under Pro", () => {
    const c = withCharacters(3, "character-2");
    const { characters } = partition("subscribed", c);
    expect(characters.live).toEqual(["character-1", "character-2", "character-3"]);
    expect(characters.frozen).toEqual([]);
  });
});

// A reminder is any recurring item (gate Routine OR deadline Elapsable) — the cap is a SHARED pool.
const reminderDefs = (count: number): RecurringDef[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `recurring-${i + 1}`,
    name: `R${i + 1}`,
    durationMs: 1000,
    kind: i % 2 === 0 ? "gate" : "deadline",
  }));

// One active character owning `count` reminders, so the pool partition has something to cap.
const withReminders = (count: number): Config => ({
  ...makeConfig(),
  characters: [makeCharacter("character-1", "Main", { recurring: reminderDefs(count) })],
  activeCharacterId: "character-1",
});

describe("partition — reminders (the live character's shared pool, cap 3 under Lite)", () => {
  it("keeps the first 3 reminders live and freezes the excess under Lite", () => {
    const { reminders } = partition("lapsed", withReminders(5));
    expect(reminders.live).toEqual(["recurring-1", "recurring-2", "recurring-3"]);
    expect(reminders.frozen).toEqual(["recurring-4", "recurring-5"]);
  });

  it("keeps every reminder live under Pro", () => {
    const { reminders } = partition("subscribed", withReminders(5));
    expect(reminders.live).toHaveLength(5);
    expect(reminders.frozen).toEqual([]);
  });
});

// A config that is over every Lite cap: 3 bosses, 3 characters, and 5 reminders on the live character.
const overCap = (): Config => ({
  ...withBosses(3),
  characters: [
    makeCharacter("character-1", "Main", { recurring: reminderDefs(5) }),
    makeCharacter("character-2", "Alt"),
    makeCharacter("character-3", "Mule"),
  ],
  activeCharacterId: "character-1",
});

describe("never vs lapsed — same caps, distinguished by what the config holds", () => {
  it("a never-paid user within the caps has nothing frozen (clean)", () => {
    const p = partition("never", makeConfig()); // shipped default: 1 boss, 1 character
    expect(p.bosses.frozen).toEqual([]);
    expect(p.characters.frozen).toEqual([]);
  });

  it("a lapsed over-cap user has the excess frozen-but-present (not dropped)", () => {
    const p = partition("lapsed", overCap());
    expect(p.bosses.frozen).toHaveLength(2);
    expect(p.characters.frozen).toEqual(["character-2", "character-3"]);
    expect(p.reminders.frozen).toEqual(["recurring-4", "recurring-5"]);
  });
});

describe("thaw — returning to a Pro state restores everything with zero data loss", () => {
  it("re-partitioning the SAME config under subscribed makes every frozen item live again", () => {
    const c = overCap();
    const frozenView = partition("lapsed", c);
    expect(frozenView.bosses.frozen.length + frozenView.characters.frozen.length).toBeGreaterThan(0);

    const thawed = partition("subscribed", c);
    expect(thawed.bosses.frozen).toEqual([]);
    expect(thawed.characters.frozen).toEqual([]);
    expect(thawed.reminders.frozen).toEqual([]);
    // every id present before is live after — nothing was lost in the transition
    expect(thawed.bosses.live).toEqual(c.bosses.map((b) => b.id));
    expect(thawed.characters.live).toEqual(["character-1", "character-2", "character-3"]);
  });
});

describe("allows — the write-path seam: is this add permitted?", () => {
  it("refuses a 2nd boss, a 2nd character, and a 4th reminder while at the Lite caps", () => {
    const c: Config = {
      ...makeConfig(), // 1 boss, 1 character
      characters: [makeCharacter("character-1", "Main", { recurring: reminderDefs(3) })],
      activeCharacterId: "character-1",
    };
    expect(allows("lapsed", c, "addBoss")).toBe(false);
    expect(allows("lapsed", c, "addCharacter")).toBe(false);
    expect(allows("lapsed", c, "addReminder")).toBe(false);
  });

  it("permits an add while still under a Lite cap", () => {
    const empty: Config = {
      ...makeConfig(),
      bosses: [],
      characters: [makeCharacter("character-1", "Main", { recurring: reminderDefs(2) })],
      activeCharacterId: "character-1",
    };
    expect(allows("lapsed", empty, "addBoss")).toBe(true); // 0 < 1
    expect(allows("lapsed", empty, "addReminder")).toBe(true); // 2 < 3
  });

  it("permits everything under a Pro state (uncapped) regardless of how full the config is", () => {
    const c = overCap();
    expect(allows("subscribed", c, "addBoss")).toBe(true);
    expect(allows("subscribed", c, "addCharacter")).toBe(true);
    expect(allows("subscribed", c, "addReminder")).toBe(true);
  });
});
