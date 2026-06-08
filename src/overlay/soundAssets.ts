// Impure asset bindings: each `SoundId` → its bundled `.wav` URL. This is the ONLY
// module that imports the sample files, so the pure engine (and `engine/sounds.ts`)
// never pull in assets. The audio adapter preloads from here; the settings preview
// (Slice 3) will reuse it. The `Record<SoundId, string>` type means adding a slug to
// `SOUND_IDS` without a binding here is a compile error — bindings can't drift.
import type { SoundId } from "../engine/sounds";
import kickUrl from "../assets/kick-drum-timer.wav";
import rifleUrl from "../assets/assault-rifle-shoot-brick-rigs-sound-fx.wav";
import metalUrl from "../assets/horror-sfx-metallic-hit.wav";
import pickaxeUrl from "../assets/mining-with-reverb-game-type-foley-hit.wav";
import chimeUrl from "../assets/rpg-sounds-save-successful-sfx.wav";

/** Bundled sample URL for every selectable sound. */
export const SOUND_URLS: Record<SoundId, string> = {
  kick: kickUrl,
  rifle: rifleUrl,
  metal: metalUrl,
  pickaxe: pickaxeUrl,
  chime: chimeUrl,
};
