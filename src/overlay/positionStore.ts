// On-disk store adapter for the overlay's remembered position — the impure persistence
// boundary for slice #7, mirroring configStore's split: all shape/clamp logic lives in the
// pure engine/position.ts; this only moves raw {x,y} payloads to and from storage. In the
// Tauri app it uses the on-disk plugin-store; under plain-browser dev it falls back to
// localStorage. Every call is best-effort — storage being unavailable must never break the
// overlay (it just opens at the OS-default position).
import { isTauri } from "@tauri-apps/api/core";
import { load as loadStore, type Store } from "@tauri-apps/plugin-store";
import { readPosition, type StoredPosition } from "../engine/position";

const STORE_FILE = "window.json"; // app data dir, managed by plugin-store
const KEY = "overlayPosition";
const LS_KEY = "metin-boss-timers:overlay-position:v1"; // browser-dev fallback only

let storePromise: Promise<Store> | null = null;
// autoSave off — we persist explicitly via store.save() after each set.
const tauriStore = () => (storePromise ??= loadStore(STORE_FILE, { defaults: {}, autoSave: false }));

/** Read the saved overlay position (validated), or null if absent/unreadable. */
export async function loadPosition(): Promise<StoredPosition | null> {
  try {
    if (isTauri()) {
      const store = await tauriStore();
      return readPosition((await store.get(KEY)) ?? null);
    }
    const raw = localStorage.getItem(LS_KEY);
    return readPosition(raw ? JSON.parse(raw) : null);
  } catch {
    return null; // corrupt/unavailable storage → behave as "nothing saved"
  }
}

/** Write the overlay position. Best-effort: failures are swallowed. */
export async function savePosition(pos: StoredPosition): Promise<void> {
  try {
    if (isTauri()) {
      const store = await tauriStore();
      await store.set(KEY, pos);
      await store.save();
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(pos));
  } catch {
    /* storage unavailable (quota / private mode / denied) — keep running without it */
  }
}
