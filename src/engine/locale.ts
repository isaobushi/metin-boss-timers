// Pure locale-selection logic (PRD #77, slice #83): the engine module that owns "pick a
// supported locale from an OS-supplied string, or fall back to English". Everything here is
// pure (no I/O, no React, no Tauri) so it is fully unit-testable.
//
// The OS locale seam (Tauri's `locale()` call) lives in `overlay/osLocale.ts` — the one
// impure boundary; it is verified manually, per house convention for I/O edges.

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./localeTypes";

/**
 * Pick the best supported locale from an OS-supplied locale string, or fall back to
 * `DEFAULT_LOCALE` ("en") when the OS string is absent, empty, or unmapped.
 *
 * Matching strategy (most-specific first):
 *   1. Exact match on the full tag (`"en"` → `"en"`).
 *   2. Language-only prefix match: strip the region subtag and retry
 *      (`"en-AU"` → `"en"`, `"de-DE"` → `"de"`).
 *
 * An OS locale outside `SUPPORTED_LOCALES` (currently `en` + `de`) falls back to English.
 * The pick function is written generically so it extends automatically as more locale tables
 * are added to `SUPPORTED_LOCALES`.
 */
export function pickLocale(osLocale: string | null | undefined): Locale {
  if (!osLocale) return DEFAULT_LOCALE;

  // Normalise: lower-case, replace underscore separators (e.g. "en_AU") with hyphens.
  const normalised = osLocale.trim().toLowerCase().replace(/_/g, "-");
  if (!normalised) return DEFAULT_LOCALE;

  const supported = SUPPORTED_LOCALES as string[];

  // 1. Exact match (e.g. "en" → "en").
  if (supported.includes(normalised)) return normalised as Locale;

  // 2. Language-prefix match: "en-au" → "en".
  const lang = normalised.split("-")[0];
  if (supported.includes(lang)) return lang as Locale;

  return DEFAULT_LOCALE;
}
