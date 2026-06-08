// Impure window-position adapter — the OS boundary for slice #7, mirroring hotkeys.ts:
// all geometry is pure in engine/position.ts; this only reads the real monitor/window
// metrics, restores the saved position on launch, and persists every drag.
//
// A frameless Tauri window is moved by the OS via the `data-tauri-drag-region` handles in
// the overlay headers; there we (1) on mount place it where it was last dragged, clamped to
// the current monitor's work area so a position saved on a now-gone/resized screen still
// lands visible, and (2) debounce-save on every `moved` event. In a plain browser there's
// no OS window, so we instead make the `.overlay` element itself a `position: fixed` panel
// that those same handles drag within the viewport, persisted to localStorage — so the web
// demo is draggable too. Best-effort throughout: a failure must never break the overlay.
import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { clampToArea } from "../engine/position";
import { loadPosition, savePosition } from "./positionStore";

// Coalesce the burst of move events a single drag emits into one write per pause.
const SAVE_DEBOUNCE_MS = 400;
// Where the browser panel sits before it has ever been dragged.
const DEFAULT_BROWSER_POS = { x: 16, y: 16 };

/**
 * Restore the overlay's remembered position on mount and persist it as it's dragged.
 * Returns a ref to attach to the `.overlay` element: used by the browser branch to move the
 * panel (the Tauri branch moves the OS window instead), but always returned so App can wire it.
 */
export function useOverlayPosition() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isTauri()) {
      const win = getCurrentWindow();
      let unlisten: (() => void) | null = null;
      let cancelled = false;

      void (async () => {
        try {
          const saved = await loadPosition();
          if (saved && !cancelled) {
            const [size, mon] = await Promise.all([win.outerSize(), currentMonitor()]);
            const pos = mon
              ? clampToArea(saved, size, {
                  x: mon.workArea.position.x,
                  y: mon.workArea.position.y,
                  width: mon.workArea.size.width,
                  height: mon.workArea.size.height,
                })
              : saved;
            if (!cancelled) await win.setPosition(new PhysicalPosition(pos.x, pos.y));
          }

          unlisten = await win.onMoved(({ payload }) => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => void savePosition({ x: payload.x, y: payload.y }), SAVE_DEBOUNCE_MS);
          });
          if (cancelled) unlisten();
        } catch {
          /* monitor/window query or listener failed — overlay stays at its default spot */
        }
      })();

      return () => {
        cancelled = true;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        unlisten?.();
      };
    }

    // ---- browser: the overlay is a draggable floating panel positioned via CSS ----
    const el = overlayRef.current;
    if (!el) return;
    el.style.position = "fixed";

    // Place top-left at (x, y), clamped so the whole panel stays within the viewport.
    const place = (x: number, y: number) => {
      const maxX = Math.max(0, window.innerWidth - el.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - el.offsetHeight);
      const cx = Math.min(Math.max(0, x), maxX);
      const cy = Math.min(Math.max(0, y), maxY);
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      return { x: cx, y: cy };
    };
    const currentPos = () => ({ x: parseInt(el.style.left, 10) || 0, y: parseInt(el.style.top, 10) || 0 });

    let cancelled = false;
    void loadPosition().then((saved) => {
      if (!cancelled && el.isConnected) place(saved?.x ?? DEFAULT_BROWSER_POS.x, saved?.y ?? DEFAULT_BROWSER_POS.y);
    });

    // Drag starts only on a header marked as a drag handle (so buttons stay clickable);
    // move/up live on window so the drag survives the pointer leaving the small panel.
    let drag: { dx: number; dy: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest?.("[data-tauri-drag-region]")) return;
      const r = el.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (drag) place(e.clientX - drag.dx, e.clientY - drag.dy);
    };
    const onUp = () => {
      if (!drag) return;
      drag = null;
      const pos = currentPos();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void savePosition(pos), SAVE_DEBOUNCE_MS);
    };
    const onResize = () => place(currentPos().x, currentPos().y); // re-clamp if the viewport shrinks

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return overlayRef;
}
