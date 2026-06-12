import { describe, expect, it } from "vitest";
import { advanceTour, initialTour, type TourEvent, type TourState } from "./tourMachine";
import { TOUR_STEPS } from "./tourSteps";

const N = TOUR_STEPS.length;
const at = (index: number): TourState => ({ index, done: false });

// The tour sequencer (#70): a pure index + terminal flag. The view holds the state and renders
// TOUR_STEPS[index]; these tests pin the clamping/terminal contract the card relies on.
describe("tourMachine (#70)", () => {
  it("starts at the first beat, not done", () => {
    expect(initialTour()).toEqual({ index: 0, done: false });
  });

  it("next advances one beat at a time", () => {
    expect(advanceTour(at(0), "next", N)).toEqual(at(1));
    expect(advanceTour(at(3), "next", N)).toEqual(at(4));
  });

  it("next on the last beat IS the finish — index clamps, done flips", () => {
    expect(advanceTour(at(N - 1), "next", N)).toEqual({ index: N - 1, done: true });
  });

  it("back clamps at the first beat", () => {
    expect(advanceTour(at(0), "back", N)).toEqual(at(0));
    expect(advanceTour(at(2), "back", N)).toEqual(at(1));
  });

  it("skip and finish are terminal from any beat — Skip is offered on every step", () => {
    for (let i = 0; i < N; i++) {
      expect(advanceTour(at(i), "skip", N).done).toBe(true);
      expect(advanceTour(at(i), "finish", N).done).toBe(true);
    }
  });

  it("a done state absorbs every event — there is no way back into a finished tour", () => {
    const done: TourState = { index: N - 1, done: true };
    for (const ev of ["next", "back", "skip", "finish"] as TourEvent[]) {
      expect(advanceTour(done, ev, N)).toBe(done);
    }
  });

  it("walks all 8 beats: N-1 nexts visit every step in registry order, the Nth finishes", () => {
    let s = initialTour();
    const visited = [TOUR_STEPS[s.index].id];
    for (let i = 0; i < N - 1; i++) {
      s = advanceTour(s, "next", N);
      visited.push(TOUR_STEPS[s.index].id);
    }
    expect(s.done).toBe(false); // the last beat shows; finishing is its own act
    expect(visited).toEqual(TOUR_STEPS.map((step) => step.id)); // active descriptor matches registry
    expect(advanceTour(s, "next", N).done).toBe(true);
  });
});
