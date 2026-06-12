import { describe, expect, it } from "vitest";
import { placeTip } from "./tooltipPlace";

// Pure tooltip geometry: no DOM — just "where does the tip land so it stays inside a window
// that is barely larger than its content". The impure layer (Tooltip.tsx) feeds it real rects.

const viewport = { width: 360, height: 320 }; // roughly the shrink-wrapped overlay window
const tip = { width: 120, height: 22 };
const anchor = (x: number, y: number, width = 24, height = 24) => ({ x, y, width, height });

describe("placeTip", () => {
  it("centres above the anchor when there is room", () => {
    const p = placeTip(anchor(150, 100), tip, viewport);
    expect(p.below).toBe(false);
    expect(p.y).toBe(100 - 5 - 22); // anchor top − gap − tip height
    expect(p.x).toBe(150 + 12 - 60); // anchor centre − half tip width
  });

  it("flips below when the anchor hugs the top edge (the dock row)", () => {
    const p = placeTip(anchor(150, 10), tip, viewport);
    expect(p.below).toBe(true);
    expect(p.y).toBe(10 + 24 + 5); // anchor bottom + gap
  });

  it("clamps the left edge instead of escaping the window", () => {
    const p = placeTip(anchor(2, 100), tip, viewport);
    expect(p.x).toBe(4);
  });

  it("clamps the right edge instead of escaping the window", () => {
    const p = placeTip(anchor(viewport.width - 26, 100), tip, viewport);
    expect(p.x).toBe(viewport.width - tip.width - 4);
  });

  it("clamps the bottom edge when flipping below would overflow it", () => {
    // Anchor pinned in the top-right of a window shorter than gap+tip — contrived, but the
    // clamp must hold: overlap beats a tip cut off by the OS window bounds.
    const squat = { width: 360, height: 40 };
    const p = placeTip(anchor(150, 2), tip, squat);
    expect(p.below).toBe(true);
    expect(p.y).toBe(squat.height - tip.height - 4);
  });

  it("never returns a negative origin even when the tip outsizes the viewport", () => {
    const p = placeTip(anchor(0, 0), { width: 500, height: 400 }, viewport);
    expect(p.x).toBe(4);
    expect(p.y).toBe(4);
  });
});
