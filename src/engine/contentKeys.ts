// Stable, locale-independent identity for seeded content (PRD #77, slice #81). A `catalogKey`
// names *what a seeded item is* independently of how any locale spells it, so the display string
// can be re-resolved per-locale at render time (slices #83/#85) while the key — and the persisted
// fallback `name` — stay put.
//
// This is the leaf of the localization graph: it imports nothing, so every seed site
// (config/skillCatalog/recurring) can stamp keys without pulling in the content tables, and
// `contentCatalog.ts` can build those tables on top without a cycle.
//
// Keys are DERIVED from the (English) seed name, namespaced by content kind. Two consequences make
// this the right call for seeded content rather than hand-assigned ids:
//   1. the config seed ("Leadership") and the skill catalog ("Leadership") mint the same chore from
//      the same name, so a name-derived key makes them agree automatically — no shared constant to
//      keep in sync;
//   2. it mirrors slice #82's migration, which backfills keys onto already-persisted defs by
//      matching their frozen English name — the same name → the same key.
// The trade-off (a key is only as stable as the English name it derives from) is acceptable for a
// fixed seed: English names change rarely, and a deliberate rename is a migration either way.

/** Lowercase kebab slug: collapse every non-alphanumeric run to a single hyphen, trim the ends. */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A seeded cooldown's key, from its catalog name ("Hydra" → `cooldown.hydra`). */
export const cooldownKey = (name: string): string => `cooldown.${slug(name)}`;

/**
 * A seeded recurring item's key, from its name. Covers every recurring flavour — the `deadline`
 * expiring items, the universal gate chores, the class Abilities, and the Languages — because they
 * are all `RecurringDef`s and a shared namespace keyed on the (identical-across-seed-paths) name is
 * what makes the config seed and the skill-catalog preform agree on one key.
 */
export const recurringKey = (name: string): string => `recurring.${slug(name)}`;

/** An Empire's key, from its enum value ("Shinsoo" → `empire.shinsoo`). */
export const empireKey = (empire: string): string => `empire.${slug(empire)}`;

/** A Race's key, from its enum value ("Warrior" → `race.warrior`). */
export const raceKey = (race: string): string => `race.${slug(race)}`;

/** A Build (school) key, from its enum value ("Black Magic" → `build.black-magic`). Also the
 *  `school` band label on a Skill-Books row (#57). */
export const buildKey = (build: string): string => `build.${slug(build)}`;

/** A Biologist consignment item's key, from its name ("Orc Tooth" → `biologist.orc-tooth`). */
export const biologistItemKey = (item: string): string => `biologist.${slug(item)}`;
