// Slice 3 (#71) of the first-run tour: the pure step→shell-drive mapping. tourSteps.ts declares
// WHAT each beat is about (dockSegment/panelToOpen); this turns the active step into the concrete
// shell state the overlay holds while the beat shows — which glyph the spotlight ring sits on,
// which exclusive panel is open underneath the coach card, whether the pinned cooldown strip
// shows. Engine-pure like its siblings: no React, no overlay imports — the literal panel ids
// mirror App's `Panel` union on purpose, so a divergence breaks App's wiring site at compile time
// (the intended safety net, same as tourSteps' duplicated unions).

import type { TourSegment, TourStep } from "./tourSteps";

export type TourDrive = {
  /** The dock glyph the pulsing ring sits on; null = no single glyph (welcome / dock / done). */
  spotlight: TourSegment;
  /**
   * The exclusive panel open under the card for this beat. `timers`, not `skills`: the ⚔ beat
   * shows the seeded landing boss's live chips, not the picker — the shell adopts that boss if
   * none is active yet (the picker would make the beat about choosing, not about the tool).
   */
  panel: "timers" | "items" | "routine" | null;
  /**
   * The ⏱ beat's tool is the *pinned strip* (a sibling of the exclusive slot, per tourSteps), so
   * it pins the strip instead of opening a panel. Asserted (true or false) on every beat, so
   * back/forward re-drives the strip and a mid-tour manual pin never lingers into the next beat.
   */
  pinCooldowns: boolean;
};

/** What the shell shows while `step` is the active beat — re-applied on every step change. */
export function driveForStep(step: TourStep): TourDrive {
  return {
    spotlight: step.dockSegment,
    panel: step.panelToOpen === "skills" ? "timers" : step.panelToOpen,
    pinCooldowns: step.dockSegment === "cooldowns",
  };
}
