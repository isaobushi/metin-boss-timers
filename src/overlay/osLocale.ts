// The OS-locale I/O seam (slice #83 / #85): read the platform's language preference and map it
// to a supported content locale. This is the ONLY impure boundary for locale — everything
// downstream is pure and fully tested. Verified manually, per house convention for I/O edges.
//
// Slice 5 wires up `@tauri-apps/plugin-os` (JS npm + Rust crate + os:allow-locale capability).
// The `locale()` call returns the OS BCP-47 tag (e.g. "de-DE", "en-AU"); `pickLocale` maps it
// to the nearest supported locale or falls back to English.
import { locale } from "@tauri-apps/plugin-os";
import { pickLocale } from "../engine/locale";
import type { Locale } from "../engine/localeTypes";

/**
 * Read the OS language and pick the best supported locale. Falls back to English when the OS
 * returns null/undefined or an unsupported language tag. Verified manually per house convention
 * for I/O edges (not unit-tested — this is the impure boundary).
 */
export async function readOsLocale(): Promise<Locale> {
  const tag = await locale();
  return pickLocale(tag);
}
