// Cross-window live-sync adapter — the impure boundary that keeps the overlay and the
// settings window agreeing on one config, mirroring configStore's Tauri/browser split.
// configStore owns *durable* state (disk); this owns *live* propagation between windows:
// a window that edits broadcasts its serialized config, and every other window applies it.
//
// In the Tauri app it rides the event bus (emit/listen). `emit` fans out to *all* webviews
// including the sender, so each payload carries the sender's window label and the listener
// drops its own echoes. Under plain-browser dev (`npm run dev`) the second "window" is just
// another tab, so it uses a BroadcastChannel — which by spec never delivers to the posting
// instance, so no self-filter is needed there. Every call is best-effort: a missing bus
// must never break editing (the on-disk store is still the durable source of truth).
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PersistedConfig } from "../engine/persist";

const EVENT = "config://changed"; // Tauri event name
const CHANNEL = "metin-boss-timers:config"; // browser BroadcastChannel name

type Wire = { from: string; payload: PersistedConfig };

/** Broadcast a freshly-edited config to the other window(s). Fire-and-forget. */
export function broadcastConfig(payload: PersistedConfig): void {
  try {
    if (isTauri()) {
      void emit(EVENT, { from: getCurrentWindow().label, payload } satisfies Wire);
      return;
    }
    new BroadcastChannel(CHANNEL).postMessage(payload);
  } catch {
    /* no bus available — windows just won't live-sync; disk still persists the change */
  }
}

/**
 * Subscribe to configs broadcast by *other* windows; `cb` runs with the remote payload.
 * Returns an unsubscribe. The caller applies the payload without re-persisting/re-broadcasting
 * (it's already on disk and would otherwise echo forever).
 */
export function subscribeConfig(cb: (payload: PersistedConfig) => void): () => void {
  try {
    if (isTauri()) {
      const me = getCurrentWindow().label;
      const unlisten = listen<Wire>(EVENT, (e) => {
        if (e.payload.from !== me) cb(e.payload.payload); // ignore our own echo
      });
      return () => void unlisten.then((off) => off()).catch(() => {});
    }
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => cb(e.data as PersistedConfig);
    return () => channel.close();
  } catch {
    return () => {}; // no bus — nothing to clean up
  }
}
