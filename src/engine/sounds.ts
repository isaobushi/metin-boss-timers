// Pure sound vocabulary: the canonical set of selectable per-skill samples, their
// display labels, the default, and a validator. This is the deep module of the
// per-skill-sound feature — a small, stable interface over "what sounds exist". It
// imports no assets, so the engine layer (config/persist/timer) can depend on it and
// stay unit-testable; the impure `.wav` URL bindings live separately in the overlay,
// touched only by the audio adapter and the settings preview.
//
// The slugs below are the PERSISTED CONTRACT — they must not change once shipped (saved
// configs store them). Labels are display-only and free to tweak.

export type SoundId = "kick" | "rifle" | "metal" | "pickaxe" | "chime";

/** Every selectable sound, in the order new skills cycle through them. */
export const SOUND_IDS = ["kick", "rifle", "metal", "pickaxe", "chime"] as const satisfies readonly SoundId[];

/** The sound a fresh boss's first skill gets, and the fallback for unknown/missing ids. */
export const DEFAULT_SOUND_ID: SoundId = "kick";

/** Friendly, display-only names (slugs are the stable contract; these are tweakable). */
const SOUND_LABELS: Record<SoundId, string> = {
  kick: "Kick",
  rifle: "Rifle",
  metal: "Metal Hit",
  pickaxe: "Pickaxe",
  chime: "Chime",
};

/** Narrows an arbitrary value to a known `SoundId` (used by persistence validation). */
export function isSoundId(v: unknown): v is SoundId {
  return typeof v === "string" && (SOUND_IDS as readonly string[]).includes(v);
}

/** The display label for a sound id. */
export function soundLabel(id: SoundId): string {
  return SOUND_LABELS[id];
}
