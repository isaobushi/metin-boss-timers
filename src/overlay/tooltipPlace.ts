// Pure placement geometry for the instant tooltip layer (Tooltip.tsx). The overlay lives in a
// frameless Tauri window that shrink-wraps its content (useOverlayAutosize), so a tooltip can
// never escape the window: anything past the viewport edge is simply cut off by the OS window
// bounds. placeTip() therefore prefers the row above the anchor, flips below when the top edge
// would clip, and clamps both axes inside the viewport — at worst the tip overlaps the anchor
// rather than vanishing. No DOM, no React, no Tauri — just rects, like anchor.ts; the impure
// side (Tooltip.tsx) feeds it real getBoundingClientRect/window.inner* values.

import type { Rect, Viewport } from "./anchor";

export type TipSize = { width: number; height: number };
export type TipPlacement = { x: number; y: number; below: boolean };

// Gap between anchor and tip, and the minimum breathing room kept from every viewport edge.
const GAP = 5;
const MARGIN = 4;

/**
 * Place a tooltip of `tip` size against `anchor` inside `viewport`. Horizontally centred on the
 * anchor, clamped to the viewport with a small margin; vertically above the anchor unless that
 * would clip the top edge, in which case it flips below (and, if even that overflows, clamps —
 * overlap beats invisible in a window that is barely larger than its content).
 */
export function placeTip(anchor: Rect, tip: TipSize, viewport: Viewport): TipPlacement {
  const x = clamp(anchor.x + anchor.width / 2 - tip.width / 2, MARGIN, Math.max(MARGIN, viewport.width - tip.width - MARGIN));
  const above = anchor.y - GAP - tip.height;
  const below = above < MARGIN;
  const y = below ? anchor.y + anchor.height + GAP : above;
  return { x, y: clamp(y, MARGIN, Math.max(MARGIN, viewport.height - tip.height - MARGIN)), below };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
