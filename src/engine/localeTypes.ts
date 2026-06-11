// Locale type declarations — a leaf module imported by both `config.ts` and `contentCatalog.ts`
// without creating a circular dependency. Keeping the type, constant, and supported-list here
// lets `config.ts` carry the `locale` field without pulling in the full content-catalog graph.

/** A supported content locale. Expands to the official-client regions as their tables land (#85+). */
export type Locale = "en";

/** The fallback locale: every seeded key is guaranteed to resolve here. */
export const DEFAULT_LOCALE: Locale = "en";

/** Every locale currently shipped with a content table. The completeness guard holds for each. */
export const SUPPORTED_LOCALES: Locale[] = ["en"];
