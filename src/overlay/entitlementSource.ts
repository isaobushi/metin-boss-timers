// The `storeLicense` ADAPTER (PRD #48, issue #55) — the impure boundary that feeds the pure
// entitlement gate its real input. It does three impure things: read the OS-cached Microsoft Store
// license, remember the last-known Pro state across launches (the grace memory), and stamp the
// current clock. All the DECISION logic lives in the pure `engine/storeLicense` mapper; this file
// only does I/O and hands it values. By design it is NOT unit-tested (it's an I/O seam) — the mapper
// carries the test weight.
//
// Trust story (ADR-0002): the license read is a LOCAL read of an OS-managed license — never a
// network call from this binary. Windows refreshes the cached license in the background; we only read.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { load as loadStore, type Store } from "@tauri-apps/plugin-store";
import { type GraceState, isTrialActive, type LicenseRead, resolveEntitlement, TRIAL_MS } from "../engine/storeLicense";
import { type Entitlement, isPro } from "../engine/entitlement";

const STORE_FILE = "entitlement.json"; // app data dir, managed by plugin-store
const GRACE_KEY = "grace";
const LS_KEY = "metin-boss-timers:grace:v1"; // browser-dev fallback only

// The Store's add-on license can't say "trial" (StoreLicense has no IsTrial — only the APP license
// does, and Pro rides on add-ons). So the 7-day trial window is stamped locally when the trial
// purchase succeeds, and an active license inside that window reads as `trial`. After the window the
// same license reads `subscribed` — which matches reality: the Store auto-converts the trial to paid.
const TRIAL_KEY = "trialUntil";
const TRIAL_LS_KEY = "metin-boss-timers:trialUntil:v1"; // browser-dev fallback only

let storePromise: Promise<Store> | null = null;
const tauriStore = () => (storePromise ??= loadStore(STORE_FILE, { defaults: {}, autoSave: false }));

/** Read one persisted key (Tauri store, or the localStorage fallback in browser dev). null = absent/unreadable. */
async function readKey<T>(key: string, lsKey: string): Promise<T | null> {
  try {
    if (isTauri()) {
      const store = await tauriStore();
      return (await store.get<T>(key)) ?? null;
    }
    const raw = localStorage.getItem(lsKey);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // corrupt/unavailable → behave as "no record" (fail to Lite, never crash)
  }
}

/** Persist one key (null deletes it). Best-effort: failures are swallowed so launch never breaks. */
async function writeKey(key: string, lsKey: string, value: unknown): Promise<void> {
  try {
    if (isTauri()) {
      const store = await tauriStore();
      if (value == null) await store.delete(key);
      else await store.set(key, value);
      await store.save();
      return;
    }
    if (value == null) localStorage.removeItem(lsKey);
    else localStorage.setItem(lsKey, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep running; we just lose this record for the launch */
  }
}

/**
 * The dev license read for runs where no Microsoft Store exists — the web demo, `npm run dev`, and
 * Tauri-on-macOS. It reports an active (non-trial) license so those runs stay Pro, exactly as the
 * prior `DEV_ENTITLEMENT = "subscribed"` did; the TIER chips remain the way to exercise other states.
 */
const DEV_LICENSE_READ: LicenseRead = { kind: "active", trial: false };

/** What the Rust `read_store_license` command reports (src-tauri/src/store_iap.rs). */
type RawLicense = "active" | "expired" | "absent" | "unverifiable" | "unsupported";

/**
 * Read the OS-cached Store license via the Rust command (#58). Platform-shaped → engine-shaped:
 * - "unsupported" (non-Windows Tauri) and non-Tauri runs keep the dev stub — there is no Store.
 * - "absent" (no Pro add-on license entry at all) folds to `unverifiable`: the pure mapper resolves
 *   it by grace — a never-paid user lands on `never`, a recently-Pro one fails OPEN (a missing entry
 *   could be a Store cache hiccup; only a definitive `expired` may freeze someone).
 * - "active" gains the trial flag from the locally stamped trial window (see TRIAL_KEY).
 */
async function readLicense(): Promise<LicenseRead> {
  if (!isTauri()) return DEV_LICENSE_READ;
  try {
    const raw = await invoke<RawLicense>("read_store_license");
    if (raw === "unsupported") return DEV_LICENSE_READ;
    if (raw === "active") return { kind: "active", trial: await inTrialWindow() };
    if (raw === "expired") return { kind: "expired" };
    return { kind: "unverifiable" };
  } catch {
    return { kind: "unverifiable" }; // invoke itself failed — never guess a definitive state
  }
}

/** Load the persisted grace memory (null = "no Pro history"). */
const loadGrace = (): Promise<GraceState> => readKey<NonNullable<GraceState>>(GRACE_KEY, LS_KEY);

/** Persist the grace memory. */
const saveGrace = (grace: GraceState): Promise<void> => writeKey(GRACE_KEY, LS_KEY, grace);

/** Is the locally stamped 7-day trial window still open? (Closed on no stamp / unreadable storage.) */
const inTrialWindow = async (): Promise<boolean> =>
  isTrialActive(await readKey<number>(TRIAL_KEY, TRIAL_LS_KEY), Date.now());

/** Stamp the trial window (`until` ms epoch), or clear it with null. */
const saveTrialUntil = (until: number | null): Promise<void> => writeKey(TRIAL_KEY, TRIAL_LS_KEY, until);

/**
 * Fold a successful Store purchase into entitlement state (#58). Called by `purchaseFlow` after the
 * Store dialog reports success: stamp the grace memory optimistically (so the next launches stay Pro
 * even if the OS license cache lags the purchase by days), open/clear the trial window, then re-read
 * the license — the authoritative loop the screen promises. If the cached license hasn't caught up
 * yet (an `absent`/stale-`expired` read straight after paying), fall back to the granted tier.
 */
export async function confirmPurchase(granted: "trial" | "subscribed"): Promise<Entitlement> {
  await saveTrialUntil(granted === "trial" ? Date.now() + TRIAL_MS : null);
  await saveGrace({ lastProAt: Date.now(), pro: granted });
  const resolved = await resolveLaunchEntitlement();
  return isPro(resolved) ? resolved : granted;
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
