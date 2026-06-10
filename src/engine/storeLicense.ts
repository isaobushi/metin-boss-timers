// The `storeLicense` mapper (PRD #48, issue #55) — the PURE core of the otherwise-impure adapter
// that turns a local read of the OS-cached Microsoft Store license into an `Entitlement`. The actual
// read is an I/O boundary (a Tauri command on Windows, #16) and lives in the overlay layer; THIS file
// owns only the decision logic, so the fail-open-with-grace rules are unit-testable with a fake clock
// and never touch the platform.
//
// "Fail open with grace": a valid cached license is Pro; a license that can't be verified (offline,
// read failed) but was recently Pro stays Pro within a grace window; only a license that DEFINITIVELY
// reads expired drops to `lapsed`. An offline player is never falsely downgraded mid-season.

import type { Entitlement } from "./entitlement";

/**
 * A single local read of the OS-cached Store license — the raw, platform-shaped input the impure
 * adapter produces (never via a network call). `active` carries whether it's a trial; `expired` is a
 * definitive negative; `unverifiable` is "couldn't tell" (offline / the read itself failed).
 */
export type LicenseRead =
  | { kind: "active"; trial: boolean }
  | { kind: "expired" }
  | { kind: "unverifiable" };

/**
 * The grace memory the adapter persists between launches: when we last saw a Pro license and which
 * Pro state it was, so an `unverifiable` read can fail OPEN to that prior state. `null` = we have no
 * record of ever being Pro (a never-paid user, or first launch).
 */
export type GraceState = { lastProAt: number; pro: "subscribed" | "trial" } | null;

/**
 * How long an `unverifiable` (offline / read-failed) launch keeps a recently-Pro user on Pro. Windows
 * already caches the license itself; this is the app's own extra fail-safe for when even the local
 * read fails. 14 days covers a vacation or an offline grind PC without letting a truly-cancelled
 * subscription run Pro forever. TUNABLE — the PRD (#48) marks the exact window out of scope.
 */
export const GRACE_MS = 14 * 24 * 60 * 60 * 1000;

/** Maps a license read to an entitlement plus the grace memory to persist for next launch. */
export function resolveEntitlement(
  read: LicenseRead,
  grace: GraceState,
  now: number,
): { entitlement: Entitlement; grace: GraceState } {
  if (read.kind === "active") {
    const pro = read.trial ? "trial" : "subscribed";
    return { entitlement: pro, grace: { lastProAt: now, pro } };
  }
  if (read.kind === "expired") {
    // A definitive negative overrides any grace: the license really is gone, so drop to lapsed. We
    // keep the grace memory as-is (harmless — it's only consulted on an `unverifiable` read).
    return { entitlement: "lapsed", grace };
  }
  // Unverifiable from here: no network read happened, so we lean on the grace memory.
  if (!grace) {
    // No record of ever being Pro → `never` (clean Lite caps, nothing frozen), not `lapsed`. This is
    // the never-paid user, or an offline first launch.
    return { entitlement: "never", grace };
  }
  // We were Pro before: fail OPEN to that state inside the window, else the grace has expired → lapsed.
  if (now - grace.lastProAt <= GRACE_MS) {
    return { entitlement: grace.pro, grace };
  }
  return { entitlement: "lapsed", grace };
}
