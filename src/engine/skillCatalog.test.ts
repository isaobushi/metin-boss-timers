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
    // Collect each race's full ability-name set, then assert pairwise disjointness.
    const namesByRace = new Map<Race, Set<string>>();
    for (const race of ALL_RACES) {
      const names = abilities(subsetFor("Shinsoo", race, buildsFor(race))).map((p) => p.name);
      namesByRace.set(race, new Set(names));
    }
    for (const a of ALL_RACES) {
      for (const b of ALL_RACES) {
        if (a === b) continue;
        const overlap = [...namesByRace.get(a)!].filter((n) => namesByRace.get(b)!.has(n));
        expect(overlap).toEqual([]);
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
  const universalNames = ["Leadership", "Transformation", "Inspiration", "Charisma", "Mining", "Biologist"];

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
  it("points abilities at the 55-rung (M1→G1) ladder and languages at the 20-rung (M1) ladder", () => {
    const ps = subsetFor("Shinsoo", "Sura", buildsFor("Sura"));
    // assert the quotas via recurring.ts's shared ladder structures, not hard-coded numbers
    for (const p of abilities(ps)) expect(ladderCap(p.ladderId)).toBe(55);
    for (const p of languages(ps)) expect(ladderCap(p.ladderId)).toBe(20);
  });

  it("marks every preform a gate carrying a known ladder id", () => {
    const ps = subsetFor("Jinno", "Lycan", buildsFor("Lycan"));
    expect(ps.every((p) => p.kind === "gate")).toBe(true);
    // every preform climbs a real ladder (cap > 0 means recurring.ts resolved the id)
    expect(ps.every((p) => p.ladderId != null && ladderCap(p.ladderId) > 0)).toBe(true);
  });
});
