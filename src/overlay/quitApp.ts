// Quit-app adapter — the impure boundary for the overlay's ✕ close button. The window
// is frameless (no OS titlebar), so quitting has to be triggered from inside the app.
// Under Tauri it invokes the `quit_app` command, which exits the process (and so closes
// the settings window too). Under plain-browser dev it best-effort closes the tab. Either
// way it's best-effort: a failure must never break the overlay (mirrors settingsWindow.ts).
import { invoke, isTauri } from "@tauri-apps/api/core";

/** Quit the whole application (Tauri) or close the tab (browser-dev). */
export function quitApp(): void {
  try {
    if (isTauri()) {
      void invoke("quit_app");
      return;
    }
    window.close();
  } catch {
    /* couldn't quit — leave the overlay running */
  }
}
