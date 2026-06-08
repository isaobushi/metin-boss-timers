import { describe, expect, it } from "vitest";
import {
  GAP_MS,
  MAX_TUNE_MS,
  MIN_TUNE_MS,
  applyNotch,
  chunkForStreak,
  clampDuration,
  nextStreak,
  snapTo,
} from "./cooldownTuning";

const M = 60_000;
const H = 3_600_000;

// The tuning engine is pure: every function is `(inputs) -> output` with no clock, no
// React, no storage. The wheel's *feel* (streak ramp) is calibrated against these, but
// the math itself is fully deterministic, so every assertion below is exact.

describe("chunkForStreak", () => {
  it("is a deliberate 1-minute step at low streaks", () => {
    expect(chunkForStreak(0)).toBe(1 * M);
    expect(chunkForStreak(2)).toBe(1 * M);
  });

  it("ramps 5m / 15m / 30m / 1h as a sustained streak crosses each threshold", () => {
    expect(chunkForStreak(3)).toBe(5 * M);
    expect(chunkForStreak(6)).toBe(15 * M);
    expect(chunkForStreak(11)).toBe(30 * M);
    expect(chunkForStreak(18)).toBe(1 * H);
    // just below each threshold stays on the lower chunk
    expect(chunkForStreak(5)).toBe(5 * M);
    expect(chunkForStreak(17)).toBe(30 * M);
  });
});

describe("nextStreak", () => {
  it("increments while notches stay on the same row closer than GAP_MS apart", () => {
    expect(nextStreak(0, GAP_MS - 1, true)).toBe(1);
    expect(nextStreak(4, GAP_MS - 1, true)).toBe(5);
  });

  it("resets to 0 on a pause at or beyond GAP_MS", () => {
    expect(nextStreak(7, GAP_MS, true)).toBe(0);
    expect(nextStreak(7, GAP_MS + 50, true)).toBe(0);
  });

  it("resets to 0 on a row switch even when the notch was fast", () => {
    expect(nextStreak(7, GAP_MS - 1, false)).toBe(0);
  });
});

describe("snapTo", () => {
  it("rounds onto the chunk grid so a ramped step lands on a round value", () => {
    // 2h27 snapped to the 15m grid → 2h30
    expect(snapTo(2 * H + 27 * M, 15 * M)).toBe(2 * H + 30 * M);
    // halfway rounds up
    expect(snapTo(2 * H + 22.5 * M, 15 * M)).toBe(2 * H + 30 * M);
  });

  it("is the identity on the 1-minute grid (a precise step never drifts)", () => {
    expect(snapTo(2 * H + 27 * M, 1 * M)).toBe(2 * H + 27 * M);
  });
});

describe("clampDuration", () => {
  it("holds a tuned duration inside [1m, 12h]", () => {
    expect(clampDuration(0)).toBe(MIN_TUNE_MS);
    expect(clampDuration(-5 * M)).toBe(MIN_TUNE_MS);
    expect(clampDuration(20 * H)).toBe(MAX_TUNE_MS);
    expect(clampDuration(30 * M)).toBe(30 * M);
  });

  it("bounds are 1 minute and 12 hours", () => {
    expect(MIN_TUNE_MS).toBe(1 * M);
    expect(MAX_TUNE_MS).toBe(12 * H);
  });
});

describe("applyNotch", () => {
  it("scroll up adds a chunk; scroll down subtracts", () => {
    expect(applyNotch(30 * M, 0, +1, GAP_MS * 2, true).durationMs).toBe(31 * M);
    expect(applyNotch(30 * M, 0, -1, GAP_MS * 2, true).durationMs).toBe(29 * M);
  });

  it("lands the stepped value on the chunk grid", () => {
    // a fast streak (chunk 5m) stepping up from 2h27 snaps to 2h30, not 2h32
    const out = applyNotch(2 * H + 27 * M, 3, +1, GAP_MS - 1, true);
    expect(out.chunkMs).toBe(5 * M);
    expect(out.durationMs).toBe(2 * H + 30 * M);
  });

  it("never tunes outside [1m, 12h]", () => {
    expect(applyNotch(MIN_TUNE_MS, 0, -1, GAP_MS * 2, true).durationMs).toBe(MIN_TUNE_MS);
    expect(applyNotch(MAX_TUNE_MS, 0, +1, GAP_MS * 2, true).durationMs).toBe(MAX_TUNE_MS);
  });

  it("reports the advanced streak and its chunk for the on-screen badge", () => {
    const out = applyNotch(30 * M, 5, +1, GAP_MS - 1, true);
    expect(out.streak).toBe(6);
    expect(out.chunkMs).toBe(15 * M);
  });

  it("a row switch resets the streak so the first notch on a new row is a 1m step", () => {
    const out = applyNotch(30 * M, 17, +1, GAP_MS - 1, false);
    expect(out.streak).toBe(0);
    expect(out.chunkMs).toBe(1 * M);
    expect(out.durationMs).toBe(31 * M);
  });
});
