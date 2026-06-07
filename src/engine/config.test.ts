import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  PITCHES,
  FALLBACK_BOSS,
  addBoss,
  addSkill,
  bossById,
  deleteBoss,
  makeConfig,
  removeSkill,
  renameBoss,
  renameSkill,
  setSkillDuration,
  setSkillHotkey,
  type Config,
} from "./config";

// The config model is pure: every op is `(Config, ...) -> Config` with no clock, no
// React, no storage. Ids are deterministic (owned seq counters), so these assertions
// can pin exact ids without any injected randomness.

const lastBoss = (c: Config) => c.bosses[c.bosses.length - 1];

describe("makeConfig", () => {
  it("ships one boss with two distinct-pitch skills", () => {
    const c = makeConfig();
    expect(c.bosses).toHaveLength(1);
    const skills = c.bosses[0].skills;
    expect(skills).toHaveLength(2);
    expect(new Set(skills.map((s) => s.pitch)).size).toBe(2);
  });
});

describe("boss edits", () => {
  it("adds, renames and deletes bosses", () => {
    let c = makeConfig();
    c = addBoss(c);
    expect(c.bosses).toHaveLength(2);

    const id = lastBoss(c).id;
    c = renameBoss(c, id, "Razador");
    expect(bossById(c, id)?.name).toBe("Razador");

    c = deleteBoss(c, id);
    expect(c.bosses.map((b) => b.id)).not.toContain(id);
    expect(c.bosses).toHaveLength(1);
  });

  it("assigns fresh non-colliding ids even after deletes", () => {
    let c = makeConfig();
    const firstId = lastBoss(addBoss(c)).id;
    c = deleteBoss(addBoss(c), firstId); // add then delete it
    c = addBoss(c);
    const ids = c.bosses.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });
});

describe("FALLBACK_BOSS guarantee", () => {
  it("re-seeds a fallback boss when the last one is deleted", () => {
    const c = makeConfig();
    expect(c.bosses).toHaveLength(1);

    const after = deleteBoss(c, c.bosses[0].id);
    expect(after.bosses).toHaveLength(1); // never empty
    const fb = after.bosses[0];
    expect(fb.name).toBe(FALLBACK_BOSS.name);
    expect(fb.accent).toBe(FALLBACK_BOSS.accent);
    expect(fb.skills).toHaveLength(1); // and it isn't skill-less
    expect(fb.id).not.toBe(c.bosses[0].id); // fresh id, no collision
  });
});

describe("accent-colour cycling", () => {
  it("cycles bosses through the accent palette and wraps", () => {
    let c = makeConfig(); // boss-1 -> ACCENTS[0]
    expect(c.bosses[0].accent).toBe(ACCENTS[0][0]);

    while (c.bosses.length < ACCENTS.length + 1) c = addBoss(c);

    c.bosses.forEach((b, i) => expect(b.accent).toBe(ACCENTS[i % ACCENTS.length][0]));
    // the (palette+1)-th boss has wrapped back to the first accent
    expect(lastBoss(c).accent).toBe(ACCENTS[0][0]);
  });
});

describe("skill edits", () => {
  it("adds, renames, sets duration and removes skills", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;

    c = addSkill(c, bid);
    const skills = bossById(c, bid)!.skills;
    expect(skills).toHaveLength(3);

    const sid = skills[skills.length - 1].id;
    c = renameSkill(c, bid, sid, "Stun");
    expect(bossById(c, bid)!.skills.find((s) => s.id === sid)?.label).toBe("Stun");

    c = setSkillDuration(c, bid, sid, 45_000);
    expect(bossById(c, bid)!.skills.find((s) => s.id === sid)?.durationMs).toBe(45_000);

    c = removeSkill(c, bid, sid);
    expect(bossById(c, bid)!.skills.map((s) => s.id)).not.toContain(sid);
  });

  it("clamps duration to a sane range", () => {
    const c = makeConfig();
    const bid = c.bosses[0].id;
    const sid = c.bosses[0].skills[0].id;
    const durOf = (cc: Config) => bossById(cc, bid)!.skills[0].durationMs;

    expect(durOf(setSkillDuration(c, bid, sid, 0))).toBe(1_000); // floor
    expect(durOf(setSkillDuration(c, bid, sid, 5_000_000))).toBe(999_000); // ceiling
  });
});

describe("hotkey binding", () => {
  it("sets and clears a skill's hotkey", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;
    const sid = c.bosses[0].skills[0].id;
    const hkOf = (cc: Config) => bossById(cc, bid)!.skills[0].hotkey;

    c = setSkillHotkey(c, bid, sid, "ctrl+shift+k");
    expect(hkOf(c)).toBe("ctrl+shift+k");

    // clearing removes the field entirely rather than leaving an empty string
    c = setSkillHotkey(c, bid, sid, undefined);
    expect(hkOf(c)).toBeUndefined();
    expect("hotkey" in bossById(c, bid)!.skills[0]).toBe(false);
  });

  it("only touches the targeted skill", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;
    const [s0, s1] = c.bosses[0].skills;
    c = setSkillHotkey(c, bid, s0.id, "k");
    const after = bossById(c, bid)!.skills;
    expect(after[0].hotkey).toBe("k");
    expect(after[1].hotkey).toBeUndefined();
    expect(after[1].id).toBe(s1.id);
  });
});

describe("distinct-pitch assignment", () => {
  it("gives each new skill a distinct pitch until the palette is exhausted", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;
    while (bossById(c, bid)!.skills.length < PITCHES.length) c = addSkill(c, bid);

    const pitches = bossById(c, bid)!.skills.map((s) => s.pitch);
    expect(pitches).toHaveLength(PITCHES.length);
    expect(new Set(pitches).size).toBe(PITCHES.length); // all distinct
  });

  it("falls back to cycling once every palette pitch is in use", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;
    while (bossById(c, bid)!.skills.length <= PITCHES.length) c = addSkill(c, bid);
    // one more skill than the palette has pitches — last one reuses a palette value
    const pitches = bossById(c, bid)!.skills.map((s) => s.pitch);
    expect(PITCHES).toContain(pitches[pitches.length - 1]);
  });
});
