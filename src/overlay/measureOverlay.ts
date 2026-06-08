// Impure OS-boundary adapter for the picker's edge-aware placement (Cooldowns #27): it produces
// the overlay's rect and surrounding viewport in one coordinate space, then defers the actual
// direction decision to the pure anchorFor (overlay/anchor.ts). Mirrors useOverlayPosition's
// Tauri/browser split:
//   • Browser — the overlay is a position:fixed element, so its getBoundingClientRect and
//     window.innerWidth/Height already share the viewport's CSS-pixel space.
//   • Tauri — the overlay fills a tiny frameless OS window that's dragged across the monitor, so
//     the element rect is always ~(0,0) and useless. We read the OS window position/size and the
//     monitor work area instead, translated to the monitor's local origin so a second monitor
//     (non-zero origin) still resolves correctly.
// Best-effort throughout: any failed metrics query falls back to null so the caller keeps the
// current placement rather than breaking the overlay.
import { isTauri } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { anchorFor, type Anchor } from "./anchor";

/**
 * Resolve which way the + dropdown should open for an overlay element's current position.
 * `el` is any element inside the `.overlay` panel (used only on the browser branch). Returns
 * null if the platform metrics can't be read.
 */
export async function measureAnchor(el: HTMLElement): Promise<Anchor | null> {
  try {
    if (isTauri()) {
      const win = getCurrentWindow();
      const [pos, size, mon] = await Promise.all([win.outerPosition(), win.outerSize(), currentMonitor()]);
      if (!mon) return null;
      const area = mon.workArea;
      return anchorFor(
        { x: pos.x - area.position.x, y: pos.y - area.position.y, width: size.width, height: size.height },
        { width: area.size.width, height: area.size.height },
      );
    }
    const overlay = el.closest<HTMLElement>(".overlay") ?? el;
    return anchorFor(overlay.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
  } catch {
    return null; // monitor/window query failed — caller keeps the default placement
  }
}
