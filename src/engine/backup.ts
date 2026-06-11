// Export / import (PRD #48, issue #56) — the portable BACKUP file, a pure pair around the existing
// `persist` (de)serialize. Export wraps the serialized config in a small self-identifying envelope;
// import validates the envelope and deserializes back. It is a backup/trust feature, NOT an upgrade
// bridge (one app → nothing to migrate between).
//
// The load-bearing property: import NEVER caps or drops data — it restores everything. Whether the
// restored data sits above the current tier's caps is a separate, read-only VIEW computed by the
// entitlement gate's `partition`. So importing an over-cap backup into an unsubscribed state lands the
// excess FROZEN (present, greyed) rather than lost — for free, by reusing the gate.

import { type Config } from "./config";
import { type PersistedConfig, deserialize, serialize } from "./persist";

/** Marks a JSON blob as one of our backups, so import can reject anything that isn't one. */
export const BACKUP_FORMAT = "dragonsaid-backup";

/** The portable file shape: a format marker + the same versioned payload `persist` writes to disk. */
type Backup = { format: typeof BACKUP_FORMAT; config: PersistedConfig };

/** Serialize the full config to a portable backup string (pretty-printed for a human-inspectable file). */
export function exportConfig(c: Config): string {
  const backup: Backup = { format: BACKUP_FORMAT, config: serialize(c) };
  return JSON.stringify(backup, null, 2);
}

/**
 * Parse a backup string back into a `Config`, or `null` if it isn't a recognisable backup (bad JSON /
 * missing marker) so the caller can surface an error instead of silently wiping. A recognised backup's
 * inner payload is run through the lenient `deserialize`, so all data is restored; nothing is capped here.
 */
export function importConfig(text: string): Config | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  if ((parsed as { format?: unknown }).format !== BACKUP_FORMAT) return null;
  return deserialize((parsed as Backup).config);
}
