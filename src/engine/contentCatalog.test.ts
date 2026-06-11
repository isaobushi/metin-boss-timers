import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  SEEDED_COOLDOWN_KEY_BY_NAME,
  SEEDED_RECURRING_KEY_BY_NAME,
  SUPPORTED_LOCALES,
  displayName,
  resolveDisplayName,
  seededContentKeys,
} from "./contentCatalog";
import { biologistItemKey, buildKey, cooldownKey, empireKey, recurringKey } from "./contentKeys";
import { LADDERS } from "./recurring";
import { addCooldown, addRecurring, makeConfig } from "./config";

describe("displayName resolver", () => {
  it("resolves a known seeded key to its English string", () => {
    expect(displayName(cooldownKey("Hydra"))).toBe("Hydra");
    expect(displayName(recurringKey("Leadership"))).toBe("Leadership");
    expect(displayName(empireKey("Shinsoo"))).toBe("Shinsoo");
    expect(displayName(buildKey("Black Magic"))).toBe("Black Magic");
  });

  it("defaults to the English locale", () => {
    expect(displayName(cooldownKey("Razador"))).toBe(displayName(cooldownKey("Razador"), "en"));
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("never returns blank — an unknown key falls back to a non-empty string", () => {
    const out = displayName("totally.unknown.key");
    expect(out).not.toBe("");
    expect(typeof out).toBe("string");
  });
});

describe("resolveDisplayName (seeded vs user-created seam)", () => {
  it("resolves a seeded def (carries catalogKey) through the catalog", () => {
    expect(resolveDisplayName({ catalogKey: cooldownKey("Meley"), name: "Meley" })).toBe("Meley");
  });

  it("renders a user-created def (no catalogKey) verbatim, never touching the catalog", () => {
    // A made-up English name that is NOT a seeded key — must come back exactly as typed.
    expect(resolveDisplayName({ name: "My Custom Boss" })).toBe("My Custom Boss");
  });
});

describe("completeness guard", () => {
  it("every seeded content key resolves in every shipped locale (no blanks, no raw keys)", () => {
    const keys = seededContentKeys();
    expect(keys.length).toBeGreaterThan(0);
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of keys) {
        const out = displayName(key, locale);
        expect(out, `${key} @ ${locale}`).toBeTruthy();
        expect(out, `${key} @ ${locale} resolved to the raw key`).not.toBe(key);
      }
    }
  });
});

describe("rung-label scoping (#81 decision)", () => {
  it("keys Biologist consignment items but NOT language-neutral ladder tier codes", () => {
    // Biologist stage items ARE content — keyed and resolvable.
    expect(LADDERS.biologist.hintKeys).toBeDefined();
    expect(seededContentKeys()).toContain(biologistItemKey("Orc Tooth"));
    expect(displayName(biologistItemKey("Zelkova Branch"))).toBe("Zelkova Branch");

    // Tier codes (M1/G1/P/0) are universal game notation — rung-style ladders carry NO content keys.
    expect(LADDERS["class-skill"].hintKeys).toBeUndefined();
    expect(LADDERS.transformation.hintKeys).toBeUndefined();
    // ...and no tier label leaked into the content catalog as a key.
    const tierLeak = seededContentKeys().some((k) => /\.(m\d+|g\d+|p|\d+)$/.test(k));
    expect(tierLeak).toBe(false);
  });
});

describe("frozen-name guard (#82)", () => {
  // The persistence migration backfills catalogKeys by matching the names FROZEN in old blobs
  // against the live seed tables, so a seed name is a persisted contract: renaming one strands
  // every blob that froze the old spelling. This pin fails CI on any rename until the old
  // spelling gets a LEGACY_*_ALIASES entry in persist.ts (the "Daily Books" precedent).
  it("the seeded cooldown names are exactly the frozen set", () => {
    expect([...SEEDED_COOLDOWN_KEY_BY_NAME.keys()].sort()).toEqual([
      "Balathor", "Hydra", "Meley", "Nemere", "Northwind War Chief", "Razador",
    ]);
  });

  it("the seeded recurring names are exactly the frozen set", () => {
    expect([...SEEDED_RECURRING_KEY_BY_NAME.keys()].sort()).toEqual([
      "Ambush", "Ambush Boost", "Arrow Shower", "Astral Light", "Attack Up", "Aura of the Sword",
      "Bash", "Battle Horse", "Berserk", "Biologist", "Blessing", "Charisma", "Chunjo Language",
      "Cicatrix", "Costume of Flame", "Crimson Wolf Soul", "Cure", "Dark Orb", "Dark Strike",
      "Dark Strike Boost", "Dash", "Death Wave", "Dispel", "Dragon Swirl", "Dragon's Aid",
      "Dragon's Roar", "Earthquake", "Enchanted Blade", "Ethereal Shield", "Fast Attack", "Fear",
      "Feather Walk", "Finger Strike", "Finger Strike Boost", "Fire Arrow", "Fire Arrow Boost",
      "Flame Spirit", "Flame Strike", "Flying Talisman", "Hell Strike", "Indigo Wolf Soul",
      "Infernus", "Insidious Poison", "Inspiration", "Jinno Language", "Leadership", "Lethal Wave",
      "Life Force", "Lightning Claw", "Lightning Throw", "Meteor", "Mining", "Poison Arrow",
      "Poisonous Cloud", "Reflect", "Repetitive Shot", "Rolling Dagger", "Shinsoo Language",
      "Shooting Dragon", "Shooting Dragon Boost", "Shred", "Skill Books", "Snow Wolf", "Spark",
      "Spirit Strike", "Spirit Strike Boost", "Stealth", "Strong Body", "Stump", "Summon Lightning",
      "Summon Lightning Boost", "Swiftness", "Sword Orb", "Sword Spin", "Sword Spin Boost",
      "Sword Strike", "Tempestus", "Three-Way Cut", "Transformation", "Ward Skill", "Wolf Pounce",
      "Wolf's Breath", "Wolf's Breath Boost", "Wolf's Claw",
    ]);
  });
});

describe("English is a no-op over real seeded data", () => {
  it("every seeded cooldown/recurring def carries a catalogKey resolving to its own name", () => {
    const c = makeConfig();
    for (const cd of c.cooldowns) {
      expect(cd.catalogKey, `cooldown ${cd.name} missing catalogKey`).toBeDefined();
      expect(resolveDisplayName(cd, "en")).toBe(cd.name);
    }
    for (const ch of c.characters) {
      for (const def of ch.recurring) {
        expect(def.catalogKey, `recurring ${def.name} missing catalogKey`).toBeDefined();
        expect(resolveDisplayName(def, "en")).toBe(def.name);
      }
    }
  });

  it("a user-added cooldown/recurring def has no catalogKey and renders its name verbatim", () => {
    const withCd = addCooldown(makeConfig());
    const added = withCd.cooldowns[withCd.cooldowns.length - 1];
    expect(added.catalogKey).toBeUndefined();
    expect(resolveDisplayName(added, "en")).toBe(added.name);

    const withRec = addRecurring(makeConfig(), "gate");
    const ch = withRec.characters.find((c) => c.id === withRec.activeCharacterId)!;
    const addedRec = ch.recurring[ch.recurring.length - 1];
    expect(addedRec.catalogKey).toBeUndefined();
    expect(resolveDisplayName(addedRec, "en")).toBe(addedRec.name);
  });
});
