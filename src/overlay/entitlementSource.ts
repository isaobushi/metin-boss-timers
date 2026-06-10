// The `storeLicense` ADAPTER (PRD #48, issue #55) — the impure boundary that feeds the pure
// entitlement gate its real input. It does three impure things: read the OS-cached Microsoft Store
// license, remember the last-known Pro state across launches (the grace memory), and stamp the
// current clock. All the DECISION logic lives in the pure `engine/storeLicense` mapper; this file
// only does I/O and hands it values. By design it is NOT unit-tested (it's an I/O seam) — the mapper
// carries the test weight.
//
// Trust story (ADR-0002): the license read is a LOCAL read of an OS-managed license — never a
// network call from this binary. Windows refreshes the cached license in the background; we only read.
import { isTauri } from "@tauri-apps/api/core";
import { load as loadStore, type Store } from "@tauri-apps/plugin-store";
import { type GraceState, type LicenseRead, resolveEntitlement } from "../engine/storeLicense";
import type { Entitlement } from "../engine/entitlement";

const STORE_FILE = "entitlement.json"; // app data dir, managed by plugin-store
const GRACE_KEY = "grace";
const LS_KEY = "metin-boss-timers:grace:v1"; // browser-dev fallback only

let storePromise: Promise<Store> | null = null;
const tauriStore = () => (storePromise ??= loadStore(STORE_FILE, { defaults: {}, autoSave: false }));

/**
 * The stubbed license read until #16 wires the real Windows Store identity. It reports an active
 * (non-trial) license so dev runs — the web demo, `npm run dev`, and Tauri-on-macOS where there is no
 * Store — stay Pro, exactly as the prior `DEV_ENTITLEMENT = "subscribed"` did. On Windows this MUST be
 * replaced (#16) by a Tauri command that reads the OS-cached Store license before any paid gating ships.
 */
const DEV_LICENSE_READ: LicenseRead = { kind: "active", trial: false };

/** Read the OS-cached Store license. TODO(#16): invoke the real Windows read; for now the dev stub. */
async function readLicense(): Promise<LicenseRead> {
  return DEV_LICENSE_READ;
}

/** Load the persisted grace memory (null if absent/unreadable — treated as "no Pro history"). */
async function loadGrace(): Promise<GraceState> {
  try {
    if (isTauri()) {
      const store = await tauriStore();
      return ((await store.get<GraceState>(GRACE_KEY)) ?? null);
    }
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as GraceState) : null;
  } catch {
    return null; // corrupt/unavailable → behave as "no Pro history" (fail to Lite, never crash)
  }
}

/** Persist the grace memory. Best-effort: failures are swallowed so launch never breaks. */
async function saveGrace(grace: GraceState): Promise<void> {
  try {
    if (isTauri()) {
      const store = await tauriStore();
      await store.set(GRACE_KEY, grace);
      await store.save();
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(grace));
  } catch {
    /* storage unavailable — keep running; we just lose offline-grace memory for this launch */
  }
}

/**
 * Resolve the current entitlement at launch: read the OS-cached license, fold it against the
 * remembered grace through the pure mapper, persist the updated grace, and return the entitlement the
 * gate should run as. The clock is read HERE (Date.now) so the mapper stays pure and callers stay
 * clock-free. Best-effort throughout — any failure resolves to `never` (clean Lite), never a crash.
 */
export async function resolveLaunchEntitlement(): Promise<Entitlement> {
  try {
    const [read, grace] = await Promise.all([readLicense(), loadGrace()]);
    const result = resolveEntitlement(read, grace, Date.now());
    await saveGrace(result.grace);
    return result.entitlement;
  } catch {
    return "never";
  }
}
