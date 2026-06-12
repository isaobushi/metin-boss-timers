import { describe, expect, it } from "vitest";
import { ladderCap } from "./recurring";
import {
  type Build,
  type ChorePreform,
  type Empire,
  type Race,
  buildsFor,
  subsetFor,
} from "./skillCatalog";

// skillCatalog is the pure resolver behind PRD #47's "a Race has a subset of Abilities, and an
// Empire determines the Language chores." Like the rest of the engine it is clock-free and pure, so
// every assertion is `subsetFor(tuple) -> preforms` over a static catalog — external behaviour only,
// never reaching into the catalog's internal tables.

const ALL_RACES: Race[] = ["Warrior", "Ninja", "Sura", "Shaman", "Lycan"];
const ALL_EMPIRES: Empire[] = ["Shinsoo", "Chunjo", "Jinno"];

const abilities = (ps: ChorePreform[]) => ps.filter((p) => p.category === "class-ability");
const languages = (ps: ChorePreform[]) => ps.filter((p) => p.category === "language");

describe("buildsFor", () => {
  it("gives every non-Lycan race two builds", () => {
    for (const race of ["Warrior", "Ninja", "Sura", "Shaman"] as Race[]) {
      expect(buildsFor(race)).toHaveLength(2);
    }
  });

  it("resolves Lycan to a single build (Instinct)", () => {
    expect(buildsFor("Lycan")).toEqual(["Instinct"]);
  });
});

describe("subsetFor — class abilities", () => {
  it("returns exactly the chosen build(s)' abilities and none from another race", () => {
    const builds = buildsFor("Sura");
    const got = abilities(subsetFor("Shinsoo", "Sura", builds));
    // every returned ability belongs to Sura and to one of the chosen builds
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((p) => p.race === "Sura")).toBe(true);
    expect(got.every((p) => p.build != null && builds.includes(p.build))).toBe(true);
  });

  it("never leaks one race's abilities into another's subset", () => {
    // Non-leakage is STRUCTURAL — by an ability's owning (race, build), not its display name. Two
    // races can legitimately share a skill *name* (Warrior·Mental and Sura·Black Magic both have a
    // "Spirit Strike"), which is not a leak. So assert every ability a race resolves is tagged with
    // THAT race and one of ITS builds, and that each build belongs to exactly one race (build sets
    // are race-exclusive) — together that means no race's build list can pull in another's abilities.
    const buildOwner = new Map<Build, Race>();
    for (const race of ALL_RACES) {
      const own = new Set<Build>(buildsFor(race));
      for (const p of abilities(subsetFor("Shinsoo", race, buildsFor(race)))) {
        expect(p.race).toBe(race);
        expect(p.build != null && own.has(p.build)).toBe(true);
        expect(buildOwner.get(p.build!) ?? race).toBe(race); // a build never spans two races
        buildOwner.set(p.build!, race);
      }
    }
  });

  it("filters abilities to the chosen build — one build is a strict subset of both", () => {
    const [first, second] = buildsFor("Warrior");
    const one = abilities(subsetFor("Jinno", "Warrior", [first]));
    const both = abilities(subsetFor("Jinno", "Warrior", [first, second]));
    expect(one.every((p) => p.build === first)).toBe(true);
    expect(one.length).toBeLessThan(both.length);
    expect(both.some((p) => p.build === second)).toBe(true);
  });

  it("ignores a build that doesn't belong to the race", () => {
    // "Dragon" is a Shaman build, not a Warrior one — passing it yields no abilities.
    const got = abilities(subsetFor("Jinno", "Warrior", ["Dragon" as Build]));
    expect(got).toEqual([]);
  });

  it("lists Warrior's shared 9th skill (Earthquake) once even for a both-schools Warrior", () => {
    const names = abilities(subsetFor("Jinno", "Warrior", buildsFor("Warrior"))).map((p) => p.name);
    expect(names.filter((n) => n === "Earthquake")).toHaveLength(1); // de-duped across Body + Mental
    expect(names).toContain("Earthquake");
    // a single-school Warrior still gets it (it belongs to both schools, not just one)
    expect(abilities(subsetFor("Jinno", "Warrior", ["Mental"])).map((p) => p.name)).toContain("Earthquake");
  });

  it("carries the Boost (8th) and 9th skill as school abilities on the skill-book ladder", () => {
    const bm = abilities(subsetFor("Chunjo", "Sura", ["Black Magic"]));
    const names = bm.map((p) => p.name);
    expect(names).toContain("Dark Strike Boost"); // 8th — the school's boost
    expect(names).toContain("Lethal Wave"); // 9th
    expect(bm.every((p) => p.build === "Black Magic")).toBe(true); // both tagged to the school
    for (const p of bm) expect(ladderCap(p.ladderId)).toBe(65); // all read like skill books (books + stones)
  });

  it("yields only Instinct abilities for a Lycan", () => {
    const got = abilities(subsetFor("Chunjo", "Lycan", buildsFor("Lycan")));
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((p) => p.build === "Instinct")).toBe(true);
  });

  it("contributes no abilities when the race is unset", () => {
    expect(abilities(subsetFor("Shinsoo", undefined, []))).toEqual([]);
  });
});

describe("subsetFor — languages", () => {
  it("returns the two foreign languages and excludes the character's own empire", () => {
    for (const own of ALL_EMPIRES) {
      const langs = languages(subsetFor(own, "Warrior", buildsFor("Warrior")));
      const langEmpires = langs.map((p) => p.empire);
      expect(langs).toHaveLength(2);
      expect(langEmpires).not.toContain(own); // never your own empire's language
      // the two returned are exactly the other empires
      const others = ALL_EMPIRES.filter((e) => e !== own);
      expect(new Set(langEmpires)).toEqual(new Set(others));
    }
  });

  it("contributes no languages when the empire is unset", () => {
    expect(languages(subsetFor(undefined, "Warrior", buildsFor("Warrior")))).toEqual([]);
  });
});

describe("subsetFor — universal chores", () => {
  const universalNames = ["Leadership", "Transformation", "Inspiration", "Charisma", "Mining", "Biologist", "Ward Skill"];

  it("includes every universal chore regardless of race/empire", () => {
    for (const empire of ALL_EMPIRES) {
      for (const race of ALL_RACES) {
        const names = subsetFor(empire, race, buildsFor(race)).map((p) => p.name);
        for (const u of universalNames) expect(names).toContain(u);
      }
    }
  });

  it("includes the universal chores even for a fully unclassified tuple", () => {
    const names = subsetFor(undefined, undefined, []).map((p) => p.name);
    for (const u of universalNames) expect(names).toContain(u);
  });
});

describe("subsetFor — ladder metadata rides on the preforms", () => {
  it("points abilities at the 65-read (M1→P) ladder and languages at the 20-rung (M1) ladder", () => {
    const ps = subsetFor("Shinsoo", "Sura", buildsFor("Sura"));
    // assert the quotas via recurring.ts's shared ladder structures, not hard-coded numbers
    for (const p of abilities(ps)) expect(ladderCap(p.ladderId)).toBe(65);
    for (const p of languages(ps)) expect(ladderCap(p.ladderId)).toBe(20);
  });

  it("marks every preform a gate carrying a known ladder id", () => {
    const ps = subsetFor("Jinno", "Lycan", buildsFor("Lycan"));
    expect(ps.every((p) => p.kind === "gate")).toBe(true);
    // every preform climbs a real ladder (cap > 0 means recurring.ts resolved the id)
    expect(ps.every((p) => p.ladderId != null && ladderCap(p.ladderId) > 0)).toBe(true);
  });
});
