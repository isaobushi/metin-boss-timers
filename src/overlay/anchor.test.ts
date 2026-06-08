import { describe, expect, it } from "vitest";
import { anchorFor } from "./anchor";

// Pure placement geometry: no DOM, no Tauri — just "where does the overlay sit, so which way
// must the + dropdown open to stay on-screen". The impure picker feeds it real rects.

const viewport = { width: 1920, height: 1080 };
// A panel roughly the size of the overlay window; only its centre relative to the viewport
// midpoints matters, so the exact size is incidental.
const W = 360;
const H = 320;
const at = (x: number, y: number) => ({ x, y, width: W, height: H });

describe("anchorFor", () => {
  it("keeps the default left/down placement when centred", () => {
    expect(anchorFor(at(viewport.width / 2 - W / 2, viewport.height / 2 - H / 2), viewport)).toEqual({
      horizontal: "left",
      vertical: "down",
    });
  });

  it("opens right+down from the top-right corner", () => {
    expect(anchorFor(at(viewport.width - W - 8, 8), viewport)).toEqual({ horizontal: "right", vertical: "down" });
  });

  it("opens left+down from the top-left corner", () => {
    expect(anchorFor(at(8, 8), viewport)).toEqual({ horizontal: "left", vertical: "down" });
  });

  it("opens right+up from the bottom-right corner", () => {
    expect(anchorFor(at(viewport.width - W - 8, viewport.height - H - 8), viewport)).toEqual({
      horizontal: "right",
      vertical: "up",
    });
  });

  it("opens left+up from the bottom-left corner", () => {
    expect(anchorFor(at(8, viewport.height - H - 8), viewport)).toEqual({ horizontal: "left", vertical: "up" });
  });

  it("flips upward near the bottom edge regardless of horizontal side", () => {
    expect(anchorFor(at(viewport.width / 2 - W / 2, viewport.height - H - 8), viewport).vertical).toBe("up");
  });

  it("opens leftward near the right edge regardless of vertical side", () => {
    expect(anchorFor(at(viewport.width - W - 8, viewport.height / 2 - H / 2), viewport).horizontal).toBe("right");
  });

  it("resolves an exact-midpoint centre to the defaults (ties → left/down)", () => {
    // Centre lands exactly on both midpoints; strict comparison keeps the default placement.
    expect(anchorFor({ x: viewport.width / 2, y: viewport.height / 2, width: 0, height: 0 }, viewport)).toEqual({
      horizontal: "left",
      vertical: "down",
    });
  });

  it("respects a non-1920×1080 viewport", () => {
    const small = { width: 800, height: 600 };
    expect(anchorFor(at(700, 500), small)).toEqual({ horizontal: "right", vertical: "up" });
    expect(anchorFor(at(0, 0), small)).toEqual({ horizontal: "left", vertical: "down" });
  });
});
