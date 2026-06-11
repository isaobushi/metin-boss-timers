// Pure content-catalog resolver (PRD #77, slice #81): the deep module that owns "how a seeded item
// is spelled in a given locale". Its interface is one stable shape — `displayName(catalogKey,
// locale) -> string` — hiding all per-locale data behind it. Like the rest of the engine it owns no
// clock, no React, no storage.
//
// SEPARATION OF CONCERNS: this resolver handles GAME CONTENT (bosses, abilities, chores, items,
// Empire/Race/Build) — names that must be TRANSCRIBED from each official client, never free-
// translated. UI chrome (buttons, settings labels) is a different concern with its own `t()` lookup
// (slice #84); it is deliberately NOT handled here, so a game term is never accidentally translated.
//
// ENGLISH IS BUILT FROM THE SEED LITERALS, not hand-duplicated: the `en` table is assembled by
// re-indexing the existing seed/catalog/hint names under their `catalogKey`. So there is exactly one
// place the English string lives (the seed), `en` can never drift from it, and `displayName(key,
// "en")` returns the same string the def's frozen `name` already holds — which is why routing the
// overlay through the resolver is a no-op in English (slice #81) and only diverges once a hand-
// authored locale (German, slice #85) is added.

import { COOLDOWN_SEED, RECURRING_SEED } from "./config";
import { BUILDS, EMPIRES, RACES, catalogChoreNames } from "./skillCatalog";
import { BIOLOGIST_HINTS } from "./recurring";
import { biologistItemKey, buildKey, cooldownKey, empireKey, raceKey, recurringKey } from "./contentKeys";
import { DEFAULT_LOCALE, type Locale } from "./localeTypes";
export type { Locale } from "./localeTypes";
export { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./localeTypes";

/**
 * The English content table, re-indexed from the seed/catalog/hint literals by `catalogKey`. Every
 * seeded source contributes: the cooldown + recurring seeds, every catalog chore (universals, class
 * Abilities, Languages), the Empire/Race/Build enums, and the Biologist consignment items. Names that
 * repeat across sources (e.g. a chore present in both the config seed and the catalog, or a shared
 * 9th skill) collapse to one key with the same value — idempotent, never conflicting.
 */
function buildEnglish(): Record<string, string> {
  const en: Record<string, string> = {};
  for (const cd of COOLDOWN_SEED) en[cooldownKey(cd.name)] = cd.name;
  for (const r of RECURRING_SEED) en[recurringKey(r.name)] = r.name;
  for (const name of catalogChoreNames()) en[recurringKey(name)] = name;
  for (const e of EMPIRES) en[empireKey(e)] = e;
  for (const r of RACES) en[raceKey(r)] = r;
  for (const b of BUILDS) en[buildKey(b)] = b;
  for (const item of BIOLOGIST_HINTS) en[biologistItemKey(item)] = item;
  return en;
}

const EN = buildEnglish();

// ---- German content table (slice #85) ----
// TODO(#85): placeholder — replace every value with the official German client transcription
// (see de-transcription.md). Every key from seededContentKeys() is listed explicitly so the
// completeness guard passes and a human can vet each row. Values are set to the English string
// as a safe fallback until the transcription worksheet is returned.
const DE: Record<string, string> = {
  // ---- Cooldowns (bosses) ----
  "cooldown.hydra":             "Hydra",
  "cooldown.razador":           "Razador",
  "cooldown.nemere":            "Nemere",
  "cooldown.meley":             "Meley",
  "cooldown.balathor":          "Balathor",
  "cooldown.northwind-war-chief": "Northwind War Chief",

  // ---- Recurring seed (deadline items) ----
  "recurring.alastor-pet":      "Alastor Pet",
  "recurring.white-navy-uniform-costume": "White Navy Uniform Costume",
  "recurring.battle-horse":     "Battle Horse",

  // ---- Recurring seed (gate chores — universals) ----
  "recurring.skill-books":      "Skill Books",
  "recurring.transformation":   "Transformation",
  "recurring.inspiration":      "Inspiration",
  "recurring.charisma":         "Charisma",
  "recurring.mining":           "Mining",
  "recurring.leadership":       "Leadership",
  "recurring.jinno-language":   "Jinno Language",
  "recurring.chunjo-language":  "Chunjo Language",
  "recurring.shinsoo-language": "Shinsoo Language",
  "recurring.biologist":        "Biologist",

  // ---- Catalog universals ----
  "recurring.ward-skill":       "Ward Skill",

  // ---- Warrior / Body ----
  "recurring.aura-of-the-sword":  "Aura of the Sword",
  "recurring.berserk":            "Berserk",
  "recurring.dash":               "Dash",
  "recurring.sword-spin":         "Sword Spin",
  "recurring.three-way-cut":      "Three-Way Cut",
  "recurring.life-force":         "Life Force",
  "recurring.sword-spin-boost":   "Sword Spin Boost",
  "recurring.earthquake":         "Earthquake",

  // ---- Warrior / Mental ----
  "recurring.bash":               "Bash",
  "recurring.stump":              "Stump",
  "recurring.sword-strike":       "Sword Strike",
  "recurring.sword-orb":          "Sword Orb",
  "recurring.spirit-strike":      "Spirit Strike",
  "recurring.strong-body":        "Strong Body",
  "recurring.spirit-strike-boost": "Spirit Strike Boost",
  // recurring.earthquake shared with Body — keyed once above

  // ---- Ninja / Blade-Fight ----
  "recurring.ambush":             "Ambush",
  "recurring.fast-attack":        "Fast Attack",
  "recurring.rolling-dagger":     "Rolling Dagger",
  "recurring.poisonous-cloud":    "Poisonous Cloud",
  "recurring.insidious-poison":   "Insidious Poison",
  "recurring.stealth":            "Stealth",
  "recurring.ambush-boost":       "Ambush Boost",
  "recurring.astral-light":       "Astral Light",

  // ---- Ninja / Archery ----
  "recurring.repetitive-shot":    "Repetitive Shot",
  "recurring.arrow-shower":       "Arrow Shower",
  "recurring.fire-arrow":         "Fire Arrow",
  "recurring.poison-arrow":       "Poison Arrow",
  "recurring.spark":              "Spark",
  "recurring.feather-walk":       "Feather Walk",
  "recurring.fire-arrow-boost":   "Fire Arrow Boost",
  "recurring.tempestus":          "Tempestus",

  // ---- Sura / Weaponry ----
  "recurring.finger-strike":      "Finger Strike",
  "recurring.hell-strike":        "Hell Strike",
  "recurring.dragon-swirl":       "Dragon Swirl",
  "recurring.enchanted-blade":    "Enchanted Blade",
  "recurring.fear":               "Fear",
  "recurring.dispel":             "Dispel",
  "recurring.finger-strike-boost": "Finger Strike Boost",
  "recurring.infernus":           "Infernus",

  // ---- Sura / Black Magic ----
  "recurring.dark-orb":           "Dark Orb",
  "recurring.dark-strike":        "Dark Strike",
  "recurring.flame-strike":       "Flame Strike",
  "recurring.flame-spirit":       "Flame Spirit",
  // recurring.spirit-strike shared with Warrior Mental — keyed once above
  "recurring.death-wave":         "Death Wave",
  "recurring.dark-strike-boost":  "Dark Strike Boost",
  "recurring.lethal-wave":        "Lethal Wave",

  // ---- Shaman / Dragon ----
  "recurring.dragon-s-roar":      "Dragon's Roar",
  "recurring.shooting-dragon":    "Shooting Dragon",
  "recurring.flying-talisman":    "Flying Talisman",
  "recurring.dragon-s-aid":       "Dragon's Aid",
  "recurring.blessing":           "Blessing",
  "recurring.reflect":            "Reflect",
  "recurring.shooting-dragon-boost": "Shooting Dragon Boost",
  "recurring.meteor":             "Meteor",

  // ---- Shaman / Healing ----
  "recurring.cure":               "Cure",
  "recurring.swiftness":          "Swiftness",
  "recurring.attack-up":          "Attack Up",
  "recurring.lightning-claw":     "Lightning Claw",
  "recurring.lightning-throw":    "Lightning Throw",
  "recurring.summon-lightning":   "Summon Lightning",
  "recurring.summon-lightning-boost": "Summon Lightning Boost",
  "recurring.ethereal-shield":    "Ethereal Shield",

  // ---- Lycan / Instinct ----
  "recurring.crimson-wolf-soul":  "Crimson Wolf Soul",
  "recurring.indigo-wolf-soul":   "Indigo Wolf Soul",
  "recurring.shred":              "Shred",
  "recurring.wolf-s-breath":      "Wolf's Breath",
  "recurring.wolf-s-claw":        "Wolf's Claw",
  "recurring.wolf-pounce":        "Wolf Pounce",
  "recurring.wolf-s-breath-boost": "Wolf's Breath Boost",
  "recurring.cicatrix":           "Cicatrix",

  // ---- Empires ----
  "empire.shinsoo": "Shinsoo",
  "empire.chunjo":  "Chunjo",
  "empire.jinno":   "Jinno",

  // ---- Races ----
  "race.warrior": "Warrior",
  "race.ninja":   "Ninja",
  "race.sura":    "Sura",
  "race.shaman":  "Shaman",
  "race.lycan":   "Lycan",

  // ---- Builds (schools) ----
  "build.body":        "Body",
  "build.mental":      "Mental",
  "build.blade-fight": "Blade-Fight",
  "build.archery":     "Archery",
  "build.weaponry":    "Weaponry",
  "build.black-magic": "Black Magic",
  "build.dragon":      "Dragon",
  "build.healing":     "Healing",
  "build.instinct":    "Instinct",

  // ---- Biologist consignment items ----
  "biologist.orc-tooth":            "Orc Tooth",
  "biologist.curse-book":           "Curse Book",
  "biologist.demon-s-keepsake":     "Demon's Keepsake",
  "biologist.ice-marble":           "Ice Marble",
  "biologist.zelkova-branch":       "Zelkova Branch",
  "biologist.tugyi-s-tablet":       "Tugyi's Tablet",
  "biologist.red-ghost-tree-branch": "Red Ghost Tree Branch",
  "biologist.leaders-notes":        "Leaders' Notes",
  "biologist.malevolence-jewel":    "Malevolence Jewel",
  "biologist.wisdom-jewel":         "Wisdom Jewel",
};

const TABLES: Record<Locale, Record<string, string>> = {
  en: EN,
  de: DE,
};

/**
 * Resolve a seeded item's display name in `locale`. Falls back to the English string when the locale
 * lacks the key (so a partially-authored locale never renders blank), and — defensively — to the raw
 * key only for a key in no table at all (unreachable for seeded keys, which the completeness guard
 * pins into `en`). Pure: same `(key, locale)` always yields the same string.
 */
export function displayName(catalogKey: string, locale: Locale = DEFAULT_LOCALE): string {
  return TABLES[locale]?.[catalogKey] ?? EN[catalogKey] ?? catalogKey;
}

/**
 * The display name for any def-like item: resolve a SEEDED item (one carrying a `catalogKey`) through
 * the locale tables, but render a USER-CREATED item's free-text `name` verbatim — the overlay's single
 * seam for "seeded content localizes, user content is left exactly as typed".
 */
export function resolveDisplayName(item: { catalogKey?: string; name: string }, locale: Locale = DEFAULT_LOCALE): string {
  return item.catalogKey ? displayName(item.catalogKey, locale) : item.name;
}

/** Every seeded content key (the keys of the English table) — the set the completeness guard checks. */
export function seededContentKeys(): string[] {
  return Object.keys(EN);
}

/**
 * Name → catalogKey reverse lookup over one kind's namespace, derived FROM the English table itself
 * (not by re-walking the seeds), so it can never drift from `buildEnglish` — one enumeration owns
 * both directions. Injective within a namespace because every key is derived from its name.
 */
function reverseEnglish(kind: string): ReadonlyMap<string, string> {
  const byName = new Map<string, string>();
  for (const [key, name] of Object.entries(EN)) if (key.startsWith(`${kind}.`)) byName.set(name, key);
  return byName;
}

/** Name → cooldown catalogKey for every seeded cooldown (slice #82's migration matches against this). */
export const SEEDED_COOLDOWN_KEY_BY_NAME: ReadonlyMap<string, string> = reverseEnglish("cooldown");

/** Name → recurring catalogKey for every seeded recurring source (config seed + catalog chores). */
export const SEEDED_RECURRING_KEY_BY_NAME: ReadonlyMap<string, string> = reverseEnglish("recurring");
