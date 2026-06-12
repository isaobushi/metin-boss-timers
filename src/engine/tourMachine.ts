// Pure step-sequencer for the first-run tour (PRD #63, slice #70). Like sequence.ts it owns no
// React, no clock, no I/O: state is an index plus a terminal flag, and every event is a pure
// transform — the view (overlay/TourCard) holds the state, renders the step the index selects
// from tourSteps.ts, and dispatches events. The slice-1 gate (config.shouldRunTour/markTourSeen)
// owns WHETHER the tour fires; tourSteps.ts owns WHAT each beat shows; this owns only WHERE in
// the sequence the user stands.

export type TourEvent = "next" | "back" | "skip" | "finish";

export type TourState = {
  /** Index into the step registry — the transforms keep it inside [0, stepCount-1]. */
  index: number;
  /** Terminal: the tour was finished or skipped. The view exits and marks the tour seen. */
  done: boolean;
};

export const initialTour = (): TourState => ({ index: 0, done: false });

/**
 * Advance the tour by one event. `next` clamps at the end by finishing — next on the last beat
 * IS the finish; `back` clamps at the first beat; `skip` and `finish` are terminal from anywhere
 * (skip is offered on every step). A done state absorbs every event — there is no way back in.
 */
export function advanceTour(s: TourState, ev: TourEvent, stepCount: number): TourState {
  if (s.done) return s;
  switch (ev) {
    case "next":
      return s.index >= stepCount - 1 ? { ...s, done: true } : { ...s, index: s.index + 1 };
    case "back":
      return { ...s, index: Math.max(0, s.index - 1) };
    case "skip":
    case "finish":
      return { ...s, done: true };
  }
}
