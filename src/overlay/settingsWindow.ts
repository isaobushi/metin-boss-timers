// Settings-window adapter — the impure boundary that opens the separate editing surface
// and tells a freshly-loaded document which surface it is. Both windows load the same Vite
// bundle; the `#settings` hash selects the settings app over the overlay (see main.tsx),
// and the same hash is reused as the Tauri window URL and the browser tab URL.
//
// In the Tauri app it spawns a real second OS window (decorated/opaque, unlike the frameless
// transparent overlay), focusing it if already open. Under plain-browser dev (`npm run dev`)
// it opens a second tab at the same `#settings` URL (cross-tab sync via configSync). Either
// way it's best-effort: failing to open a window must never break the overlay.
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { parseSettingsHash, settingsHash, type SettingsTab } from "../engine/settingsLink";
import { emitTransient } from "./transientSync";

const LABEL = "settings";

/**
 * Open (or focus, if already open) the settings window/tab, optionally landed on `tab` — the
 * deep-link adapter behind the tour's "make it yours" nudge (#72). The tab rides the URL hash
 * into a fresh window (read once on mount); an ALREADY-open window has long since consumed its
 * URL, so the tab goes over the transient bus instead and the window re-tabs live.
 */
export function openSettingsWindow(tab?: SettingsTab): void {
  try {
    if (isTauri()) {
      void (async () => {
        const existing = await WebviewWindow.getByLabel(LABEL);
        if (existing) {
          if (tab) emitTransient({ kind: "settings-navigate", tab });
          await existing.setFocus();
          return;
        }
        // The overlay is always-on-top, so a plain window opens *behind* it. Open centred
        // (the overlay sits in a corner), focused, and also on-top so it lands in front.
        new WebviewWindow(LABEL, {
          url: `index.html#${settingsHash(tab)}`,
          title: "Settings — Dragon's Aid",
          width: 540,
          height: 520,
          resizable: true,
          decorations: true,
          transparent: false,
          center: true,
          focus: true,
          alwaysOnTop: true,
        });
      })();
      return;
    }
    // browser-dev: a named target reuses the same tab on a second click rather than stacking
    window.open(`${location.pathname}#${settingsHash(tab)}`, LABEL);
  } catch {
    /* couldn't open the settings surface — overlay keeps working */
  }
}

/** Close the settings window (Tauri) or tab (browser-dev). Called by its own Esc handler. */
export function closeSettingsWindow(): void {
  try {
    if (isTauri()) {
      void getCurrentWindow().close();
      return;
    }
    window.close();
  } catch {
    /* nothing to close / blocked — no-op */
  }
}

/** True when this document is the settings surface (vs the overlay). */
export function isSettingsWindow(): boolean {
  return parseSettingsHash(location.hash).isSettings;
}

/** The deep-linked tab a freshly-loaded settings document should land on; null = default. */
export function initialSettingsTab(): SettingsTab | null {
  return parseSettingsHash(location.hash).tab;
}
