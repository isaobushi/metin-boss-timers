// Pure window-position geometry: the testable core of slice #7's remembered overlay
// position. No Tauri, no clock, no I/O — just clamp-to-screen math and persisted-shape
// validation. The window adapter (overlay/positionStore.ts + overlay/useOverlayPosition.ts)
// reads the real monitor/window metrics and pipes plain numbers through these functions,
// mirroring the engine/persist ↔ overlay/configStore split.

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;

/**
 * Clamp a window's top-left `pos` so the whole window stays inside `area` (e.g. the
 * monitor work area). On an axis where the window is larger than the area, pin the
 * window's top-left edge to the area's origin so it stays reachable rather than drifting
 * off the far edge. Used on launch so a position saved on a now-disconnected/resized
 * monitor still lands somewhere visible.
 */
export function clampToArea(pos: Point, win: Size, area: Rect): Point {
  return {
    x: clampAxis(pos.x, win.width, area.x, area.width),
    y: clampAxis(pos.y, win.height, area.y, area.height),
  };
}

function clampAxis(p: number, size: number, start: number, extent: number): number {
  const max = start + extent - size;
  if (max <= start) return start; // window doesn't fit on this axis → pin top-left edge
  return Math.min(Math.max(p, start), max);
}

export type StoredPosition = Point;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Validate a persisted position payload into a `StoredPosition`, or null if it's missing
 * or malformed (so the adapter falls back to the OS-chosen default position). Rebuilds
 * explicitly so unknown extra fields are dropped, matching engine/persist's readers.
 */
export function readPosition(raw: unknown): StoredPosition | null {
  if (!isObj(raw) || !isNum(raw.x) || !isNum(raw.y)) return null;
  return { x: raw.x, y: raw.y };
}
