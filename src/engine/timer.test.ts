import { describe, expect, it } from "vitest";
import {
  makeTimer,
  progressAt,
  remainingMsAt,
  reset,
  start,
  stop,
  tick,
  toggle,
  trigger,
  type Cue,
  type Timer,
} from "./timer";

// The engine is a pure function of (timer, now): it owns neither the clock nor the
// render loop. The caller injects the wall-clock time, which is what makes every
// transition and the cue sequence testable with no real time and no audio device.

const mk = (durationMs = 20_000): Timer =>
  makeTimer({ id: "t", label: "Skill 1", durationMs, pitch: 880 });

describe("makeTimer", () => {
  it("starts stopped at a full cycle", () => {
    const t = mk(20_000);
    expect(t.running).toBe(false);
    expect(remainingMsAt(t, 999_999)).toBe(20_000); // stopped: time of day is irrelevant
  });
});

describe("start / stop / toggle", () => {
  it("start anchors the cycle end to now + remaining", () => {
    const t = start(mk(20_000), 1_000);
    expect(t.running).toBe(true);
    expect(remainingMsAt(t, 1_000)).toBe(20_000);
    expect(remainingMsAt(t, 6_000)).toBe(15_000);
  });

  it("stop freezes whatever currently remains", () => {
    const running = start(mk(20_000), 1_000);
    const stopped = stop(running, 6_000);
    expect(stopped.running).toBe(false);
    expect(remainingMsAt(stopped, 6_000)).toBe(15_000);
    expect(remainingMsAt(stopped, 99_000)).toBe(15_000); // frozen — does not drain
  });

  it("toggle flips running, preserving remaining across a stop/start", () => {
    const a = toggle(mk(20_000), 1_000); // -> running, full
    const b = toggle(a, 6_000); // -> stopped with 15s left
    expect(b.running).toBe(false);
    const c = toggle(b, 100_000); // -> running again from 15s, re-anchored to now
    expect(c.running).toBe(true);
    expect(remainingMsAt(c, 100_000)).toBe(15_000);
  });
});

describe("reset", () => {
  it("snaps a stopped timer back to full", () => {
    const partial = stop(start(mk(20_000), 1_000), 6_000); // 15s left, stopped
    const r = reset(partial, 6_000);
    expect(r.running).toBe(false);
    expect(remainingMsAt(r, 6_000)).toBe(20_000);
  });

  it("re-anchors a running timer to a fresh full cycle without stopping it", () => {
    const running = start(mk(20_000), 1_000);
    const r = reset(running, 6_000);
    expect(r.running).toBe(true);
    expect(remainingMsAt(r, 6_000)).toBe(20_000);
    expect(remainingMsAt(r, 11_000)).toBe(15_000); // keeps draining from the reset point
  });
});

describe("trigger", () => {
  it("resets and starts from a stopped state", () => {
    const t = trigger(mk(20_000), 5_000);
    expect(t.running).toBe(true);
    expect(remainingMsAt(t, 5_000)).toBe(20_000);
  });

  it("restarts a mid-cycle running timer to full from now", () => {
    const running = start(mk(20_000), 1_000);
    const t = trigger(running, 6_000); // was at 15s
    expect(remainingMsAt(t, 6_000)).toBe(20_000);
  });
});

describe("remainingMsAt — wall-clock anchoring", () => {
  it("recovers the correct remaining time after a dropped/late frame", () => {
    const t = start(mk(20_000), 1_000);
    // the loop missed frames and `now` jumped 2.25 cycles past start; modulo recovers
    // 0.75 of a cycle (15s) regardless of how many frames were skipped
    expect(remainingMsAt(t, 1_000 + 45_000)).toBe(15_000);
  });

  it("wraps to a full cycle exactly at the boundary", () => {
    const t = start(mk(20_000), 1_000);
    expect(remainingMsAt(t, 21_000)).toBe(20_000);
  });
});

describe("progressAt", () => {
  it("is 1 at the start of a cycle and the remaining fraction mid-cycle", () => {
    const t = start(mk(20_000), 1_000);
    expect(progressAt(t, 1_000)).toBe(1);
    expect(progressAt(t, 6_000)).toBe(0.75);
  });
});

// The render loop calls tick() each frame; the engine — not the view — decides which
// cues fire. Advancing a fake clock frame-by-frame asserts the exact 3/2/1/hit sequence.
describe("tick — cues and auto-loop", () => {
  it("is inert while stopped", () => {
    const { timer, cues } = tick(mk(5_000), 10_000);
    expect(cues).toEqual([]);
    expect(timer.running).toBe(false);
  });

  it("emits exactly tick3, tick2, tick1, then hit, then auto-loops", () => {
    let t = start(mk(5_000), 0); // endsAt = 5000
    const fired: Cue[] = [];
    // step the clock one second at a time through a full cycle and into the next
    for (const now of [1_000, 2_000, 3_000, 4_000, 5_000]) {
      const r = tick(t, now);
      t = r.timer;
      fired.push(...r.cues);
    }
    expect(fired).toEqual(["tick3", "tick2", "tick1", "hit"]);
    // after the hit it looped to a fresh cycle ending at 10s -> 3s left at now=7s
    expect(remainingMsAt(t, 7_000)).toBe(3_000);
    expect(tick(t, 7_000).cues).toEqual(["tick3"]); // cues fire again on the next loop
  });

  it("emits a single hit and skips whole cycles a lagged frame jumped over", () => {
    const t = start(mk(5_000), 0); // endsAt = 5000
    const r = tick(t, 12_500); // 2.5 cycles later in one frame
    expect(r.cues).toEqual(["hit"]); // not one hit per skipped cycle
    expect(remainingMsAt(r.timer, 12_500)).toBe(2_500); // re-anchored into the live cycle
  });

  it("does not re-fire a cue while sitting within the same second", () => {
    let t = start(mk(5_000), 0);
    expect(tick(t, 2_000).cues).toEqual(["tick3"]); // crossed into the 3s second
    t = tick(t, 2_000).timer;
    expect(tick(t, 2_400).cues).toEqual([]); // still the same second -> silent
  });
});
