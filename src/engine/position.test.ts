import { describe, expect, it } from "vitest";
import { clampToArea, readPosition } from "./position";

// Pure window-position geometry: no Tauri, no monitor — just clamp math and shape
// validation. The window adapter feeds real monitor/window metrics through these.

const screen = { x: 0, y: 0, width: 1920, height: 1080 };
const win = { width: 360, height: 320 };

describe("clampToArea", () => {
  it("leaves a fully-on-screen position untouched", () => {
    expect(clampToArea({ x: 100, y: 80 }, win, screen)).toEqual({ x: 100, y: 80 });
  });

  it("pulls a window that runs off the right/bottom back inside", () => {
    expect(clampToArea({ x: 5000, y: 5000 }, win, screen)).toEqual({
      x: 1920 - 360,
      y: 1080 - 320,
    });
  });

  it("pulls a window with a negative top-left back to the area origin", () => {
    expect(clampToArea({ x: -200, y: -50 }, win, screen)).toEqual({ x: 0, y: 0 });
  });

  it("respects a non-zero area origin (e.g. a second monitor)", () => {
    const right = { x: 1920, y: 0, width: 1280, height: 1024 };
    expect(clampToArea({ x: 1000, y: 0 }, win, right)).toEqual({ x: 1920, y: 0 });
    expect(clampToArea({ x: 2000, y: 100 }, win, right)).toEqual({ x: 2000, y: 100 });
  });

  it("pins the top-left edge when the window is larger than the area", () => {
    const tiny = { x: 10, y: 20, width: 200, height: 100 };
    expect(clampToArea({ x: 999, y: 999 }, win, tiny)).toEqual({ x: 10, y: 20 });
  });
});

describe("readPosition", () => {
  it("accepts a well-formed payload", () => {
    expect(readPosition({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
  });

  it("rejects non-finite or missing coordinates", () => {
    expect(readPosition({ x: 1 })).toBeNull();
    expect(readPosition({ x: NaN, y: 2 })).toBeNull();
    expect(readPosition({ x: "1", y: 2 })).toBeNull();
  });

  it("rejects non-objects", () => {
    expect(readPosition(null)).toBeNull();
    expect(readPosition(42)).toBeNull();
    expect(readPosition(undefined)).toBeNull();
  });

  it("drops unknown extra fields, keeping only x/y", () => {
    expect(readPosition({ x: 1, y: 2, w: 9 })).toEqual({ x: 1, y: 2 });
  });
});
