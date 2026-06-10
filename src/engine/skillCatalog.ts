// Pure skill catalog: the sole encoder of "a Race has a subset of Abilities, and an Empire
// determines the Language chores" (PRD #47, multi-character support). Like the rest of the engine
// it owns no clock, no React, no storage — it is a static master catalog of chore PREFORMS plus a
// single pure resolver, `subsetFor(empire, race, builds) -> ChorePreform[]`. Multi-character
// seeding (#54) consumes the preforms to build a Character's Routine defs; this module neither
// seeds nor wires — it only resolves which chores a `(empire, race, builds)` tuple should carry.
//
// GLOSSARY DISCIPLINE (PRD #47): the book-leveled in-game move is an ABILITY (e.g. "Dark Orb",
// "Three-Way Cut") — never the overlay's Skill (the draining boss-timer chip). This catalog deals
// in Abilities; "Skill" is deliberately absent here.

import type { RecurringKind } from "./recurring";

/** The kingdom a Character is pledged to. Independent of Race; determines the Language chores. */
export type Empire = "Shinsoo" | "Chunjo" | "Jinno";

/** The class chosen at creation. Independent of Empire; determines the learnable Abilities. */
export type Race = "Warrior" | "Ninja" | "Sura" | "Shaman" | "Lycan";

/**
 * The sub-tree a Race specialises into. Every Race carries two Builds except Lycan, whose single
 * Build is "Instinct" (the load-bearing special case, encoded in `BUILDS_BY_RACE` below).
 */
export type Build =
  | "Body"
  | "Mental"
  | "Blade-Fight"
  | "Archery"
  | "Weaponry"
  | "Black Magic"
  | "Dragon"
  | "Healing"
  | "Instinct";

/**
 * Which kind of chore a preform becomes. `class-ability` carries a `race` + `build`; `language`
 * carries the `empire` it belongs to; the rest are universal (present on every character). Ladder
 * and gate metadata ride on the preform (via `ladderId` + `kind`), never on the Race — keeping the
 * two axes (Empire ⊥ Race) independent of the progression structures.
 */
export type PreformCategory = "class-ability" | "language" | "leadership" | "transformation" | "biologist";

/**
 * A chore preform: the catalog's pre-seed description of one recurring chore, mintable into a
 * `RecurringDef` once a fresh id is assigned (#54's job). It is a superset of the fields a
 * `RecurringDef` needs — `name`, `durationMs`, `kind`, optional `ladderId` — plus the catalog's own
 * resolution facets (`category`, and the axis tags `race`/`build`/`empire`). All chores are `gate`s.
 */
export type ChorePreform = {
  name: string;
  durationMs: number;
  /** Always `"gate"` — every catalog chore is a daily/periodic "can I do this today?" gate. */
  kind: RecurringKind;
  /** Which seeded ladder this chore climbs (the structures live in `recurring.ts`'s `LADDERS`). */
  ladderId?: string;
  category: PreformCategory;
  /** `class-ability` only: the Race that learns this Ability. */
  race?: Race;
  /** `class-ability` only: the Build sub-tree this Ability belongs to. */
  build?: Build;
  /** `language` only: the Empire whose language this is (a character reads the *other* two). */
  empire?: Empire;
};

const MS_PER_HOUR = 3_600_000;
// Every readable shares a ~24h read cooldown (probabilistic, a failed read still burns the book), so
// as gates they are all identical 24h timers — bar Biologist's 22h hand-in. Mirrors `config.ts`'s
// `RECURRING_SEED` durations exactly, so a catalog-seeded chore reads the same as the shipped seed.
const GATE_MS = 24 * MS_PER_HOUR;
const BIOLOGIST_MS = 22 * MS_PER_HOUR;

// Ladder ids reused verbatim from `recurring.ts`'s `LADDERS` (the same seam `config.ts` uses): the
// 55-rung M1→G1 ability ladder, the 20-rung M1-cap language ladder, and the three universal ladders.
const LADDER_ABILITY = "class-skill";
const LADDER_LANGUAGE = "language";
const LADDER_LEADERSHIP = "leadership";
const LADDER_TRANSFORMATION = "transformation";
const LADDER_BIOLOGIST = "biologist";

/**
 * The Builds each Race can specialise into — the data fact behind "a Race has a subset of
 * Abilities" and the Lycan single-build invariant (Lycan has exactly one entry, "Instinct").
 */
const BUILDS_BY_RACE: Record<Race, Build[]> = {
  Warrior: ["Body", "Mental"],
  Ninja: ["Blade-Fight", "Archery"],
  Sura: ["Weaponry", "Black Magic"],
  Shaman: ["Dragon", "Healing"],
  Lycan: ["Instinct"],
};

// The Abilities each Build levels — a faithful ~6-per-build set. Exact names vary by server/version
// and correcting them is data maintenance, not part of this module (PRD #47, "Out of Scope"); what
// is load-bearing is that each Build yields its own distinct set and no other Race's.
const ABILITIES: Record<Build, string[]> = {
  // Warrior
  Body: ["Aura of the Sword", "Sword Spin", "Berserker", "Dash", "Three-Way Cut", "Strong Body"],
  Mental: ["Bash", "Stump", "Wild Slash", "Heaven Strike", "Mighty Strike", "Death Blow"],
  // Ninja
  "Blade-Fight": ["Stealth", "Dagger Stab", "Insidious Cut", "Poison Field", "Spark", "Roll"],
  Archery: ["Repetitive Shot", "Arrow Shower", "Fire Arrow", "Poison Arrow", "Eagle Eyes", "Feather Walk"],
  // Sura
  Weaponry: ["Dark Strike", "Sword Aura", "Fear", "Enchanted Blade", "Dispel", "Blood Pumping"],
  "Black Magic": ["Dark Orb", "Flame Spirit", "Flame Strike", "Spirit Strike", "Dark Protection", "Magic Shield"],
  // Shaman
  Dragon: ["Dragon's Roar", "Dragon's Strike", "Lightning Claw", "Lightning Throw", "Dragon Strength", "Cloud Spirit"],
  Healing: ["Cure", "Heal", "Blessing", "Reflect", "Attack Up", "Magic Up"],
  // Lycan
  Instinct: ["Wolf Howl", "Claw Tearing", "Crescent Strike", "Lycan Rush", "Pulverize", "Sharp Wolf"],
};

// The three Language chores, one per Empire. A character reads the *other two* empires' languages
// (never its own) — `subsetFor` filters on `empire`. Each is a 20-rung ladder capped at M1.
const LANGUAGES: ChorePreform[] = (["Shinsoo", "Chunjo", "Jinno"] as Empire[]).map((empire) => ({
  name: `${empire} Language`,
  durationMs: GATE_MS,
  kind: "gate",
  ladderId: LADDER_LANGUAGE,
  category: "language",
  empire,
}));

// The universal chores — present on every character regardless of Race or Empire (Leadership, the
// four-chore Transformation set sharing one ladder, and the Biologist consignment chain).
const UNIVERSAL: ChorePreform[] = [
  { name: "Leadership", durationMs: GATE_MS, kind: "gate", ladderId: LADDER_LEADERSHIP, category: "leadership" },
  { name: "Transformation", durationMs: GATE_MS, kind: "gate", ladderId: LADDER_TRANSFORMATION, category: "transformation" },
  { name: "Inspiration", durationMs: GATE_MS, kind: "gate", ladderId: LADDER_TRANSFORMATION, category: "transformation" },
  { name: "Charisma", durationMs: GATE_MS, kind: "gate", ladderId: LADDER_TRANSFORMATION, category: "transformation" },
  { name: "Mining", durationMs: GATE_MS, kind: "gate", ladderId: LADDER_TRANSFORMATION, category: "transformation" },
  { name: "Biologist", durationMs: BIOLOGIST_MS, kind: "gate", ladderId: LADDER_BIOLOGIST, category: "biologist" },
];

/** Build one `class-ability` preform from its Race + Build + Ability name (55-rung M1→G1 ladder). */
const abilityPreform = (race: Race, build: Build, name: string): ChorePreform => ({
  name,
  durationMs: GATE_MS,
  kind: "gate",
  ladderId: LADDER_ABILITY,
  category: "class-ability",
  race,
  build,
});

/** The (race-independent) Builds a Race can specialise into — Lycan returns exactly one. */
export function buildsFor(race: Race): Build[] {
  return BUILDS_BY_RACE[race];
}

/**
 * Resolve the chore preforms for a `(empire, race, builds)` tuple — the catalog's one resolving
 * interface. Returns, in stable catalog order:
 *   1. the UNIVERSAL chores (always present, regardless of race/empire);
 *   2. the `class-ability` preforms for `race`, filtered to the VALID subset of `builds` (intersected
 *      with the race's own builds, so a foreign/invalid build is ignored and Lycan only ever yields
 *      "Instinct"); a chosen single build yields just that build's abilities;
 *   3. the two foreign LANGUAGE preforms — every empire's language EXCEPT the character's own.
 *
 * Lenient on the optional axes (so #54 can resolve an unclassified migrated character): a `undefined`
 * race contributes no abilities; a `undefined` empire contributes no languages. The universals always
 * come through. Pure — no clock, no I/O; the same tuple always yields the same preforms.
 */
export function subsetFor(empire: Empire | undefined, race: Race | undefined, builds: Build[]): ChorePreform[] {
  const abilities: ChorePreform[] = [];
  if (race) {
    // Only builds that actually belong to this race count — this is where the Lycan single-build
    // invariant bites (its only valid build is "Instinct"), and where a stray foreign build is dropped.
    const valid = buildsFor(race).filter((b) => builds.includes(b));
    for (const build of valid) {
      for (const name of ABILITIES[build]) abilities.push(abilityPreform(race, build, name));
    }
  }
  // The two foreign languages: every language whose empire isn't the character's own. With no empire
  // chosen we can't say which to exclude, so none are added (the unclassified-character case).
  const languages = empire ? LANGUAGES.filter((l) => l.empire !== empire) : [];
  return [...UNIVERSAL, ...abilities, ...languages];
}
