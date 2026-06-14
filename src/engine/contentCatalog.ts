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

// ---- Spanish content table (#99) ----
// 71 class skills seeded from the metin2alerts dump (names.es); 5 races from locale/es.json
// JOB_*; proper nouns (empires, Tempestus/Infernus/Cicatrix, verbatim bosses) kept as-is. The
// `// ?` keys are hand-translated best-effort (no dump for bosses/builds/biologist/app-chores)
// and await a native Spanish cross-check. Every seededContentKeys() key is present
// (strict guard). See [[prelaunch-languages]] — seed-from-dump + spot-check house rule.
const ES: Record<string, string> = {
  // ---- Cooldowns (bosses) ----
  // cooldown.hydra + cooldown.northwind-war-chief omitted → English fallback
  // (no confirmed ES-client name; see INTENTIONAL_EN_FALLBACK).
  "cooldown.razador": "Razador",
  "cooldown.nemere": "Nemere",
  "cooldown.meley": "Meley",
  "cooldown.balathor": "Balathor",

  // ---- Recurring seed (deadline items) ----
  "recurring.alastor-pet": "Alastor Pet",
  "recurring.white-navy-uniform-costume": "White Navy Uniform Costume",
  "recurring.battle-horse": "Caballo de batalla", // ?

  // ---- Recurring seed (gate chores — universals) ----
  "recurring.skill-books": "Libros de habilidades", // ?
  "recurring.transformation": "Transformación", // ?
  "recurring.inspiration": "Inspiración",
  "recurring.charisma": "Carisma",
  "recurring.mining": "Minería",
  "recurring.leadership": "Liderazgo",
  "recurring.jinno-language": "Idioma Jinno", // ?
  "recurring.chunjo-language": "Idioma Chunjo", // ?
  "recurring.shinsoo-language": "Idioma Shinsoo", // ?
  "recurring.biologist": "Biólogo", // ?

  // ---- Per-school Ward (7th) — generic, shared across every school's list (#57) ----
  "recurring.ward": "Contraataque", // ?

  // ---- Warrior / Body ----
  "recurring.aura-of-the-sword": "Aura de espada",
  "recurring.berserk": "Berserk",
  "recurring.dash": "Rociada",
  "recurring.sword-spin": "Giro de espada",
  "recurring.three-way-cut": "Corte de tres maneras",
  "recurring.life-force": "Deseo de vivir",
  "recurring.sword-spin-boost": "Potenciador de giro de espada",
  "recurring.earthquake": "Terremoto",

  // ---- Warrior / Mental ----
  "recurring.bash": "Golpe",
  "recurring.stump": "Tocón",
  "recurring.sword-strike": "Golpe de espada",
  "recurring.sword-orb": "Círculo de espada",
  "recurring.spirit-strike": "Golpe espiritual", // ?
  "recurring.strong-body": "Cuerpo fuerte",
  "recurring.spirit-strike-boost": "Potenciador de pulso espiritual",

  // ---- Ninja / Blade-Fight ----
  "recurring.ambush": "Emboscada",
  "recurring.fast-attack": "Ataque rápido",
  "recurring.rolling-dagger": "Daga rodante",
  "recurring.poisonous-cloud": "Nube tóxica",
  "recurring.insidious-poison": "Veneno lento",
  "recurring.stealth": "Camuflaje",
  "recurring.ambush-boost": "Potenciador de emboscada",
  "recurring.astral-light": "Estrellas luz",

  // ---- Ninja / Archery ----
  "recurring.repetitive-shot": "Disparo repetido",
  "recurring.arrow-shower": "Lluvia de flechas",
  "recurring.fire-arrow": "Flecha de fuego",
  "recurring.poison-arrow": "Flecha venenosa",
  "recurring.spark": "Golpe lumínico",
  "recurring.feather-walk": "Camino pluma",
  "recurring.fire-arrow-boost": "Potenciador de flecha de fuego",
  "recurring.tempestus": "Tempestus",

  // ---- Sura / Weaponry ----
  "recurring.finger-strike": "Golpe de dedo",
  "recurring.hell-strike": "Golpe infernal",
  "recurring.dragon-swirl": "Remolino de dragón",
  "recurring.enchanted-blade": "Hoja encantada",
  "recurring.fear": "Miedo",
  "recurring.dispel": "Anular magia",
  "recurring.finger-strike-boost": "Potenciador de golpe de dedo",
  "recurring.infernus": "Infernus",

  // ---- Sura / Black Magic ----
  "recurring.dark-orb": "Orbe oscuro",
  "recurring.dark-strike": "Golpe oscuro",
  "recurring.flame-strike": "Golpe de llama",
  "recurring.flame-spirit": "Espíritu de la llama",
  "recurring.death-wave": "Onda letal",
  "recurring.dark-strike-boost": "Potenciador de golpe oscuro",
  "recurring.lethal-wave": "Ola letal", // ?

  // ---- Shaman / Dragon ----
  "recurring.dragon-s-roar": "Rugido del dragón",
  "recurring.shooting-dragon": "Disparo del dragón",
  "recurring.flying-talisman": "Talismán volador",
  "recurring.dragon-s-aid": "Ayuda del dragón",
  "recurring.blessing": "Bendición",
  "recurring.reflect": "Reflectar",
  "recurring.shooting-dragon-boost": "Potenciador de disparo de dragón",
  "recurring.meteor": "Meteoro",

  // ---- Shaman / Healing ----
  "recurring.cure": "Curación",
  "recurring.swiftness": "Remolinos",
  "recurring.attack-up": "Ataque",
  "recurring.lightning-claw": "Garra del relámpago",
  "recurring.lightning-throw": "Tiro relámpago",
  "recurring.summon-lightning": "Llamada del relámpago",
  "recurring.summon-lightning-boost": "Potenciador de llamada del relámpago",
  "recurring.ethereal-shield": "Escudo etéreo", // ?

  // ---- Lycan / Instinct ----
  "recurring.crimson-wolf-soul": "Alma lobuna escarlata",
  "recurring.indigo-wolf-soul": "Alma lobuna índigo",
  "recurring.shred": "Desgarrar",
  "recurring.wolf-s-breath": "Aliento del lobo",
  "recurring.wolf-s-claw": "Zarpa lobuna",
  "recurring.wolf-pounce": "Salto lobuno",
  "recurring.wolf-s-breath-boost": "Potenciador de aliento del lobo",
  "recurring.cicatrix": "Cicatrix",

  // ---- Empires ----
  "empire.shinsoo": "Shinsoo",
  "empire.chunjo": "Chunjo",
  "empire.jinno": "Jinno",

  // ---- Races ----
  "race.warrior": "Guerrero",
  "race.ninja": "Ninja",
  "race.sura": "Sura",
  "race.shaman": "Chamán",
  "race.lycan": "Lícano",

  // ---- Builds (schools) ----
  "build.body": "Cuerpo", // ?
  "build.mental": "Mental", // ?
  "build.blade-fight": "Combate con espada", // ?
  "build.archery": "Arco", // ?
  "build.weaponry": "Armas mágicas", // ?
  "build.black-magic": "Magia negra", // ?
  "build.dragon": "Dragón", // ?
  "build.healing": "Curación", // ?
  "build.instinct": "Instinto", // ?

  // ---- Biologist consignment items ----
  "biologist.orc-tooth": "Diente de orco", // ?
  "biologist.curse-book": "Libro de maldiciones", // ?
  "biologist.demon-s-keepsake": "Recuerdo de demonio", // ?
  "biologist.ice-marble": "Bola de hielo", // ?
  "biologist.zelkova-branch": "Rama de zelkova", // ?
  "biologist.tugyi-s-tablet": "Tableta de Tugyi", // ?
  "biologist.red-ghost-tree-branch": "Rama Árbol Fant. Rojo", // ?
  "biologist.leaders-notes": "Notas del jefe", // ?
  "biologist.malevolence-jewel": "Joya de la malevolencia", // ?
  "biologist.wisdom-jewel": "Joya de la sabiduría", // ?
};

// ---- French content table (#99) ----
// 71 class skills seeded from the metin2alerts dump (names.fr); 5 races from locale/fr.json
// JOB_*; proper nouns (empires, Tempestus/Infernus/Cicatrix, verbatim bosses) kept as-is. The
// `// ?` keys are hand-translated best-effort (no dump for bosses/builds/biologist/app-chores)
// and await a native French cross-check. Every seededContentKeys() key is present
// (strict guard). See [[prelaunch-languages]] — seed-from-dump + spot-check house rule.
const FR: Record<string, string> = {
  // ---- Cooldowns (bosses) ----
  // cooldown.hydra omitted → English fallback (no confirmed FR-client name; fr-wiki has no page).
  "cooldown.razador": "Razador",
  "cooldown.nemere": "Nemere",
  "cooldown.meley": "Meley",
  "cooldown.balathor": "Balathor",
  "cooldown.northwind-war-chief": "Chef guerrier d'Aquilon", // fr-wiki mob 6895 (element suffix dropped, as DE)

  // ---- Recurring seed (deadline items) ----
  "recurring.alastor-pet": "Alastor Pet",
  "recurring.white-navy-uniform-costume": "White Navy Uniform Costume",
  "recurring.battle-horse": "Cheval de bataille", // ?

  // ---- Recurring seed (gate chores — universals) ----
  "recurring.skill-books": "Livres de compétences", // ?
  "recurring.transformation": "Transformation", // ?
  "recurring.inspiration": "Inspiration",
  "recurring.charisma": "Charisme",
  "recurring.mining": "Extraction",
  "recurring.leadership": "Commandement",
  "recurring.jinno-language": "Langue Jinno", // ?
  "recurring.chunjo-language": "Langue Chunjo", // ?
  "recurring.shinsoo-language": "Langue Shinsoo", // ?
  "recurring.biologist": "Biologiste", // ?

  // ---- Per-school Ward (7th) — generic, shared across every school's list (#57) ----
  "recurring.ward": "Contre-attaque", // ?

  // ---- Warrior / Body ----
  "recurring.aura-of-the-sword": "Aura de l'épée",
  "recurring.berserk": "Berserk",
  "recurring.dash": "Accélération",
  "recurring.sword-spin": "Moulinet à l'épée",
  "recurring.three-way-cut": "Triple lacération",
  "recurring.life-force": "Volonté de vivre",
  "recurring.sword-spin-boost": "Bonus Moulinet à l'Épée",
  "recurring.earthquake": "Tremblement de terre",

  // ---- Warrior / Mental ----
  "recurring.bash": "Attaque de la paume",
  "recurring.stump": "Charge",
  "recurring.sword-strike": "Coup d'épée",
  "recurring.sword-orb": "Orbe de l'épée",
  "recurring.spirit-strike": "Frappe spirituelle", // ?
  "recurring.strong-body": "Corps puissant",
  "recurring.spirit-strike-boost": "Bonus Attaque de l'esprit",

  // ---- Ninja / Blade-Fight ----
  "recurring.ambush": "Embuscade",
  "recurring.fast-attack": "Attaque rapide",
  "recurring.rolling-dagger": "Dague filante",
  "recurring.poisonous-cloud": "Brume empoisonnée",
  "recurring.insidious-poison": "Poison insidieux",
  "recurring.stealth": "Furtif",
  "recurring.ambush-boost": "Bonus Embuscade",
  "recurring.astral-light": "Étoiles brillantes",

  // ---- Ninja / Archery ----
  "recurring.repetitive-shot": "Tir à répétition",
  "recurring.arrow-shower": "Pluie de flèches",
  "recurring.fire-arrow": "Flèche de feu",
  "recurring.poison-arrow": "Flèche empoisonnée",
  "recurring.spark": "Coup étincelant",
  "recurring.feather-walk": "Foulée de plume",
  "recurring.fire-arrow-boost": "Bonus Flèche de feu",
  "recurring.tempestus": "Tempestus",

  // ---- Sura / Weaponry ----
  "recurring.finger-strike": "Toucher brûlant",
  "recurring.hell-strike": "Coup démoniaque",
  "recurring.dragon-swirl": "Tourbillon du Dragon",
  "recurring.enchanted-blade": "Lame enchantée",
  "recurring.fear": "Peur",
  "recurring.dispel": "Contre-sort",
  "recurring.finger-strike-boost": "Bonus Toucher brûlant",
  "recurring.infernus": "Infernus",

  // ---- Sura / Black Magic ----
  "recurring.dark-orb": "Orbe des ténèbres",
  "recurring.dark-strike": "Attaque des ténèbres",
  "recurring.flame-strike": "Attaque de flammes",
  "recurring.flame-spirit": "Esprit de flammes",
  "recurring.death-wave": "Vague mortelle",
  "recurring.dark-strike-boost": "Bonus Attaque des Ténèbres",
  "recurring.lethal-wave": "Vague létale", // ?

  // ---- Shaman / Dragon ----
  "recurring.dragon-s-roar": "Rugissement du Dragon",
  "recurring.shooting-dragon": "Dragon chassant",
  "recurring.flying-talisman": "Talisman volant",
  "recurring.dragon-s-aid": "Aide du Dragon",
  "recurring.blessing": "Bénédiction",
  "recurring.reflect": "Reflet",
  "recurring.shooting-dragon-boost": "Bonus Dragon chassant",
  "recurring.meteor": "Météore",

  // ---- Shaman / Healing ----
  "recurring.cure": "Soin",
  "recurring.swiftness": "Promptitude",
  "recurring.attack-up": "Attaque+",
  "recurring.lightning-claw": "Griffe de foudre",
  "recurring.lightning-throw": "Jet de Foudre",
  "recurring.summon-lightning": "Invocation de foudre",
  "recurring.summon-lightning-boost": "Bonus Invocation de foudre",
  "recurring.ethereal-shield": "Bouclier éthéré", // ?

  // ---- Lycan / Instinct ----
  "recurring.crimson-wolf-soul": "Âme du loup pourpre",
  "recurring.indigo-wolf-soul": "Âme du loup indigo",
  "recurring.shred": "Déchiqueter",
  "recurring.wolf-s-breath": "Souffle de loup",
  "recurring.wolf-s-claw": "Griffe de loup",
  "recurring.wolf-pounce": "Bond de loup",
  "recurring.wolf-s-breath-boost": "Bonus Souffle de loup",
  "recurring.cicatrix": "Cicatrix",

  // ---- Empires ----
  "empire.shinsoo": "Shinsoo",
  "empire.chunjo": "Chunjo",
  "empire.jinno": "Jinno",

  // ---- Races ----
  "race.warrior": "Guerrier",
  "race.ninja": "Ninja",
  "race.sura": "Sura",
  "race.shaman": "Chamane",
  "race.lycan": "Lycan",

  // ---- Builds (schools) ----
  "build.body": "Corps", // ?
  "build.mental": "Mental", // ?
  "build.blade-fight": "Combat à l'épée", // ?
  "build.archery": "Arc", // ?
  "build.weaponry": "Armes magiques", // ?
  "build.black-magic": "Magie noire", // ?
  "build.dragon": "Dragon", // ?
  "build.healing": "Guérison", // ?
  "build.instinct": "Instinct", // ?

  // ---- Biologist consignment items ----
  "biologist.orc-tooth": "Dent d'orque", // ?
  "biologist.curse-book": "Livre de malédictions", // ?
  "biologist.demon-s-keepsake": "Souvenir de démon", // ?
  "biologist.ice-marble": "Bille de glace", // ?
  "biologist.zelkova-branch": "Branche de zelkova", // ?
  "biologist.tugyi-s-tablet": "Tablette de Tugyi", // ?
  "biologist.red-ghost-tree-branch": "Branche Arbre Fantôme Rouge", // ?
  "biologist.leaders-notes": "Notes des chefs", // ?
  "biologist.malevolence-jewel": "Joyau de malveillance", // ?
  "biologist.wisdom-jewel": "Joyau de sagesse", // ?
};

// ---- Polish content table (#99) ----
// 71 class skills seeded from the metin2alerts dump (names.pl); 5 races from locale/pl.json
// JOB_*; proper nouns (empires, Tempestus/Infernus/Cicatrix, verbatim bosses) kept as-is. The
// `// ?` keys are hand-translated best-effort (no dump for bosses/builds/biologist/app-chores)
// and await a native Polish cross-check. Every seededContentKeys() key is present
// (strict guard). See [[prelaunch-languages]] — seed-from-dump + spot-check house rule.
const PL: Record<string, string> = {
  // ---- Cooldowns (bosses) ----
  "cooldown.hydra": "Hydra",       // pl-wiki "Hydra" (confirmed)
  "cooldown.razador": "Razador",   // pl-wiki "Walka z Razadorem" (verbatim)
  "cooldown.nemere": "Nemere",
  "cooldown.meley": "Meley",
  "cooldown.balathor": "Balathor",
  // cooldown.northwind-war-chief omitted → English fallback (field-boss page absent on pl-wiki).

  // ---- Recurring seed (deadline items) ----
  "recurring.alastor-pet": "Alastor Pet",
  "recurring.white-navy-uniform-costume": "White Navy Uniform Costume",
  "recurring.battle-horse": "Koń bojowy", // ?

  // ---- Recurring seed (gate chores — universals) ----
  "recurring.skill-books": "Księgi umiejętności", // ?
  "recurring.transformation": "Transformacja", // ?
  "recurring.inspiration": "Inspiracja",
  "recurring.charisma": "Charyzma",
  "recurring.mining": "Górnictwo",
  "recurring.leadership": "Dowodzenie",
  "recurring.jinno-language": "Język Jinno", // ?
  "recurring.chunjo-language": "Język Chunjo", // ?
  "recurring.shinsoo-language": "Język Shinsoo", // ?
  "recurring.biologist": "Biolog", // ?

  // ---- Per-school Ward (7th) — generic, shared across every school's list (#57) ----
  "recurring.ward": "Odpłata", // ?

  // ---- Warrior / Body ----
  "recurring.aura-of-the-sword": "Aura Miecza",
  "recurring.berserk": "Berserk",
  "recurring.dash": "Szarża",
  "recurring.sword-spin": "Wir Miecza",
  "recurring.three-way-cut": "Trzystronne Cięcie",
  "recurring.life-force": "Wola Życia",
  "recurring.sword-spin-boost": "Dopalacz: Wir Miecza",
  "recurring.earthquake": "Trzęsienie",

  // ---- Warrior / Mental ----
  "recurring.bash": "Walnięcie",
  "recurring.stump": "Tąpnięcie",
  "recurring.sword-strike": "Uderzenie Miecza",
  "recurring.sword-orb": "Krąg Mieczy",
  "recurring.spirit-strike": "Uderzenie ducha", // ?
  "recurring.strong-body": "Silne Ciało",
  "recurring.spirit-strike-boost": "Dopalacz: Duchowe Uderzenie",

  // ---- Ninja / Blade-Fight ----
  "recurring.ambush": "Zasadzka",
  "recurring.fast-attack": "Szybki Atak",
  "recurring.rolling-dagger": "Wirujący Sztylet",
  "recurring.poisonous-cloud": "Trująca Chmura",
  "recurring.insidious-poison": "Wolno działająca trucizna",
  "recurring.stealth": "Krycie Się",
  "recurring.ambush-boost": "Dopalacz: Zasadzka",
  "recurring.astral-light": "Światło Gwiazd",

  // ---- Ninja / Archery ----
  "recurring.repetitive-shot": "Powtarzalny Strzał",
  "recurring.arrow-shower": "Deszcz Strzał",
  "recurring.fire-arrow": "Ognista Strzała",
  "recurring.poison-arrow": "Trująca Strzała",
  "recurring.spark": "Iskrzące Uderzenie",
  "recurring.feather-walk": "Bezszelestny Chód",
  "recurring.fire-arrow-boost": "Dopalacz: Ognista Strzała",
  "recurring.tempestus": "Tempestus",

  // ---- Sura / Weaponry ----
  "recurring.finger-strike": "Uderzenie Palcem",
  "recurring.hell-strike": "Piekielny Cios",
  "recurring.dragon-swirl": "Smoczy Wir",
  "recurring.enchanted-blade": "Czarowane Ostrze",
  "recurring.fear": "Strach",
  "recurring.dispel": "Rozproszenie Magii",
  "recurring.finger-strike-boost": "Dopalacz: Uderzenie Palcem",
  "recurring.infernus": "Infernus",

  // ---- Sura / Black Magic ----
  "recurring.dark-orb": "Mroczna Sfera",
  "recurring.dark-strike": "Mroczne Uderzenie",
  "recurring.flame-strike": "Ogniste Uderzenie",
  "recurring.flame-spirit": "Ognisty Duch",
  "recurring.death-wave": "Fala Śmierci",
  "recurring.dark-strike-boost": "Dopalacz: Mroczne Uderzenie",
  "recurring.lethal-wave": "Śmiercionośna fala", // ?

  // ---- Shaman / Dragon ----
  "recurring.dragon-s-roar": "Smoczy Skowyt",
  "recurring.shooting-dragon": "Strzelający Smok",
  "recurring.flying-talisman": "Latający Talizman",
  "recurring.dragon-s-aid": "Pomoc Smoka",
  "recurring.blessing": "Błogosławieństwo",
  "recurring.reflect": "Odbicie",
  "recurring.shooting-dragon-boost": "Dopalacz: Strzelający Smok",
  "recurring.meteor": "Meteor",

  // ---- Shaman / Healing ----
  "recurring.cure": "Leczenie",
  "recurring.swiftness": "Zwinność",
  "recurring.attack-up": "Atak+",
  "recurring.lightning-claw": "Burzowy Szpon",
  "recurring.lightning-throw": "Rzut Piorunem",
  "recurring.summon-lightning": "Przywołanie Błyskawicy",
  "recurring.summon-lightning-boost": "Dopalacz: Przywołanie Błyskawicy",
  "recurring.ethereal-shield": "Eteryczna tarcza", // ?

  // ---- Lycan / Instinct ----
  "recurring.crimson-wolf-soul": "Dusza Purpurowego Wilka",
  "recurring.indigo-wolf-soul": "Dusza Wilka Indygo",
  "recurring.shred": "Rozedrzeć",
  "recurring.wolf-s-breath": "Wilczy Dech",
  "recurring.wolf-s-claw": "Wilczy Pazur",
  "recurring.wolf-pounce": "Wilczy Skok",
  "recurring.wolf-s-breath-boost": "Dopalacz: Wilczy Dech",
  "recurring.cicatrix": "Cicatrix",

  // ---- Empires ----
  "empire.shinsoo": "Shinsoo",
  "empire.chunjo": "Chunjo",
  "empire.jinno": "Jinno",

  // ---- Races ----
  "race.warrior": "Wojownik",
  "race.ninja": "Ninja",
  "race.sura": "Sura",
  "race.shaman": "Szaman",
  "race.lycan": "Likan",

  // ---- Builds (schools) ----
  "build.body": "Ciało", // ?
  "build.mental": "Mentalność", // ?
  "build.blade-fight": "Walka mieczem", // ?
  "build.archery": "Łucznictwo", // ?
  "build.weaponry": "Broń magiczna", // ?
  "build.black-magic": "Czarna magia", // ?
  "build.dragon": "Smok", // ?
  "build.healing": "Uzdrawianie", // ?
  "build.instinct": "Instynkt", // ?

  // ---- Biologist consignment items ----
  "biologist.orc-tooth": "Ząb Orka", // ?
  "biologist.curse-book": "Księga klątw", // ?
  "biologist.demon-s-keepsake": "Pamiątka demona", // ?
  "biologist.ice-marble": "Lodowa kulka", // ?
  "biologist.zelkova-branch": "Gałąź zelkowy", // ?
  "biologist.tugyi-s-tablet": "Tablica Tugyiego", // ?
  "biologist.red-ghost-tree-branch": "Gałąź Czerw. Ducha", // ?
  "biologist.leaders-notes": "Notatki przywódcy", // ?
  "biologist.malevolence-jewel": "Klejnot złośliwości", // ?
  "biologist.wisdom-jewel": "Klejnot mądrości", // ?
};

// ---- Turkish content table (#99) ----
// 71 class skills seeded from the metin2alerts dump (names.tr); 5 races from locale/tr.json
// JOB_*; proper nouns (empires, Tempestus/Infernus/Cicatrix, verbatim bosses) kept as-is. The
// `// ?` keys are hand-translated best-effort (no dump for bosses/builds/biologist/app-chores)
// and await a native Turkish cross-check. Every seededContentKeys() key is present
// (strict guard). See [[prelaunch-languages]] — seed-from-dump + spot-check house rule.
const TR: Record<string, string> = {
  // ---- Cooldowns (bosses) ----
  // Confirmed against the official TR client / Gameforge tr-wiki + mob vnums (2026-06-14).
  "cooldown.hydra": "Hidra",       // tr-wiki "Hidra"
  "cooldown.razador": "Razadör",   // TR client spelling with ö (tr-wiki "Razadör Yumurtası")
  "cooldown.nemere": "Nemere",     // verbatim (Nemere Tapınağı)
  "cooldown.meley": "Meley",       // verbatim (Meley'in Bebeği)
  "cooldown.balathor": "Balathor", // verbatim (tr-wiki "Balathor")
  "cooldown.northwind-war-chief": "Kuzey R. Savaş Reisi", // client string for mob 6895

  // ---- Recurring seed (deadline items) ----
  "recurring.alastor-pet": "Alastor Pet",
  "recurring.white-navy-uniform-costume": "White Navy Uniform Costume",
  "recurring.battle-horse": "Savaş Atı", // ?

  // ---- Recurring seed (gate chores — universals) ----
  "recurring.skill-books": "Beceri Kitapları", // ?
  "recurring.transformation": "Dönüşüm", // ?
  "recurring.inspiration": "İlham",
  "recurring.charisma": "Karizma",
  "recurring.mining": "Madencilik",
  "recurring.leadership": "Liderlik",
  "recurring.jinno-language": "Jinno Dili", // ?
  "recurring.chunjo-language": "Chunjo Dili", // ?
  "recurring.shinsoo-language": "Shinsoo Dili", // ?
  "recurring.biologist": "Biyolog", // ?

  // ---- Per-school Ward (7th) — generic, shared across every school's list (#57) ----
  "recurring.ward": "Savunma", // ?

  // ---- Warrior / Body ----
  "recurring.aura-of-the-sword": "Hava kılıcı",
  "recurring.berserk": "Öfke",
  "recurring.dash": "Hamle",
  "recurring.sword-spin": "Kılıç çevirme",
  "recurring.three-way-cut": "Üç yönlü kesme",
  "recurring.life-force": "Yaşama isteği",
  "recurring.sword-spin-boost": "Kılıç Çevirme Güçlendirmesi",
  "recurring.earthquake": "Deprem",

  // ---- Warrior / Mental ----
  "recurring.bash": "Şiddetli vuruş",
  "recurring.stump": "Güçlü vuruş",
  "recurring.sword-strike": "Kılıç darbesi",
  "recurring.sword-orb": "Kılıç çemberi",
  "recurring.spirit-strike": "Ruh Darbesi", // ?
  "recurring.strong-body": "Güçlü beden",
  "recurring.spirit-strike-boost": "Ruh Vuruşu Güçlendirmesi",

  // ---- Ninja / Blade-Fight ----
  "recurring.ambush": "Suikast",
  "recurring.fast-attack": "Hızlı saldırı",
  "recurring.rolling-dagger": "Bıçak çevirme",
  "recurring.poisonous-cloud": "Zehirli bulut",
  "recurring.insidious-poison": "Sinsi zehir",
  "recurring.stealth": "Kamuflaj",
  "recurring.ambush-boost": "Suikast Güçlendirmesi",
  "recurring.astral-light": "Işık yıldızı",

  // ---- Ninja / Archery ----
  "recurring.repetitive-shot": "Tekrarlanan atış",
  "recurring.arrow-shower": "Ok yağmuru",
  "recurring.fire-arrow": "Ateşli ok",
  "recurring.poison-arrow": "Zehirli ok",
  "recurring.spark": "Kıvılcım vuruşu",
  "recurring.feather-walk": "Hafif adım",
  "recurring.fire-arrow-boost": "Ateşli Ok Güçlendirmesi",
  "recurring.tempestus": "Tempestus",

  // ---- Sura / Weaponry ----
  "recurring.finger-strike": "Parmak darbesi",
  "recurring.hell-strike": "Ateş darbesi",
  "recurring.dragon-swirl": "Ejderha dönüşü",
  "recurring.enchanted-blade": "Büyülü keskinlik",
  "recurring.fear": "Dehşet",
  "recurring.dispel": "Büyü çözme",
  "recurring.finger-strike-boost": "Parmak Darbesi Güçlendirmesi",
  "recurring.infernus": "Infernus",

  // ---- Sura / Black Magic ----
  "recurring.dark-orb": "Karanlık taş",
  "recurring.dark-strike": "Karanlık vuruş",
  "recurring.flame-strike": "Alev vuruşu",
  "recurring.flame-spirit": "Ateş hayaleti",
  "recurring.death-wave": "Ölüm dalgası",
  "recurring.dark-strike-boost": "Karanlık Vuruş Güçlendirmesi",
  "recurring.lethal-wave": "Ölümcül Dalga", // ?

  // ---- Shaman / Dragon ----
  "recurring.dragon-s-roar": "Ejderha kükremesi",
  "recurring.shooting-dragon": "Ejderha darbesi",
  "recurring.flying-talisman": "Uçan tılsım",
  "recurring.dragon-s-aid": "Ejderha yardımı",
  "recurring.blessing": "Kutsama",
  "recurring.reflect": "Yansıtma",
  "recurring.shooting-dragon-boost": "Ejderha darbesi güçlendirmesi",
  "recurring.meteor": "Meteor",

  // ---- Shaman / Healing ----
  "recurring.cure": "Şifa",
  "recurring.swiftness": "Çabukluk",
  "recurring.attack-up": "Saldırı +",
  "recurring.lightning-claw": "Şimşek pençesi",
  "recurring.lightning-throw": "Şimşek atma",
  "recurring.summon-lightning": "Şimşek çağırma",
  "recurring.summon-lightning-boost": "Şimşek Çağırma Güçlendirmesi",
  "recurring.ethereal-shield": "Esrik Kalkan", // ?

  // ---- Lycan / Instinct ----
  "recurring.crimson-wolf-soul": "Kırmızı kurt ruhu",
  "recurring.indigo-wolf-soul": "Çivit kurt ruhu",
  "recurring.shred": "Yırtma",
  "recurring.wolf-s-breath": "Kurt nefesi",
  "recurring.wolf-s-claw": "Kurt pençesi",
  "recurring.wolf-pounce": "Kurt atlayışı",
  "recurring.wolf-s-breath-boost": "Kurt Nefesi Güçlendirmesi",
  "recurring.cicatrix": "Cicatrix",

  // ---- Empires ----
  "empire.shinsoo": "Shinsoo",
  "empire.chunjo": "Chunjo",
  "empire.jinno": "Jinno",

  // ---- Races ----
  "race.warrior": "Savaşçı",
  "race.ninja": "Ninja",
  "race.sura": "Sura",
  "race.shaman": "Şaman",
  "race.lycan": "Lycan",

  // ---- Builds (schools) ----
  "build.body": "Beden", // ?
  "build.mental": "Zihin", // ?
  "build.blade-fight": "Kılıç Dövüşü", // ?
  "build.archery": "Okçuluk", // ?
  "build.weaponry": "Silah Ustalığı", // ?
  "build.black-magic": "Kara Büyü", // ?
  "build.dragon": "Ejderha", // ?
  "build.healing": "İyileştirme", // ?
  "build.instinct": "İçgüdü", // ?

  // ---- Biologist consignment items ----
  "biologist.orc-tooth": "Ork Dişi", // ?
  "biologist.curse-book": "Lanet Kitabı", // ?
  "biologist.demon-s-keepsake": "Şeytan Hatırası", // ?
  "biologist.ice-marble": "Buz Mermeri", // ?
  "biologist.zelkova-branch": "Zelkova Dalı", // ?
  "biologist.tugyi-s-tablet": "Tugyi'nin Tableti", // ?
  "biologist.red-ghost-tree-branch": "Kırmızı Hayalet Ağacı Dalı", // ?
  "biologist.leaders-notes": "Lider Notları", // ?
  "biologist.malevolence-jewel": "Kötülük Mücevheri", // ?
  "biologist.wisdom-jewel": "Bilgelik Mücevheri", // ?
};

const TABLES: Record<Locale, Record<string, string>> = {
  en: EN,
  de: DE,
  it: IT,
  tr: TR,
  pl: PL,
  fr: FR,
  es: ES,
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
 * Keys a locale INTENTIONALLY omits — no confirmed official-client name yet, so the locale inherits
 * the English string via displayName's fallback rather than shipping a guess (#99). The completeness
 * guard subtracts these per locale, so an *accidental* gap still fails CI while a documented one does
 * not. Keep this list short; remove an entry the moment a native- or wiki-confirmed name lands.
 */
export const INTENTIONAL_EN_FALLBACK: Partial<Record<Locale, readonly string[]>> = {
  es: ["cooldown.hydra", "cooldown.northwind-war-chief"],
  fr: ["cooldown.hydra"],
  pl: ["cooldown.northwind-war-chief"],
};

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
