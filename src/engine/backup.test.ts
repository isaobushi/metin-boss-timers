import { describe, expect, it } from "vitest";
import { addBoss, addCharacter, makeConfig } from "./config";
import { serialize } from "./persist";
import { partition } from "./entitlement";
import { exportConfig, importConfig } from "./backup";

// A non-trivial config: the shipped defaults plus an extra boss and two extra characters.
const sampleConfig = () => {
  let c = makeConfig();
  c = addBoss(c);
  c = addCharacter(c, { name: "Alt One" });
  c = addCharacter(c, { name: "Alt Two" });
  return c;
};

describe("backup export/import", () => {
  it("round-trips a config exactly through export → import", () => {
    const c = sampleConfig();
    const restored = importConfig(exportConfig(c));
    // Compare via serialize: the data fields (not the recomputed seq counters) must match exactly.
    expect(restored).not.toBeNull();
    expect(serialize(restored!)).toEqual(serialize(c));
  });

  it("returns null for anything that isn't a recognised backup (never silently wipes)", () => {
    expect(importConfig("not json at all")).toBeNull();
    expect(importConfig("{}")).toBeNull(); // valid JSON, no format marker
    expect(importConfig(JSON.stringify({ format: "something-else", config: {} }))).toBeNull();
    expect(importConfig("[]")).toBeNull();
  });

  it("preserves over-cap data on import so the gate freezes (not drops) the excess", () => {
    // Export a 3-character (Pro-built) backup, then import it into an unsubscribed (`never`) state.
    const pro = sampleConfig(); // default Main + 2 alts = 3 characters
    const imported = importConfig(exportConfig(pro))!;
    // All three characters are RESTORED — nothing dropped by the lower tier.
    expect(imported.characters).toHaveLength(3);
    // The gate's view under `never` lands exactly one live (the cap) and the rest frozen-but-present.
    const split = partition("never", imported);
    expect(split.characters.live).toHaveLength(1);
    expect(split.characters.frozen).toHaveLength(2);
  });

  it("carries bosses and cooldowns through import unchanged, regardless of tier", () => {
    const c = sampleConfig();
    const imported = importConfig(exportConfig(c))!;
    // Bosses + cooldowns are global data; the backup preserves them exactly (tier never filters them).
    expect(imported.bosses).toEqual(c.bosses);
    expect(imported.cooldowns).toEqual(c.cooldowns);
    // And cooldowns are not even a gated collection — the gate's partition has no cooldown split.
    expect(partition("never", imported)).not.toHaveProperty("cooldowns");
  });
});
