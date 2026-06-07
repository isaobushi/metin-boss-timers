// On-disk store adapter — the impure boundary for persistence. It moves raw,
// already-(de)serialized payloads to and from storage; all shape/version logic lives
// in the pure `engine/persist.ts`. In the Tauri app it uses the on-disk plugin-store;
// under plain-browser dev (`npm run dev`, the web demo) it falls back to localStorage
// so config still survives a reload there. Every call is best-effort — storage being
// unavailable must never break the overlay.
import { isTauri } from "@tauri-apps/api/core";
import { load as loadStore, type Store } from "@tauri-apps/plugin-store";
import type { PersistedConfig } from "../engine/persist";

const STORE_FILE = "config.json"; // app data dir, managed by plugin-store
const KEY = "config";
const LS_KEY = "metin-boss-timers:v1"; // browser-dev fallback only

let storePromise: Promise<Store> | null = null;
// autoSave off — we persist explicitly via store.save() after each set.
const tauriStore = () => (storePromise ??= loadStore(STORE_FILE, { defaults: {}, autoSave: false }));

/** Read the persisted payload (or null if absent/unreadable). Validation is the caller's job. */
export async function loadPersisted(): Promise<unknown | null> {
  try {
    if (isTauri()) {
      const store = await tauriStore();
      return (await store.get(KEY)) ?? null;
    }
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // corrupt/unavailable storage → behave as "nothing persisted"
  }
}

/** Write the persisted payload. Best-effort: failures are swallowed. */
export async function savePersisted(payload: PersistedConfig): Promise<void> {
  try {
    if (isTauri()) {
      const store = await tauriStore();
      await store.set(KEY, payload);
      await store.save();
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable (quota / private mode / denied) — keep running in-memory */
  }
}
