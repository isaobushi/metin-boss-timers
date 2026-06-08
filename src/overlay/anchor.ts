// Pure placement geometry for the + selection panel (Cooldowns #27). The real overlay is
// freely draggable (overlay/useOverlayPosition.ts), so the picker dropdown can't assume a fixed
// side: dragged to the right edge it must open leftward, dragged to the bottom it must flip
// upward, or it overflows off-screen. anchorFor() infers the inward open direction on each axis
// purely from where the overlay sits in its viewport; the impure picker consumes the result to
// pick CSS modifier classes, and the pill strip wraps the same way to stay visually attached.
// No DOM, no React, no Tauri — just rects, mirroring the engine/position.ts geometry split. The
// impure side (overlay/measureOverlay.ts) is what knows how to read the real rect per platform.

export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { width: number; height: number };

// Which edge of the + button the dropdown attaches to (and therefore which way it grows):
// "left" anchors the menu's left edge and opens rightward (the default placement); "right"
// anchors its right edge and opens leftward. Vertically "down" opens below the button (the
// default), "up" flips it above. The strip's pill wrap follows the same horizontal choice.
export type Anchor = {
  horizontal: "left" | "right";
  vertical: "down" | "up";
};

/**
 * Infer the inward open direction for the picker dropdown from the overlay's position in the
 * viewport. An overlay whose centre is past the viewport's horizontal midpoint sits in the
 * right half, so the menu opens leftward to stay on-screen; past the vertical midpoint it
 * flips upward. A centred (or top-left) overlay keeps the default left/down placement — ties
 * resolve to the defaults so a perfectly centred panel behaves exactly as it does today.
 */
export function anchorFor(overlayRect: Rect, viewport: Viewport): Anchor {
  const centerX = overlayRect.x + overlayRect.width / 2;
  const centerY = overlayRect.y + overlayRect.height / 2;
  return {
    horizontal: centerX > viewport.width / 2 ? "right" : "left",
    vertical: centerY > viewport.height / 2 ? "up" : "down",
  };
}
