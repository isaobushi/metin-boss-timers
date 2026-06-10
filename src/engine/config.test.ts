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
  markRead,
  setRung,
  addRecurring,
  renameRecurring,
  setRecurringDuration,
  removeRecurring,
  activeRecurring,
  activeRecurringRunning,
  activeRecurringProgress,
  activeCharacter,
  addCharacter,
  renameCharacter,
  deleteCharacter,
  selectCharacter,
  classifyCharacter,
  type Config,
} from "./config";
import { inAlarm, type RecurringProgress } from "./recurring";
import { subsetFor } from "./skillCatalog";
import { DEFAULT_SOUND_ID, SOUND_IDS, isSoundId } from "./sounds";

// The config model is pure: every op is `(Config, ...) -> Config` with no clock, no
// React, no storage. Ids are deterministic (owned seq counters), so these assertions
// can pin exact ids without any injected randomness.

const lastBoss = (c: Config) => c.bosses[c.bosses.length - 1];

// The recurring side now lives under the ACTIVE character (#47); these read its slices so the
// assertions below stay about behaviour, not the relocation. `withProgress` installs a rank on the
// active character (the "user already has progress in hand" setup the old tests did via `{ ...c }`).
const rec = (c: Config) => activeRecurring(c);
const recRun = (c: Config) => activeRecurringRunning(c);
const recProg = (c: Config) => activeRecurringProgress(c);
const withProgress = (c: Config, progress: RecurringProgress[]): Config => ({
  ...c,
  characters: c.characters.map((ch) => (ch.id === c.activeCharacterId ? { ...ch, recurringProgress: progress } : ch)),
});

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
    expect(rec(c).map((r) => [r.name, r.durationMs, r.kind])).toEqual([
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
    expect(new Set(rec(c).map((r) => r.id)).size).toBe(13); // ids are distinct
    expect(c.recurringSeq).toBe(13); // seq seeded past the last seeded id
    expect(recRun(c)).toEqual([]); // nothing running on a fresh install (mark-done starts an item)
    expect(recProg(c)).toEqual([]); // and no ladder rank yet (#44)
  });

  it("seeds the recurring catalog under a single active default character (#47)", () => {
    const c = makeConfig();
    expect(c.characters).toHaveLength(1);
    expect(c.activeCharacterId).toBe(c.characters[0].id);
    expect(c.characterSeq).toBe(1);
    const ch = activeCharacter(c)!;
    expect(ch.recurring).toHaveLength(13); // the seed lives on the character, not the top level
    expect(ch.empire).toBeUndefined(); // a default character is unclassified
    expect(ch.race).toBeUndefined();
    expect(ch.builds).toEqual([]);
  });

  it("wires each gate def to its seeded ladder; deadlines carry none (#44)", () => {
    const c = makeConfig();
    // ladderId is pure presentation (like `kind`): the deadlines have no rank; the thirteen gates
    // share the five structures — transformation across four defs, language across three.
    expect(rec(c).map((r) => r.ladderId)).toEqual([
      undefined, undefined, undefined, // Snow Wolf, Costume of Flame, Battle Horse (deadlines)
      "class-skill", // Skill Books
      "transformation", "transformation", "transformation", "transformation", // Transformation/Inspiration/Charisma/Mining
      "leadership", // Leadership
      "language", "language", "language", // Jinno/Chunjo/Shinsoo
      "biologist", // Biologist
    ]);
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
    const def = rec(after)[rec(after).length - 1];
    expect(rec(after).length).toBe(rec(c).length + 1);
    expect([def.id, def.name, def.durationMs, def.kind]).toEqual(["recurring-14", "Item 14", DAY, "deadline"]);
    expect(after.recurringSeq).toBe(14); // seq advanced past the new id
  });

  it("creates a gate-kind definition when asked (the ROUTINE section's add)", () => {
    const c = makeConfig();
    const after = addRecurring(c, "gate");
    const def = rec(after)[rec(after).length - 1];
    expect([def.id, def.name, def.kind]).toEqual(["recurring-14", "Routine 14", "gate"]);
    expect(after.recurringSeq).toBe(14);
  });

  it("leaves the existing catalog, bosses and running set untouched", () => {
    const c = makeConfig();
    const after = addRecurring(c);
    expect(rec(after).slice(0, rec(c).length)).toEqual(rec(c));
    expect(after.bosses).toBe(c.bosses);
    expect(recRun(after)).toBe(recRun(c));
  });

  it("hands out non-colliding ids across repeated adds", () => {
    const c = addRecurring(addRecurring(makeConfig()));
    const ids = rec(c).map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("renameRecurring", () => {
  it("renames a definition, leaving its siblings alone", () => {
    const c = makeConfig();
    const [a, b] = rec(c);
    const after = renameRecurring(c, a.id, "Battle Horse");
    expect(rec(after)[0].name).toBe("Battle Horse");
    expect(rec(after)[1]).toEqual(b);
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(renameRecurring(c, "recurring-999", "X")).toBe(c);
  });
});

describe("setRecurringDuration", () => {
  it("sets a day-scale duration on the catalog definition", () => {
    const c = makeConfig();
    const id = rec(c)[0].id;
    const after = setRecurringDuration(c, id, 5 * DAY + 6 * HOUR);
    expect(rec(after)[0].durationMs).toBe(5 * DAY + 6 * HOUR);
  });

  it("clamps to the day-scale band [1m, 365d] (beyond cooldown's 12h ceiling)", () => {
    const c = makeConfig();
    const id = rec(c)[0].id;
    expect(rec(setRecurringDuration(c, id, 0))[0].durationMs).toBe(MIN); // floor
    expect(rec(setRecurringDuration(c, id, 999 * DAY))[0].durationMs).toBe(365 * DAY); // ceiling
    expect(rec(setRecurringDuration(c, id, 30 * DAY))[0].durationMs).toBe(30 * DAY); // well within
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(setRecurringDuration(c, "recurring-999", DAY)).toBe(c);
  });
});

describe("removeRecurring", () => {
  it("drops a definition and leaves the others", () => {
    const c = makeConfig();
    const [a, b] = rec(c);
    const after = removeRecurring(c, a.id);
    expect(rec(after).map((d) => d.id)).not.toContain(a.id);
    expect(rec(after)).toContainEqual(b);
    expect(rec(after).length).toBe(rec(c).length - 1);
  });

  it("also stops a running instance of the removed def, sparing the others", () => {
    const c = makeConfig();
    const [a, b] = rec(c);
    let started = markRecurring(c, a.id, 1_000_000);
    started = markRecurring(started, b.id, 1_000_000);
    const after = removeRecurring(started, a.id);
    expect(recRun(after).map((r) => r.defId)).toEqual([b.id]); // a's instance gone, b's kept
  });

  it("leaves the bosses untouched", () => {
    const c = makeConfig();
    const after = removeRecurring(c, rec(c)[0].id);
    expect(after.bosses).toBe(c.bosses);
  });
});

describe("markRecurring (refresh / start gesture)", () => {
  it("starts an unstarted def by restamping a full cycle from now", () => {
    const c = makeConfig();
    const def = rec(c)[0];
    const after = markRecurring(c, def.id, 1_000);
    expect(recRun(after)).toEqual([{ defId: def.id, expiry: 1_000 + def.durationMs, startedAt: 1_000 }]);
  });

  it("refreshes a running def in place, clearing its alarm", () => {
    const c = makeConfig();
    const def = rec(c)[0]; // Snow Wolf, 3 days
    const started = markRecurring(c, def.id, 0);
    // fast-forward into the alarm window by re-reading the running instance near its expiry
    const r = recRun(started)[0];
    expect(inAlarm(r, def.durationMs - HOUR)).toBe(true);
    const refreshed = markRecurring(started, def.id, def.durationMs - HOUR);
    expect(inAlarm(recRun(refreshed)[0], def.durationMs - HOUR)).toBe(false); // fresh cycle clears it
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(markRecurring(c, "recurring-999", 1_000)).toBe(c);
  });
});

describe("markRead (ladder read-outcome gesture, #45)", () => {
  // Skill Books is the first ladder def (recurring-4, ladderId class-skill, cap 55). Both outcomes
  // restamp the 24h gate (a read happened either way); only a success advances the rank.
  const books = (c: Config) => rec(c)[3];

  it("✓ (success) advances the rank by one AND restamps the gate", () => {
    const c = makeConfig();
    const def = books(c);
    const after = markRead(c, def.id, 1_000, true);
    expect(recProg(after)).toEqual([{ defId: def.id, position: 1 }]); // rank advanced
    expect(recRun(after)).toEqual([{ defId: def.id, expiry: 1_000 + def.durationMs, startedAt: 1_000 }]);
  });

  it("✗ (fail) restamps the gate only — the book is burned, the rank is untouched", () => {
    const c = makeConfig();
    const def = books(c);
    const after = markRead(c, def.id, 1_000, false);
    expect(recProg(after)).toEqual([]); // no advance
    expect(recRun(after)).toEqual([{ defId: def.id, expiry: 1_000 + def.durationMs, startedAt: 1_000 }]);
  });

  it("accumulates successive successful reads", () => {
    const c = makeConfig();
    const def = books(c);
    let after = markRead(c, def.id, 1_000, true);
    after = markRead(after, def.id, 2_000, false); // a fail in between doesn't advance
    after = markRead(after, def.id, 3_000, true);
    expect(recProg(after)).toEqual([{ defId: def.id, position: 2 }]);
  });

  it("✓ at the cap is a no-op on position (clamped to the book-relevant cap)", () => {
    const base = makeConfig();
    const def = books(base);
    const c = withProgress(base, [{ defId: def.id, position: 55 }]); // already at G1, the cap
    const after = markRead(c, def.id, 1_000, true);
    expect(recProg(after)).toEqual([{ defId: def.id, position: 55 }]); // clamped, no overshoot
  });

  it("is a no-op for an unknown def id", () => {
    const c = makeConfig();
    expect(markRead(c, "recurring-999", 1_000, true)).toBe(c);
  });
});

describe("markRead — stage ladder (Biologist): each ✓ consigns one item and restamps the 22h gate", () => {
  // Biologist is the last seeded def (recurring-13, ladderId biologist, style stage, cap 235). A ✓
  // consigns one item: every consign has its own 22h cooldown, so the timer to the *next* consign
  // restamps on every ✓ — not once per completed stage.
  const bio = (c: Config) => rec(c)[12];
  const at = (c: Config, position: number): Config => withProgress(c, [{ defId: bio(c).id, position }]);

  it("a mid-stage ✓ advances the rank by one AND restamps the gate (next consign's cooldown)", () => {
    const c = at(makeConfig(), 3); // mid stage 1 (needs 10)
    const def = bio(c);
    const after = markRead(c, def.id, 1_000, true);
    expect(recProg(after)).toEqual([{ defId: def.id, position: 4 }]); // one more item in
    expect(recRun(after)).toEqual([{ defId: def.id, expiry: 1_000 + def.durationMs, startedAt: 1_000 }]);
  });

  it("the ✓ at the cap is a no-op on rank but still restamps (consistent with the rung ladders)", () => {
    const c = at(makeConfig(), 235); // the 235-item trophy
    const def = bio(c);
    const after = markRead(c, def.id, 1_000, true);
    expect(recProg(after)).toEqual([{ defId: def.id, position: 235 }]); // clamped, no overshoot
  });
});

describe("setRung (set-rung curtain, #46)", () => {
  const books = (c: Config) => rec(c)[3]; // Skill Books, class-skill (M4 entry = 1+2+3 = 6)

  it("maps a chosen rung to its entry-threshold position", () => {
    const c = makeConfig();
    const def = books(c);
    const after = setRung(c, def.id, "M4");
    expect(recProg(after)).toEqual([{ defId: def.id, position: 6 }]); // M1=0,M2=1,M3=3,M4=6
  });

  it("writes the progress map ONLY — the daily gate is untouched", () => {
    const c = markRecurring(makeConfig(), books(makeConfig()).id, 1_000); // gate already running
    const def = books(c);
    const before = recRun(c);
    const after = setRung(c, def.id, "M4");
    expect(recRun(after)).toBe(before); // same reference — gate not re-stamped
    expect(recProg(after)).toEqual([{ defId: def.id, position: 6 }]);
  });

  it("doubles as the misclick fix — retargeting down to an earlier rung", () => {
    const base = makeConfig();
    const def = books(base);
    const c = withProgress(base, [{ defId: def.id, position: 45 }]); // mistakenly at M10
    const after = setRung(c, def.id, "M2");
    expect(recProg(after)).toEqual([{ defId: def.id, position: 1 }]); // snapped back to M2's entry
  });

  it("is a no-op for an unknown def, a plain gate, or a label not on the ladder", () => {
    const c = makeConfig();
    expect(setRung(c, "recurring-999", "M4")).toBe(c); // unknown def
    expect(setRung(c, rec(c)[0].id, "M4")).toBe(c); // Snow Wolf — a deadline, no ladder
    expect(setRung(c, books(c).id, "P")).toBe(c); // P isn't a rung on the class-skill ladder (caps at G1)
  });
});

// ── Multi-character write path (#54) ───────────────────────────────────────────────────────────
// The create flow's pure core: `addCharacter` seeds a new character's recurring chores from
// `skillCatalog.subsetFor`, mints fresh ids off the global `recurringSeq`, and lands the user on it.
// Rename/select/delete round out the dock switcher; delete never leaves `activeCharacterId` dangling.

const chars = (c: Config) => c.characters;
const lastChar = (c: Config) => c.characters[c.characters.length - 1];

describe("addCharacter", () => {
  it("appends a character with a character-N id minted off characterSeq, and lands the user on it", () => {
    const c = makeConfig(); // ships one default character (character-1), characterSeq = 1
    const next = addCharacter(c, { name: "Alt", empire: "Jinno", race: "Warrior", builds: ["Body"] });
    expect(chars(next)).toHaveLength(2);
    expect(lastChar(next).id).toBe("character-2");
    expect(next.characterSeq).toBe(2);
    expect(lastChar(next).name).toBe("Alt");
    expect(next.activeCharacterId).toBe("character-2"); // create → you're now on the new character
  });

  it("records the chosen empire/race/builds on the new character", () => {
    const next = addCharacter(makeConfig(), { name: "Alt", empire: "Chunjo", race: "Sura", builds: ["Weaponry"] });
    const ch = lastChar(next);
    expect(ch.empire).toBe("Chunjo");
    expect(ch.race).toBe("Sura");
    expect(ch.builds).toEqual(["Weaponry"]);
  });

  it("seeds chores exactly equal to the skillCatalog subset for its (empire, race, builds)", () => {
    const draft = { name: "Alt", empire: "Jinno" as const, race: "Ninja" as const, builds: ["Archery" as const] };
    const ch = lastChar(addCharacter(makeConfig(), draft));
    const want = subsetFor(draft.empire, draft.race, draft.builds);
    // name/duration/kind/ladderId all carry across from the preform; only the id is freshly minted
    expect(ch.recurring.map((r) => [r.name, r.durationMs, r.kind, r.ladderId])).toEqual(
      want.map((p) => [p.name, p.durationMs, p.kind, p.ladderId]),
    );
  });

  it("mints recurring ids off the GLOBAL recurringSeq so they never collide across characters", () => {
    const c = makeConfig(); // default character holds 13 seeded chores; recurringSeq = 13
    const next = addCharacter(c, { name: "Alt", empire: "Shinsoo", race: "Lycan", builds: ["Instinct"] });
    const seededCount = subsetFor("Shinsoo", "Lycan", ["Instinct"]).length;
    const newIds = lastChar(next).recurring.map((r) => r.id);
    expect(newIds[0]).toBe("recurring-14"); // first id past the existing 13
    expect(next.recurringSeq).toBe(13 + seededCount);
    // no id is shared with the default character's catalog
    const existing = new Set(c.characters[0].recurring.map((r) => r.id));
    expect(newIds.some((id) => existing.has(id))).toBe(false);
  });

  it("honours the Lycan single-build invariant — only Instinct abilities, no second build", () => {
    const ch = lastChar(addCharacter(makeConfig(), { name: "Wolf", empire: "Jinno", race: "Lycan", builds: ["Instinct"] }));
    expect(ch.recurring.map((r) => r.name)).toEqual(subsetFor("Jinno", "Lycan", ["Instinct"]).map((p) => p.name));
  });

  it("seeds only the universal chores for an unclassified draft (name only)", () => {
    const ch = lastChar(addCharacter(makeConfig(), { name: "Blank" }));
    expect(ch.empire).toBeUndefined();
    expect(ch.race).toBeUndefined();
    expect(ch.builds).toEqual([]);
    expect(ch.recurring.map((r) => r.name)).toEqual(subsetFor(undefined, undefined, []).map((p) => p.name));
  });
});

describe("renameCharacter", () => {
  it("renames the matching character and leaves the others untouched", () => {
    const c = addCharacter(makeConfig(), { name: "Alt" });
    const next = renameCharacter(c, "character-2", "Renamed");
    expect(next.characters.find((ch) => ch.id === "character-2")!.name).toBe("Renamed");
    expect(next.characters.find((ch) => ch.id === "character-1")!.name).toBe("Main");
  });

  it("is a no-op for an unknown id", () => {
    const c = makeConfig();
    expect(renameCharacter(c, "character-999", "X")).toEqual(c);
  });
});

describe("selectCharacter", () => {
  it("switches the active character to a known id", () => {
    const c = addCharacter(makeConfig(), { name: "Alt" }); // active is now character-2
    expect(selectCharacter(c, "character-1").activeCharacterId).toBe("character-1");
  });

  it("is a no-op for an unknown id — never points active at a non-existent character", () => {
    const c = makeConfig(); // active character-1
    expect(selectCharacter(c, "character-999").activeCharacterId).toBe("character-1");
  });
});

describe("deleteCharacter", () => {
  it("removes the character by id", () => {
    const c = addCharacter(makeConfig(), { name: "Alt" });
    const next = deleteCharacter(c, "character-2");
    expect(next.characters.map((ch) => ch.id)).toEqual(["character-1"]);
  });

  it("re-points active to a survivor when the active character is deleted (never dangles)", () => {
    const c = addCharacter(makeConfig(), { name: "Alt" }); // active is character-2
    const next = deleteCharacter(c, "character-2");
    expect(next.activeCharacterId).toBe("character-1");
    expect(activeCharacter(next)).toBeDefined();
  });

  it("leaves active untouched when a non-active character is deleted", () => {
    const c = addCharacter(makeConfig(), { name: "Alt" }); // active is character-2
    const next = deleteCharacter(c, "character-1");
    expect(next.activeCharacterId).toBe("character-2");
  });

  it("drops active to null when the last character is deleted (first-run create flow then shows)", () => {
    const c = makeConfig(); // a single character
    const next = deleteCharacter(c, "character-1");
    expect(next.characters).toEqual([]);
    expect(next.activeCharacterId).toBeNull();
  });

  it("is a no-op for an unknown id", () => {
    const c = makeConfig();
    expect(deleteCharacter(c, "character-999")).toBe(c);
  });
});

describe("classifyCharacter", () => {
  it("classifies the unclassified default — sets axes, seeds the class books, keeps deadlines", () => {
    const c = makeConfig(); // character-1 'Main', unclassified: 3 deadline items + 10 example gates
    const next = classifyCharacter(c, "character-1", { name: "Main", empire: "Jinno", race: "Warrior", builds: ["Body"] });
    const ch = next.characters[0];
    expect(ch.empire).toBe("Jinno");
    expect(ch.race).toBe("Warrior");
    expect(ch.builds).toEqual(["Body"]);
    const gates = ch.recurring.filter((d) => d.kind === "gate");
    const deadlines = ch.recurring.filter((d) => d.kind === "deadline");
    expect(gates.map((d) => d.name)).toEqual(subsetFor("Jinno", "Warrior", ["Body"]).map((p) => p.name));
    expect(deadlines.map((d) => d.name)).toEqual(["Snow Wolf", "Costume of Flame", "Battle Horse"]);
  });

  it("re-seeds the gates off recurringSeq while deadline ids stay stable", () => {
    const c = makeConfig(); // recurringSeq 13; deadlines are recurring-1..3
    const before = c.characters[0].recurring.filter((d) => d.kind === "deadline").map((d) => d.id);
    const next = classifyCharacter(c, "character-1", { name: "Main", empire: "Shinsoo", race: "Lycan", builds: ["Instinct"] });
    const ch = next.characters[0];
    expect(ch.recurring.filter((d) => d.kind === "deadline").map((d) => d.id)).toEqual(before);
    expect(ch.recurring.filter((d) => d.kind === "gate")[0].id).toBe("recurring-14");
    expect(next.recurringSeq).toBe(13 + subsetFor("Shinsoo", "Lycan", ["Instinct"]).length);
  });

  it("a name-only edit (axes unchanged) just renames — chores untouched, no reseed", () => {
    const classified = classifyCharacter(makeConfig(), "character-1", {
      name: "Main",
      empire: "Jinno",
      race: "Sura",
      builds: ["Weaponry"],
    });
    const before = classified.characters[0].recurring;
    const renamed = classifyCharacter(classified, "character-1", {
      name: "Sir",
      empire: "Jinno",
      race: "Sura",
      builds: ["Weaponry"],
    });
    expect(renamed.characters[0].name).toBe("Sir");
    expect(renamed.characters[0].recurring).toBe(before); // same reference — not re-seeded
    expect(renamed.recurringSeq).toBe(classified.recurringSeq);
  });

  it("drops running/progress on replaced gates but keeps them for surviving deadlines", () => {
    const base = makeConfig();
    const ch0 = base.characters[0];
    const deadlineId = ch0.recurring.find((d) => d.kind === "deadline")!.id;
    const gateId = ch0.recurring.find((d) => d.kind === "gate")!.id;
    const seeded: Config = {
      ...base,
      characters: base.characters.map((ch) =>
        ch.id === "character-1"
          ? {
              ...ch,
              recurringRunning: [
                { defId: deadlineId, expiry: 1000, startedAt: 0 },
                { defId: gateId, expiry: 2000, startedAt: 0 },
              ],
              recurringProgress: [{ defId: gateId, position: 5 }],
            }
          : ch,
      ),
    };
    const ch = classifyCharacter(seeded, "character-1", {
      name: "Main",
      empire: "Chunjo",
      race: "Ninja",
      builds: ["Archery"],
    }).characters[0];
    expect(ch.recurringRunning.map((r) => r.defId)).toEqual([deadlineId]); // the gate's running dropped
    expect(ch.recurringProgress).toEqual([]); // the gate's progress dropped
  });

  it("is a no-op for an unknown id", () => {
    const c = makeConfig();
    expect(classifyCharacter(c, "character-999", { name: "X", empire: "Jinno", race: "Warrior", builds: ["Body"] })).toBe(c);
  });
});
