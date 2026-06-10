// Pure Character model: the owner of the RECURRING side of the app (PRD #47, multi-character). A
// Character carries a name, an Empire, a Race, and one or two Builds, plus its own bag of recurring
// chores — the Routine/Elapsable-item catalog, the running set, and the Ladder progress map. Bosses,
// Skills, and dungeon Cooldowns are NOT a Character's concern: they stay global on `Config` (an
// explicit scoping decision — they are facts about the game world, shared across every character).
//
// This slice (#51) is the read path + migration only: the type, the active-character accessor, and a
// constructor used by `makeConfig` and the persistence migration. The create-character flow (which
// seeds chores from `skillCatalog`), rename/delete, and the dock switcher are later slices (#54).
// Like the rest of the engine it is pure — no clock, no React, no storage.

import type { Build, Empire, Race } from "./skillCatalog";
import type { RecurringDef, RecurringProgress, RunningRecurring } from "./recurring";
import type { Config } from "./config";

/**
 * A player avatar that owns a bag of recurring chores. `empire`/`race` are optional: a migrated
 * legacy config becomes a default Character with both unset (it can be classified later, #54), which
 * is why the create flow's race-filtered seeding is decoupled from this type. `builds` is empty until
 * a Race is chosen. The three recurring slices are exactly the fields that used to live at the top of
 * `Config` — relocated here, one bag per character.
 */
export type Character = {
  id: string;
  name: string;
  /** The kingdom the character is pledged to (determines its foreign Language chores). Unset on a migrated default. */
  empire?: Empire;
  /** The class chosen at creation (determines its learnable Abilities). Unset on a migrated default. */
  race?: Race;
  /** The Build sub-tree(s) the Race specialises into; empty until a Race is chosen. */
  builds: Build[];
  /** This character's editable recurring catalog (Routine gates + Elapsable items). */
  recurring: RecurringDef[];
  /** This character's currently-running recurring items (absolute expiries; persisted). */
  recurringRunning: RunningRecurring[];
  /** This character's per-def ladder rank (count of successful reads). Parallel to `recurringRunning`. */
  recurringProgress: RecurringProgress[];
};

/** The name a migrated/seeded default character carries until the user renames it. */
export const DEFAULT_CHARACTER_NAME = "Main";

/** A character's recurring slices, all optional — defaulting to empty bags. */
type CharacterSlices = {
  recurring?: RecurringDef[];
  recurringRunning?: RunningRecurring[];
  recurringProgress?: RecurringProgress[];
};

/**
 * Build a Character holding the given recurring slices (each defaulting to empty), with `empire`/
 * `race` unset and no builds. The one constructor shared by `makeConfig` (wrapping the shipped seed)
 * and the persistence migration (wrapping a legacy singleton config's recurring data).
 */
export function makeCharacter(id: string, name: string, slices: CharacterSlices = {}): Character {
  return {
    id,
    name,
    builds: [],
    recurring: slices.recurring ?? [],
    recurringRunning: slices.recurringRunning ?? [],
    recurringProgress: slices.recurringProgress ?? [],
  };
}

/**
 * The active Character — the one whose chores the dock shows and every recurring read resolves
 * against. Undefined when `activeCharacterId` is null or dangles (points at no surviving character);
 * callers treat that as "no chores" rather than crashing, so the overlay degrades gracefully.
 */
export const activeCharacter = (c: Config): Character | undefined =>
  c.activeCharacterId == null ? undefined : c.characters.find((ch) => ch.id === c.activeCharacterId);
