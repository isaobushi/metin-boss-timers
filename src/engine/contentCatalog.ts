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
// TRANSCRIBED, not translated: values come from the user's official-German-client worksheet
// (de-transcription.md), cross-checked row by row against the Gameforge DE wiki — where the two
// disagreed the user picked the wiki spelling. Every key from seededContentKeys() is listed
// explicitly — the strict key-set guard in contentCatalog.test.ts fails CI on a missing or
// orphaned key — and a human can vet each row.
// NOTE(#85): two values intentionally keep their English spelling — recurring.alastor-pet and
// recurring.white-navy-uniform-costume (the 2026-06-11 seed swap). Kept as-is by HITL decision
// rather than transcribed; they stay EXPLICIT entries (not omitted-with-fallback) because the
// strict guard requires every key present.
const DE: Record<string, string> = {
  // ---- Cooldowns (bosses) ----
  "cooldown.hydra":             "Hydra",
  "cooldown.razador":           "Razador",
  "cooldown.nemere":            "Nemere",
  "cooldown.meley":             "Meley",
  "cooldown.balathor":          "Balathor",
  "cooldown.northwind-war-chief": "Nordwind-Kriegshäuptling",

  // ---- Recurring seed (deadline items) ----
  "recurring.alastor-pet":      "Alastor Pet",
  "recurring.white-navy-uniform-costume": "White Navy Uniform Costume",
  "recurring.battle-horse":     "Kampfgaul",

  // ---- Recurring seed (gate chores — universals) ----
  "recurring.skill-books":      "Fertigkeitsbücher",
  "recurring.transformation":   "Verwandlung",
  "recurring.inspiration":      "Inspiration",
  "recurring.charisma":         "Charisma",
  "recurring.mining":           "Bergbau",
  "recurring.leadership":       "Führung",
  "recurring.jinno-language":   "Jinno-Sprache",
  "recurring.chunjo-language":  "Chunjo-Sprache",
  "recurring.shinsoo-language": "Shinsoo-Sprache",
  "recurring.biologist":        "Biologe",

  // ---- Per-school Ward (7th) — generic, shared across every school's list (#57) ----
  "recurring.ward":             "Bannkreis",

  // ---- Warrior / Body ----
  "recurring.aura-of-the-sword":  "Aura des Schwertes",
  "recurring.berserk":            "Kampfrausch",
  "recurring.dash":               "Sausen",
  "recurring.sword-spin":         "Schwertwirbel",
  "recurring.three-way-cut":      "Dreiwege-Schnitt",
  "recurring.life-force":         "Lebenswille",
  "recurring.sword-spin-boost":   "Schwertwirbel-Boost",
  "recurring.earthquake":         "Erdbeben",

  // ---- Warrior / Mental ----
  "recurring.bash":               "Heftiges Schlagen",
  "recurring.stump":              "Stampfer",
  "recurring.sword-strike":       "Schwertschlag",
  "recurring.sword-orb":          "Schwertzirkel",
  "recurring.spirit-strike":      "Durchschlag",
  "recurring.strong-body":        "Starker Körper",
  "recurring.spirit-strike-boost": "Durchschlag-Boost",
  // recurring.earthquake shared with Body — keyed once above

  // ---- Ninja / Blade-Fight ----
  "recurring.ambush":             "Hinterhalt",
  "recurring.fast-attack":        "Blitzangriff",
  "recurring.rolling-dagger":     "Degenwirbel",
  "recurring.poisonous-cloud":    "Giftwolke",
  "recurring.insidious-poison":   "Schleichendes Gift",
  "recurring.stealth":            "Tarnung",
  "recurring.ambush-boost":       "Hinterhalt-Boost",
  "recurring.astral-light":       "Lichtsterne",

  // ---- Ninja / Archery ----
  "recurring.repetitive-shot":    "Wiederholter Schuss",
  "recurring.arrow-shower":       "Pfeilregen",
  "recurring.fire-arrow":         "Feuerpfeil",
  "recurring.poison-arrow":       "Giftpfeil",
  "recurring.spark":              "Funkenschlag",
  "recurring.feather-walk":       "Federschreiten",
  "recurring.fire-arrow-boost":   "Feuerpfeil-Boost",
  "recurring.tempestus":          "Sturmschuss",

  // ---- Sura / Weaponry ----
  "recurring.finger-strike":      "Fingerschlag",
  "recurring.hell-strike":        "Höllenstoß",
  "recurring.dragon-swirl":       "Drachenwirbel",
  "recurring.enchanted-blade":    "Verzauberte Klinge",
  "recurring.fear":               "Furcht",
  "recurring.dispel":             "Zauber aufheben",
  "recurring.finger-strike-boost": "Fingerschlag-Boost",
  "recurring.infernus":           "Feuergeist",

  // ---- Sura / Black Magic ----
  "recurring.dark-orb":           "Dunkler Stein",
  "recurring.dark-strike":        "Dunkler Schlag",
  "recurring.flame-strike":       "Flammenschlag",
  "recurring.flame-spirit":       "Geist der Flamme",
  // recurring.spirit-strike shared with Warrior Mental — keyed once above
  "recurring.death-wave":         "Todeswelle",
  "recurring.dark-strike-boost":  "Dunkler Schlag-Boost",
  "recurring.lethal-wave":        "Dunkle Welle",

  // ---- Shaman / Dragon ----
  "recurring.dragon-s-roar":      "Drachengebrüll",
  "recurring.shooting-dragon":    "Drachenschießen",
  "recurring.flying-talisman":    "Fliegender Talisman",
  "recurring.dragon-s-aid":       "Hilfe des Drachen",
  "recurring.blessing":           "Segen",
  "recurring.reflect":            "Reflektieren",
  "recurring.shooting-dragon-boost": "Drachenschießen-Boost",
  "recurring.meteor":             "Meteor",

  // ---- Shaman / Healing ----
  "recurring.cure":               "Kurieren",
  "recurring.swiftness":          "Schnelligkeit",
  "recurring.attack-up":          "Angriff+",
  "recurring.lightning-claw":     "Blitzkralle",
  "recurring.lightning-throw":    "Blitzwurf",
  "recurring.summon-lightning":   "Blitz heraufbeschwören",
  "recurring.summon-lightning-boost": "Blitz heraufbeschwören-Boost",
  "recurring.ethereal-shield":    "Ätherschild",

  // ---- Lycan / Instinct ----
  "recurring.crimson-wolf-soul":  "Purpurwolfseele",
  "recurring.indigo-wolf-soul":   "Indigowolfseele",
  "recurring.shred":              "Zerreißen",
  "recurring.wolf-s-breath":      "Atem des Wolfes",
  "recurring.wolf-s-claw":        "Wolfsklaue",
  "recurring.wolf-pounce":        "Wolfssprung",
  "recurring.wolf-s-breath-boost": "Atem des Wolfes-Boost",
  "recurring.cicatrix":           "Cicatrix",

  // ---- Empires ----
  "empire.shinsoo": "Shinsoo",
  "empire.chunjo":  "Chunjo",
  "empire.jinno":   "Jinno",

  // ---- Races ----
  "race.warrior": "Krieger",
  "race.ninja":   "Ninja",
  "race.sura":    "Sura",
  "race.shaman":  "Schamane",
  "race.lycan":   "Lykaner",

  // ---- Builds (schools) ----
  "build.body":        "Körper",
  "build.mental":      "Mental",
  "build.blade-fight": "Klinge",
  "build.archery":     "Bogenschießen",
  "build.weaponry":    "Waffen",
  "build.black-magic": "Schwarze Magie",
  "build.dragon":      "Drachen",
  "build.healing":     "Heilung",
  "build.instinct":    "Instinkt",

  // ---- Biologist consignment items ----
  "biologist.orc-tooth":            "Orkzahn",
  "biologist.curse-book":           "Fluchsammlung",
  "biologist.demon-s-keepsake":     "Dämonenandenken",
  "biologist.ice-marble":           "Eisige Murmel",
  "biologist.zelkova-branch":       "Zelkowazweig",
  "biologist.tugyi-s-tablet":       "Tugyis Tafel",
  "biologist.red-ghost-tree-branch": "Roter Geisterbaumzweig",
  "biologist.leaders-notes":        "Anführer-Notizen",
  "biologist.malevolence-jewel":    "Bosheitsjuwel",
  "biologist.wisdom-jewel":         "Weisheitsjuwel",
};

// ---- Italian content table (#99 slice 1) ----
// Game-content names that must match the official Italian Metin2 client. PROVENANCE is mixed:
//   • The 71 class-skill keys are SEEDED from the validated metin2alerts dump
//     (reference/metin2alerts/skills-by-catalogkey.json, names.it) via scripts/reseed-it-from-dump.mjs.
//     That dump scored 68/71 exact vs the hand-transcribed DE client table, so it is a trustworthy
//     seed; for Italian the maintainer (native speaker) does the cross-check the house rule asks for.
//   • The 10 Biologist consign items are sourced from the official client item DB
//     (metin2alerts item_names/it.pbf via scripts/decode-item-names.mjs) — validated, not guessed.
//   • The rest the skills dump doesn't carry — bosses, empires, races, builds, the app-chores
//     (skill-books/transformation/biologist/ward) and a few proper-noun ultimates — are still
//     HAND-DRAFTED and marked `// ?`. Verify first against the IT client / Gameforge IT wiki.
//     Proper nouns (Tempestus, Infernus, Cicatrix, the Empires) the client keeps verbatim,
//     confirmed against the store locale dump. (Bosses are mobs — sourceable from the dump's
//     mob_names endpoint if needed; not yet pulled.)
//
// Like DE, every key from seededContentKeys() is listed explicitly so the strict guard in
// contentCatalog.test.ts fails CI on any gap or orphan.
// NOTE: the two 2026-06-11 seed-swap items (alastor-pet, white-navy-uniform-costume) keep their
// English spelling here, mirroring the DE HITL decision — change only if the IT client differs.
const IT: Record<string, string> = {
  // ---- Cooldowns (bosses) ----
  // Sourced from the official mob DB (metin2alerts mob_names/it.json, matched by EN name → vnum).
  "cooldown.hydra":             "Idra",       // en "Hydra" (vnum 3964) — Italianized in client
  "cooldown.razador":           "Razador",    // verbatim (vnum 6437)
  "cooldown.nemere":            "Nemere",     // verbatim (vnum 6435)
  "cooldown.meley":             "Meley",      // short form of "Meley, Regina d. draghi" (vnum 6193)
  "cooldown.balathor":          "Balathor",   // verbatim (vnum 6897)
  "cooldown.northwind-war-chief": "Condottiero boreale", // en "Northwind War Chief" (vnum 6895)

  // ---- Recurring seed (deadline items) ----
  "recurring.alastor-pet":      "Alastor Pet",
  "recurring.white-navy-uniform-costume": "White Navy Uniform Costume",
  "recurring.battle-horse":     "Cavallo da battaglia",

  // ---- Recurring seed (gate chores — universals) ----
  "recurring.skill-books":      "Libri delle abilità",
  "recurring.transformation":   "Trasformazione",
  "recurring.inspiration":  "Ispirazione",
  "recurring.charisma":  "Carisma",
  "recurring.mining":  "Scienza mineraria",
  "recurring.leadership":  "Guida",
  // Cosmetic-diff override (same as DE's "…-Sprache"): the dump gives bare "Jinno/Chunjo/Shinsoo"
  // for the language chore, which collides with the Empire names. "Lingua X" confirmed by the
  // maintainer against the IT client (2026-06-14).
  "recurring.jinno-language":   "Lingua Jinno",
  "recurring.chunjo-language":  "Lingua Chunjo",
  "recurring.shinsoo-language": "Lingua Shinsoo",
  "recurring.biologist":        "Biologo",

  // ---- Per-school Ward (7th) — generic, shared across every school's list (#57) ----
  "recurring.ward":             "Contrattacco",

  // ---- Warrior / Body ----
  "recurring.aura-of-the-sword":  "Aura della spada",
  "recurring.berserk":  "Estasi da combattimento",
  "recurring.dash":  "Sibilare",
  "recurring.sword-spin":  "Vortice di spada",
  "recurring.three-way-cut":  "Taglio a tre vie",
  "recurring.life-force":  "Volontà di vivere",
  "recurring.sword-spin-boost":  "Boost Vortice di spada",
  "recurring.earthquake":  "Terremoto",

  // ---- Warrior / Mental ----
  "recurring.bash":  "Colpo potente",
  "recurring.stump":  "Pestone",
  "recurring.sword-strike":  "Colpo di spada",
  "recurring.sword-orb":  "Orb della spada",
  "recurring.spirit-strike":      "Colpo di spirito",
  "recurring.strong-body":  "Corpo forte",
  "recurring.spirit-strike-boost":  "Boost Penetrazione",
  // recurring.earthquake shared with Body — keyed once above

  // ---- Ninja / Blade-Fight ----
  "recurring.ambush":  "Tranello",
  "recurring.fast-attack":  "Attacco lampo",
  "recurring.rolling-dagger":  "Vortice del pugnale",
  "recurring.poisonous-cloud":  "Nuvola velenosa",
  "recurring.insidious-poison":  "Veleno insidioso",
  "recurring.stealth":  "Camuffamento",
  "recurring.ambush-boost":  "Boost Tranello",
  "recurring.astral-light":  "Luce astrale",

  // ---- Ninja / Archery ----
  "recurring.repetitive-shot":  "Tiro ripetuto",
  "recurring.arrow-shower":  "Pioggia di frecce",
  "recurring.fire-arrow":  "Freccia di fuoco",
  "recurring.poison-arrow":  "Freccia avvelenata",
  "recurring.spark":  "Colpo sfavillante",
  "recurring.feather-walk":  "Passo piumato",
  "recurring.fire-arrow-boost":  "Boost Freccia di fuoco",
  "recurring.tempestus":          "Tempestus",

  // ---- Sura / Weaponry ----
  "recurring.finger-strike":  "Schiocco di dita",
  "recurring.hell-strike":  "Infernus",
  "recurring.dragon-swirl":  "Vortice del drago",
  "recurring.enchanted-blade":  "Lama incantata",
  "recurring.fear":  "Paura",
  "recurring.dispel":  "Annullamento magia",
  "recurring.finger-strike-boost":  "Boost Schiocco di dita",
  "recurring.infernus":           "Infernus",

  // ---- Sura / Black Magic ----
  "recurring.dark-orb":  "Pietra oscura",
  "recurring.dark-strike":  "Colpo oscuro",
  "recurring.flame-strike":  "Colpo di fiamma",
  "recurring.flame-spirit":  "Spirito della fiamma",
  // recurring.spirit-strike shared with Warrior Mental — keyed once above
  "recurring.death-wave":  "Onda letale",
  "recurring.dark-strike-boost":  "Boost Colpo oscuro",
  "recurring.lethal-wave":        "Onda letale",

  // ---- Shaman / Dragon ----
  "recurring.dragon-s-roar":  "Ruggito del drago",
  "recurring.shooting-dragon":  "Tiro del drago",
  "recurring.flying-talisman":  "Talismano volante",
  "recurring.dragon-s-aid":  "Aiuto del drago",
  "recurring.blessing":  "Benedizione",
  "recurring.reflect":  "Riflessione",
  "recurring.shooting-dragon-boost":  "Boost Tiro del drago",
  "recurring.meteor":  "Meteora",

  // ---- Shaman / Healing ----
  "recurring.cure":  "Cura",
  "recurring.swiftness":  "Rapidità",
  "recurring.attack-up":  "Attacco+",
  "recurring.lightning-claw":  "Artiglio di lampo",
  "recurring.lightning-throw":  "Lancio di lampi",
  "recurring.summon-lightning":  "Evocare i lampi",
  "recurring.summon-lightning-boost":  "Boost Evocare i lampi",
  "recurring.ethereal-shield":    "Scudo etereo",

  // ---- Lycan / Instinct ----
  "recurring.crimson-wolf-soul":  "Anima del lupo purpureo",
  "recurring.indigo-wolf-soul":  "Anima del lupo indaco",
  "recurring.shred":  "Strazio",
  "recurring.wolf-s-breath":  "Respiro del lupo",
  "recurring.wolf-s-claw":  "Artiglio di lupo",
  "recurring.wolf-pounce":  "Salto del lupo",
  "recurring.wolf-s-breath-boost":  "Boost Respiro del lupo",
  "recurring.cicatrix":           "Cicatrix",

  // ---- Empires ----
  "empire.shinsoo": "Shinsoo",
  "empire.chunjo":  "Chunjo",
  "empire.jinno":   "Jinno",

  // ---- Races ----
  // Sourced from the official client class table (metin2alerts locale/it.json JOB_* keys).
  "race.warrior": "Guerriero", // JOB_WARRIOR
  "race.ninja":   "Ninja",     // JOB_ASSASSIN
  "race.sura":    "Sura",      // JOB_SURA
  "race.shaman":  "Shamano",   // JOB_SHAMAN (client spelling, not "Sciamano")
  "race.lycan":   "Lican",     // JOB_WOLFMAN (client spelling, not "Lycan")

  // ---- Builds (schools) ----
  // School names confirmed by the maintainer against the IT client (2026-06-14).
  "build.body":        "Corpo",
  "build.mental":      "Mentale",
  "build.blade-fight": "Corpo a Corpo",
  "build.archery":     "Arco",
  "build.weaponry":    "Armi magiche",
  "build.black-magic": "Magia Nera",
  "build.dragon":      "Drago",
  "build.healing":     "Guarigione",
  "build.instinct":    "Istinto", // ? maintainer unsure this school name exists/spelling

  // ---- Biologist consignment items ----
  // Sourced from the official client item DB (metin2alerts item_names/it.pbf, decoded by
  // scripts/decode-item-names.mjs) — matched by EN name, IT read from the same item id. The
  // trailing "+" refine marker the dump uses is stripped. red-ghost is the client's abbreviated
  // form ("Fanta." = Fantasma); expand only if the in-app row is too cramped to read.
  "biologist.orc-tooth":            "Dente di Orco",
  "biologist.curse-book":           "Libro delle maledizioni",
  "biologist.demon-s-keepsake":     "Ricordo di Demone",
  "biologist.ice-marble":           "Palla di Ghiaccio",
  "biologist.zelkova-branch":       "Ramo di Zelkova",
  "biologist.tugyi-s-tablet":       "Tavola di Tugyi",
  "biologist.red-ghost-tree-branch": "Ramo Albero Fanta. Rosso", // client abbreviation, kept (maintainer-confirmed)
  "biologist.leaders-notes":        "Notizie dei Capi",
  "biologist.malevolence-jewel":    "Gioiello dell'Invidia",
  "biologist.wisdom-jewel":         "Gioiello della saggezza",
};

const TABLES: Record<Locale, Record<string, string>> = {
  en: EN,
  de: DE,
  it: IT,
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
 * The raw key set of one locale's content table — guard support only. The resolve-time English
 * fallback in `displayName` means a missing key is INVISIBLE at runtime (the user silently gets
 * English), so the strict guard in contentCatalog.test.ts compares each table's keys against
 * `seededContentKeys()` directly: a gap or an orphaned (mis-slugged) key fails CI, not a player.
 */
export function localeContentKeys(locale: Locale): string[] {
  return Object.keys(TABLES[locale]);
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
