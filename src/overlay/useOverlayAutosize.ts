// Impure window-size adapter (Tauri only) — the sibling of useOverlayPosition. The overlay's dock and
// panels are content-sized (full character/boss names, no truncation), so the frameless window must
// fit them rather than clip at a fixed width. We can't just make the window large: a transparent Tauri
// window still swallows the clicks under it, so an oversized one would block the game. Instead we size
// the window to its content and anchor it to the RIGHT (and TOP) edge — as content grows the window
// extends leftward/downward, so the overlay stays exactly where the user dragged it.
//
// Best-effort throughout, like useOverlayPosition: any window-query/resize failure leaves the window
// as-is and never breaks the overlay. In a plain browser there's no OS window, so this is a no-op and
// the `.overlay` element shrink-wraps its content via CSS instead.
import { useEffect, type RefObject } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";

// The `.overlay` element's padding (10px each side), added back so the content isn't sized flush.
const PAD = 20;

/**
 * Size the overlay window to `contentRef`'s content, anchored to its right/top edge. Attach the ref to
 * the element whose width should drive the window (the right-anchored content column). Re-fits whenever
 * that element resizes (a name edit, a panel opening, the active character switching).
 */
export function useOverlayAutosize(contentRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!isTauri()) return;
    const el = contentRef.current;
    if (!el) return;
    const win = getCurrentWindow();
    let raf = 0;
    let busy = false;

    const fit = async () => {
      if (busy) return; // our own setSize can retrigger the observer; ignore re-entry
      busy = true;
      try {
        const rect = el.getBoundingClientRect();
        const needW = Math.ceil(rect.width) + PAD;
        const needH = Math.ceil(rect.height) + PAD;
        const dpr = window.devicePixelRatio || 1;
        const [size, pos] = await Promise.all([win.outerSize(), win.outerPosition()]);
        const curW = Math.round(size.width / dpr);
        const curH = Math.round(size.height / dpr);
        if (Math.abs(curW - needW) < 2 && Math.abs(curH - needH) < 2) return; // already fits
        const rightEdge = pos.x + size.width; // physical right edge to hold fixed
        await win.setSize(new LogicalSize(needW, needH));
        const after = await win.outerSize(); // physical width actually applied
        await win.setPosition(new PhysicalPosition(rightEdge - after.width, pos.y));
      } catch {
        /* window query/resize failed — leave the window as-is */
      } finally {
        busy = false;
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => void fit());
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    schedule(); // initial fit
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [contentRef]);
}
