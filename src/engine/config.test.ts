import { describe, expect, it } from "vitest";
import {
  ACCENTS,
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
  setSkillSound,
  startCooldown,
  restartCooldown,
  setCooldownDuration,
  duplicateCooldown,
  addCooldown,
  renameCooldown,
  retagCooldown,
  removeCooldown,
  clearCooldown,
  markRecurring,
  addRecurring,
  renameRecurring,
  setRecurringDuration,
  removeRecurring,
  type Config,
} from "./config";
import { inAlarm } from "./recurring";
import { DEFAULT_SOUND_ID, SOUND_IDS, isSoundId } from "./sounds";

// The config model is pure: every op is `(Config, ...) -> Config` with no clock, no
// React, no storage. Ids are deterministic (owned seq counters), so these assertions
// can pin exact ids without any injected randomness.

const lastBoss = (c: Config) => c.bosses[c.bosses.length - 1];

describe("makeConfig", () => {
  it("ships one boss with two distinct-sound skills and no residual pitch", () => {
    const c = makeConfig();
    expect(c.bosses).toHaveLength(1);
    const skills = c.bosses[0].skills;
    expect(skills).toHaveLength(2);
    expect(skills.every((s) => isSoundId(s.soundId))).toBe(true);
    expect(new Set(skills.map((s) => s.soundId)).size).toBe(2); // distinct by default
    expect(skills.some((s) => "pitch" in s)).toBe(false); // pitch fully removed
  });

  it("seeds the example dungeon cooldowns with their tags and durations", () => {
    const M = 60_000;
    const H = 3_600_000;
    const c = makeConfig();
    // examples-not-gospel defaults: name, auto-tag, duration
    expect(c.cooldowns.map((cd) => [cd.name, cd.tag, cd.durationMs])).toEqual([
      ["Hydra", "Hyd", 15 * M],
      ["Razador", "Raz", 1 * H],
      ["Nemere", "Nem", 4 * H],
      ["Meley", "Mel", 3 * H],
      ["Balathor", "Bal", 3 * H],
      ["Northwind War Chief", "Nor", 1 * H],
    ]);
    expect(new Set(c.cooldowns.map((cd) => cd.id)).size).toBe(6); // ids are distinct
    expect(c.cooldownSeq).toBe(6); // seq seeded past the last seeded id
    expect(c.running).toEqual([]); // nothing running on a fresh install
  });

  it("seeds the example recurring items — deadline expiring items AND gate routines — with durations, kind", () => {
    const H = 3_600_000;
    const D = 86_400_000;
    const c = makeConfig();
    // examples-not-gospel defaults: name, duration, kind (no tag — recurring items carry none).
    // Deadlines (♻ items) seed first, then the gate routines (✓) — both flavours ship non-empty.
    expect(c.recurring.map((r) => [r.name, r.durationMs, r.kind])).toEqual([
      ["Snow Wolf", 3 * D, "deadline"],
      ["Costume of Flame", 14 * D, "deadline"],
      ["Battle Horse", 18 * H, "deadline"],
      ["Skill Books", 24 * H, "gate"],
      ["Transformation", 24 * H, "gate"],
      ["Inspiration", 24 * H, "gate"],
      ["Charisma", 24 * H, "gate"],
      ["Mining", 24 * H, "gate"],
      ["Leadership", 24 * H, "gate"],
      ["Jinno Language", 24 * H, "gate"],
      ["Chunjo Language", 24 * H, "gate"],
      ["Shinsoo Language", 24 * H, "gate"],
      ["Biologist", 22 * H, "gate"],
    ]);
    expect(new Set(c.recurring.map((r) => r.id)).size).toBe(13); // ids are distinct
    expect(c.recurringSeq).toBe(13); // seq seeded past the last seeded id
    expect(c.recurringRunning).toEqual([]); // nothing running on a fresh install (mark-done starts an item)
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

  it("preserves the cooldown catalog through boss add and delete", () => {
    // bosses and cooldowns are independent categories — editing one must never wipe
    // the other (the running set + catalog ride alongside the bosses in Config).
    const seeded = makeConfig().cooldowns;
    let c = addBoss(makeConfig());
    expect(c.cooldowns).toEqual(seeded);

    c = deleteBoss(c, c.bosses[0].id); // delete down to the fallback boss
    expect(c.cooldowns).toEqual(seeded);
    expect(c.bosses).toHaveLength(1); // fallback re-seed still works
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

describe("distinct-sound assignment", () => {
  it("gives each new skill a distinct sound until the set is exhausted", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;
    // makeConfig already seeded 2 skills; grow to exactly one per available sound
    while (bossById(c, bid)!.skills.length < SOUND_IDS.length) c = addSkill(c, bid);

    const sounds = bossById(c, bid)!.skills.map((s) => s.soundId);
    expect(sounds).toHaveLength(SOUND_IDS.length);
    expect(new Set(sounds).size).toBe(SOUND_IDS.length); // all distinct
  });

  it("falls back to cycling once every sound is in use", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;
    while (bossById(c, bid)!.skills.length <= SOUND_IDS.length) c = addSkill(c, bid);
    // one more skill than there are sounds — the last reuses a known sound id
    const sounds = bossById(c, bid)!.skills.map((s) => s.soundId);
    expect(isSoundId(sounds[sounds.length - 1])).toBe(true);
  });
});

describe("setSkillSound", () => {
  it("sets a skill's soundId and leaves its siblings untouched", () => {
    let c = makeConfig();
    const bid = c.bosses[0].id;
    const [s0, s1] = c.bosses[0].skills;

    c = setSkillSound(c, bid, s1.id, "chime");
    const after = bossById(c, bid)!.skills;
    expect(after[1].soundId).toBe("chime");
    expect(after[0].soundId).toBe(s0.soundId); // sibling unchanged
  });

  it("defaults the first skill of a fresh boss to the default sound", () => {
    const c = addBoss(makeConfig());
    expect(lastBoss(c).skills[0].soundId).toBe(DEFAULT_SOUND_ID);
  });
});

describe("startCooldown", () => {
  it("stamps an absolute expiry of now + the definition's duration into running", () => {
    const c = makeConfig();
    const def = c.cooldowns[0]; // Hydra, 15m
    const now = 1_000_000;
    const after = startCooldown(c, def.id, now);
    expect(after.running).toEqual([{ defId: def.id, expiry: now + def.durationMs, startedAt: now }]);
  });

  it("is a no-op for a defId that isn't in the catalog", () => {
    const c = makeConfig();
    const after = startCooldown(c, "cooldown-999", 1_000_000);
    expect(after).toBe(c); // same reference — nothing changed
  });

  it("re-stamps an already-running def in place rather than duplicating it", () => {
    const c = makeConfig();
    const def = c.cooldowns[0];
    const started = startCooldown(c, def.id, 1_000_000);
    const restamped = startCooldown(started, def.id, 2_000_000);
    expect(restamped.running).toHaveLength(1);
    expect(restamped.running[0].expiry).toBe(2_000_000 + def.durationMs);
  });
});

describe("restartCooldown", () => {
  it("re-stamps a running cooldown back to the definition's full catalog duration", () => {
    const c = makeConfig();
    const def = c.cooldowns[0]; // 15m
    // started short (tuned to 1m), then restart should snap back to the 15m catalog length
    const started = startCooldown(c, def.id, 1_000_000, 60_000);
    const after = restartCooldown(started, def.id, 2_000_000);
    expect(after.running[0].expiry).toBe(2_000_000 + def.durationMs);
  });
});

describe("setCooldownDuration", () => {
  it("tunes a definition's catalog duration so it sticks for future starts", () => {
    const c = makeConfig();
    const def = c.cooldowns[0]; // Hydra, 15m
    const after = setCooldownDuration(c, def.id, 20 * 60_000);
    expect(after.cooldowns[0].durationMs).toBe(20 * 60_000);
    // and a fresh start now uses the tuned catalog length, not the old 15m
    const started = startCooldown(after, def.id, 1_000_000);
    expect(started.running[0].expiry).toBe(1_000_000 + 20 * 60_000);
  });

  it("leaves the other definitions and the running set untouched", () => {
    const c = makeConfig();
    const [a, b] = c.cooldowns;
    const after = setCooldownDuration(c, a.id, 30 * 60_000);
    expect(after.cooldowns[1]).toEqual(b);
    expect(after.running).toBe(c.running);
  });

  it("clamps the tuned duration to [1m, 12h]", () => {
    const c = makeConfig();
    const id = c.cooldowns[0].id;
    expect(setCooldownDuration(c, id, 0).cooldowns[0].durationMs).toBe(60_000);
    expect(setCooldownDuration(c, id, 99 * 3_600_000).cooldowns[0].durationMs).toBe(12 * 3_600_000);
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(setCooldownDuration(c, "cooldown-999", 60_000)).toBe(c);
  });
});

describe("duplicateCooldown", () => {
  it("appends a copy of a definition, numbered so two of the same boss can run at once", () => {
    const c = makeConfig();
    const hydra = c.cooldowns[0]; // Hydra, 15m
    const after = duplicateCooldown(c, hydra.id);
    const dup = after.cooldowns[after.cooldowns.length - 1];
    expect(after.cooldowns.length).toBe(c.cooldowns.length + 1);
    expect([dup.name, dup.tag, dup.durationMs]).toEqual(["Hydra 2", "Hyd2", hydra.durationMs]);
    expect(dup.id).toBe("cooldown-7"); // fresh id past the seeded six
    expect(after.cooldownSeq).toBe(7);
  });

  it("counts up across repeated duplicates and duplicates of duplicates", () => {
    const c = makeConfig();
    const hydraId = c.cooldowns[0].id;
    const two = duplicateCooldown(c, hydraId); // Hydra 2
    const three = duplicateCooldown(two, hydraId); // Hydra 3 (next after the max suffix)
    const dupOfTwo = duplicateCooldown(three, two.cooldowns[two.cooldowns.length - 1].id); // dup "Hydra 2"
    const names = dupOfTwo.cooldowns.filter((d) => d.name.startsWith("Hydra")).map((d) => d.name);
    expect(names).toEqual(["Hydra", "Hydra 2", "Hydra 3", "Hydra 4"]);
  });

  it("leaves the rest of the catalog and the running set untouched", () => {
    const c = makeConfig();
    const after = duplicateCooldown(c, c.cooldowns[0].id);
    expect(after.cooldowns.slice(0, c.cooldowns.length)).toEqual(c.cooldowns);
    expect(after.running).toBe(c.running);
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(duplicateCooldown(c, "cooldown-999")).toBe(c);
  });
});

describe("addCooldown", () => {
  it("appends a blank definition with a fresh id, auto-tag and the default duration", () => {
    const c = makeConfig();
    const after = addCooldown(c);
    const def = after.cooldowns[after.cooldowns.length - 1];
    expect(after.cooldowns.length).toBe(c.cooldowns.length + 1);
    expect([def.id, def.name, def.tag, def.durationMs]).toEqual(["cooldown-7", "Cooldown 7", "Coo", 3_600_000]);
    expect(after.cooldownSeq).toBe(7); // seq advanced past the new id
  });

  it("leaves the existing catalog, bosses and running set untouched", () => {
    const c = makeConfig();
    const after = addCooldown(c);
    expect(after.cooldowns.slice(0, c.cooldowns.length)).toEqual(c.cooldowns);
    expect(after.bosses).toBe(c.bosses);
    expect(after.running).toBe(c.running);
  });

  it("hands out non-colliding ids across repeated adds", () => {
    const c = addCooldown(addCooldown(makeConfig()));
    const ids = c.cooldowns.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("renameCooldown", () => {
  it("renames a definition and re-derives its tag from the new name", () => {
    const c = makeConfig();
    const id = c.cooldowns[0].id; // Hydra / Hyd
    const after = renameCooldown(c, id, "Razador");
    expect([after.cooldowns[0].name, after.cooldowns[0].tag]).toEqual(["Razador", "Raz"]);
  });

  it("re-derives the tag over a prior manual override (rename wins)", () => {
    const c = makeConfig();
    const id = c.cooldowns[0].id;
    const retagged = retagCooldown(c, id, "ZZ");
    const after = renameCooldown(retagged, id, "Meley");
    expect(after.cooldowns[0].tag).toBe("Mel"); // the override is clobbered by the rename
  });

  it("leaves sibling definitions and bosses untouched", () => {
    const c = makeConfig();
    const [a, b] = c.cooldowns;
    const after = renameCooldown(c, a.id, "Renamed");
    expect(after.cooldowns[1]).toEqual(b);
    expect(after.bosses).toBe(c.bosses);
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(renameCooldown(c, "cooldown-999", "X")).toBe(c);
  });
});

describe("retagCooldown", () => {
  it("sets a definition's tag explicitly, leaving its name and siblings alone", () => {
    const c = makeConfig();
    const [a, b] = c.cooldowns;
    const after = retagCooldown(c, a.id, "Hy");
    expect([after.cooldowns[0].name, after.cooldowns[0].tag]).toEqual(["Hydra", "Hy"]);
    expect(after.cooldowns[1]).toEqual(b);
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(retagCooldown(c, "cooldown-999", "X")).toBe(c);
  });
});

describe("removeCooldown", () => {
  it("drops a definition and leaves the other definitions", () => {
    const c = makeConfig();
    const [a, b] = c.cooldowns;
    const after = removeCooldown(c, a.id);
    expect(after.cooldowns.map((d) => d.id)).not.toContain(a.id);
    expect(after.cooldowns).toContainEqual(b);
    expect(after.cooldowns.length).toBe(c.cooldowns.length - 1);
  });

  it("also stops a running instance of the removed def, sparing the others", () => {
    const c = makeConfig();
    const [a, b] = c.cooldowns;
    let started = startCooldown(c, a.id, 1_000_000);
    started = startCooldown(started, b.id, 1_000_000);
    const after = removeCooldown(started, a.id);
    expect(after.running.map((r) => r.defId)).toEqual([b.id]); // a's running instance gone, b's kept
  });

  it("leaves the bosses untouched", () => {
    const c = makeConfig();
    const after = removeCooldown(c, c.cooldowns[0].id);
    expect(after.bosses).toBe(c.bosses);
  });
});

describe("clearCooldown", () => {
  it("removes the running cooldown for a def and leaves the others", () => {
    const c = makeConfig();
    const [a, b] = c.cooldowns;
    let started = startCooldown(c, a.id, 1_000_000);
    started = startCooldown(started, b.id, 1_000_000);
    const after = clearCooldown(started, a.id);
    expect(after.running.map((r) => r.defId)).toEqual([b.id]);
  });

  it("is a no-op when nothing is running for that def", () => {
    const c = makeConfig();
    expect(clearCooldown(c, c.cooldowns[0].id).running).toEqual([]);
  });
});

// ---- recurring catalog CRUD (mirrors the cooldown editor, on the day-scale band) ----

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;

describe("addRecurring", () => {
  it("appends a blank deadline definition with a fresh id and a default duration", () => {
    const c = makeConfig();
    const after = addRecurring(c);
    const def = after.recurring[after.recurring.length - 1];
    expect(after.recurring.length).toBe(c.recurring.length + 1);
    expect([def.id, def.name, def.durationMs, def.kind]).toEqual(["recurring-14", "Item 14", DAY, "deadline"]);
    expect(after.recurringSeq).toBe(14); // seq advanced past the new id
  });

  it("creates a gate-kind definition when asked (the ROUTINE section's add)", () => {
    const c = makeConfig();
    const after = addRecurring(c, "gate");
    const def = after.recurring[after.recurring.length - 1];
    expect([def.id, def.name, def.kind]).toEqual(["recurring-14", "Routine 14", "gate"]);
    expect(after.recurringSeq).toBe(14);
  });

  it("leaves the existing catalog, bosses and running set untouched", () => {
    const c = makeConfig();
    const after = addRecurring(c);
    expect(after.recurring.slice(0, c.recurring.length)).toEqual(c.recurring);
    expect(after.bosses).toBe(c.bosses);
    expect(after.recurringRunning).toBe(c.recurringRunning);
  });

  it("hands out non-colliding ids across repeated adds", () => {
    const c = addRecurring(addRecurring(makeConfig()));
    const ids = c.recurring.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("renameRecurring", () => {
  it("renames a definition, leaving its siblings alone", () => {
    const c = makeConfig();
    const [a, b] = c.recurring;
    const after = renameRecurring(c, a.id, "Battle Horse");
    expect(after.recurring[0].name).toBe("Battle Horse");
    expect(after.recurring[1]).toEqual(b);
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(renameRecurring(c, "recurring-999", "X")).toBe(c);
  });
});

describe("setRecurringDuration", () => {
  it("sets a day-scale duration on the catalog definition", () => {
    const c = makeConfig();
    const id = c.recurring[0].id;
    const after = setRecurringDuration(c, id, 5 * DAY + 6 * HOUR);
    expect(after.recurring[0].durationMs).toBe(5 * DAY + 6 * HOUR);
  });

  it("clamps to the day-scale band [1m, 365d] (beyond cooldown's 12h ceiling)", () => {
    const c = makeConfig();
    const id = c.recurring[0].id;
    expect(setRecurringDuration(c, id, 0).recurring[0].durationMs).toBe(MIN); // floor
    expect(setRecurringDuration(c, id, 999 * DAY).recurring[0].durationMs).toBe(365 * DAY); // ceiling
    expect(setRecurringDuration(c, id, 30 * DAY).recurring[0].durationMs).toBe(30 * DAY); // well within
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(setRecurringDuration(c, "recurring-999", DAY)).toBe(c);
  });
});

describe("removeRecurring", () => {
  it("drops a definition and leaves the others", () => {
    const c = makeConfig();
    const [a, b] = c.recurring;
    const after = removeRecurring(c, a.id);
    expect(after.recurring.map((d) => d.id)).not.toContain(a.id);
    expect(after.recurring).toContainEqual(b);
    expect(after.recurring.length).toBe(c.recurring.length - 1);
  });

  it("also stops a running instance of the removed def, sparing the others", () => {
    const c = makeConfig();
    const [a, b] = c.recurring;
    let started = markRecurring(c, a.id, 1_000_000);
    started = markRecurring(started, b.id, 1_000_000);
    const after = removeRecurring(started, a.id);
    expect(after.recurringRunning.map((r) => r.defId)).toEqual([b.id]); // a's instance gone, b's kept
  });

  it("leaves the bosses untouched", () => {
    const c = makeConfig();
    const after = removeRecurring(c, c.recurring[0].id);
    expect(after.bosses).toBe(c.bosses);
  });
});

describe("markRecurring (refresh / start gesture)", () => {
  it("starts an unstarted def by restamping a full cycle from now", () => {
    const c = makeConfig();
    const def = c.recurring[0];
    const after = markRecurring(c, def.id, 1_000);
    expect(after.recurringRunning).toEqual([{ defId: def.id, expiry: 1_000 + def.durationMs, startedAt: 1_000 }]);
  });

  it("refreshes a running def in place, clearing its alarm", () => {
    const c = makeConfig();
    const def = c.recurring[0]; // Snow Wolf, 3 days
    const started = markRecurring(c, def.id, 0);
    // fast-forward into the alarm window by re-reading the running instance near its expiry
    const r = started.recurringRunning[0];
    expect(inAlarm(r, def.durationMs - HOUR)).toBe(true);
    const refreshed = markRecurring(started, def.id, def.durationMs - HOUR);
    expect(inAlarm(refreshed.recurringRunning[0], def.durationMs - HOUR)).toBe(false); // fresh cycle clears it
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(markRecurring(c, "recurring-999", 1_000)).toBe(c);
  });
});
