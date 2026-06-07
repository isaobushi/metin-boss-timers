// Impure window-position adapter — the OS boundary for slice #7, mirroring hotkeys.ts:
// all geometry is pure in engine/position.ts; this only reads the real monitor/window
// metrics, restores the saved position on launch, and persists every drag.
//
// Desktop-only: a frameless Tauri window is moved by the OS via the `data-tauri-drag-region`
// handles in the overlay headers; here we (1) on mount place it where it was last dragged,
// clamped to the current monitor's work area so a position saved on a now-gone/resized
// screen still lands visible, and (2) debounce-save on every `moved` event. Under
// plain-browser dev there's no OS window to reposition, so the whole hook is a no-op.
// Best-effort throughout: a failed monitor query or listener must never break the overlay.
import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { clampToArea } from "../engine/position";
import { loadPosition, savePosition } from "./positionStore";

// Coalesce the burst of `moved` events a single drag emits into one write per pause.
const SAVE_DEBOUNCE_MS = 400;

/** Restore the overlay's remembered position on mount and persist it as it's dragged. */
export function useOverlayPosition() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isTauri()) return; // browser-dev tabs can't reposition the OS window

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
  }, []);
}
