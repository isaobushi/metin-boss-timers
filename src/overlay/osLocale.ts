// The OS-locale I/O seam (slice #83): read the platform's language preference and map it
// to a supported content locale. This is the ONLY impure boundary for locale — everything
// downstream is pure and fully tested. Verified manually, per house convention for I/O edges.
//
// Tauri v2 provides `locale()` from `@tauri-apps/plugin-os`. That plugin is NOT wired up
// as a JS or Rust dependency yet (only `en` content exists until Slice 5, so it would be
// observable but not visibly useful). The seam is stubbed to return English; when Slice 5
// adds the plugin, replace the stub body with:
//
//   import { locale } from "@tauri-apps/plugin-os";
//   const tag = await locale();
//   return pickLocale(tag);
//
// and add the dependency + capability in the Tauri manifest.
import { pickLocale } from "../engine/locale";
import type { Locale } from "../engine/localeTypes";

/**
 * Read the OS language and pick the best supported locale. Currently stubbed to return the
 * English fallback (the only locale with a content table until Slice 5). When plugin-os is
 * wired up, replace the stub with the real `locale()` call (see file header).
 */
export async function readOsLocale(): Promise<Locale> {
  // Stub: `@tauri-apps/plugin-os` is not yet a dependency (check before adding). Return the
  // result of pickLocale(null) = "en" so the first-run path is exercisable and correct.
  return pickLocale(null);
}
