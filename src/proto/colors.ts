// PROTOTYPE — maps remaining-time fraction (1 = full, 0 = end) to an urgency color.
// cyan/blue (full) -> orange (mid) -> red (near end).
type RGB = [number, number, number];
const CYAN: RGB = [0, 214, 255];
const ORANGE: RGB = [255, 140, 50];
const RED: RGB = [255, 40, 40];

const lerp = (a: RGB, b: RGB, t: number): RGB =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const hex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

// progress = remaining / duration (1 -> full, 0 -> end)
export function urgencyColor(progress: number): string {
  const p = Math.max(0, Math.min(1, progress));
  if (p >= 0.5) return hex(lerp(ORANGE, CYAN, (p - 0.5) / 0.5)); // full half: orange -> cyan
  return hex(lerp(RED, ORANGE, p / 0.5)); // last half: red -> orange
}
