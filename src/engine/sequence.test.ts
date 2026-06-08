import { describe, expect, it } from "vitest";
import {
  append,
  clear,
  emptySeq,
  nextIndex,
  toggleDone,
  undo,
  type SeqState,
} from "./sequence";

// The model is a pure function of (state, …): no React, no storage. A sequence is an
// ordered list of token ids plus a parallel done-flag per step, so every record/recall
// transition is testable with no DOM.

// Build a sequence by appending ids left-to-right.
const seq = (...ids: string[]): SeqState => ids.reduce(append, emptySeq());

describe("emptySeq", () => {
  it("starts empty", () => {
    expect(emptySeq()).toEqual({ steps: [], done: [] });
  });
});

describe("append", () => {
  it("records steps in tap order, each not-yet-done", () => {
    const s = seq("fire", "ice", "fire"); // repeats allowed
    expect(s.steps).toEqual(["fire", "ice", "fire"]);
    expect(s.done).toEqual([false, false, false]);
  });

  it("does not mutate the input", () => {
    const before = emptySeq();
    append(before, "fire");
    expect(before).toEqual({ steps: [], done: [] });
  });
});

describe("undo", () => {
  it("drops the last step and its flag", () => {
    expect(undo(seq("fire", "ice"))).toEqual({ steps: ["fire"], done: [false] });
  });

  it("is a no-op on an empty sequence", () => {
    expect(undo(emptySeq())).toEqual({ steps: [], done: [] });
  });
});

describe("clear", () => {
  it("forgets everything", () => {
    expect(clear()).toEqual({ steps: [], done: [] });
  });
});

describe("toggleDone", () => {
  it("flips a single step's flag", () => {
    const s = toggleDone(seq("fire", "ice"), 1);
    expect(s.done).toEqual([false, true]);
  });

  it("toggling twice returns to not-done", () => {
    const s = seq("fire");
    expect(toggleDone(toggleDone(s, 0), 0).done).toEqual([false]);
  });

  it("ignores an out-of-range index", () => {
    const s = seq("fire");
    expect(toggleDone(s, 5).done).toEqual([false]);
  });
});

describe("nextIndex", () => {
  it("is -1 when empty", () => {
    expect(nextIndex(emptySeq())).toBe(-1);
  });

  it("points at the first not-done step", () => {
    expect(nextIndex(seq("fire", "ice", "wind"))).toBe(0);
  });

  it("skips done steps to the next undone one", () => {
    let s = seq("fire", "ice", "wind");
    s = toggleDone(s, 0); // fire done
    expect(nextIndex(s)).toBe(1);
  });

  it("is -1 when every step is done", () => {
    let s = seq("fire", "ice");
    s = toggleDone(s, 0);
    s = toggleDone(s, 1);
    expect(nextIndex(s)).toBe(-1);
  });

  it("returns to an earlier step if it is un-ticked", () => {
    let s = seq("fire", "ice");
    s = toggleDone(s, 0); // next -> 1
    s = toggleDone(s, 0); // un-tick -> next back to 0
    expect(nextIndex(s)).toBe(0);
  });
});
