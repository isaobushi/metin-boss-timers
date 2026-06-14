// Locale type declarations — a leaf module imported by both `config.ts` and `contentCatalog.ts`
// without creating a circular dependency. Keeping the type, constant, and supported-list here
// lets `config.ts` carry the `locale` field without pulling in the full content-catalog graph.

/**
 * A supported content locale. Expands to the official-client regions as their tables land.
 * History: en + de (#85 German pilot), then it (#99 slice 1 — Italian, transcribed directly
 * since the maintainer reads the client). PL/TR/ES/FR follow as their seeded tables land (#99).
 *
 * Codes are clean ISO 639-1 (it, pl, tr, es, fr). NOTE for whoever adds the remaining dump
 * languages later: the metin2alerts reference dump (see [[metin2alerts-locale-source]]) keys four
 * of its files by COUNTRY code, not ISO language code — `gr`=Greek (not el), `cz`=Czech (not cs),
 * `dk`=Danish (not da), `ae`=Arabic (not ar). Those four do not affect the five #99 launch
 * languages, but do NOT "correct" them to ISO when looking up the dump or the lookup breaks.
 */
export type Locale = "en" | "de" | "it";

/** The fallback locale: every seeded key is guaranteed to resolve here. */
export const DEFAULT_LOCALE: Locale = "en";

/** Every locale currently shipped with a content table. The completeness guard holds for each. */
export const SUPPORTED_LOCALES: Locale[] = ["en", "de", "it"];

/**
 * Human-readable label per locale (the Settings picker). Exhaustive by construction — adding a
 * locale to the `Locale` union without a label here is a compile error (same contract as
 * `SOUND_LABELS` in sounds.ts), so the picker can never silently fall back to a raw code.
 * Each label is the language's endonym (how its own speakers name it), matching the picker idiom.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  it: "Italiano",
};
