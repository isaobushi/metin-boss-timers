// Locale hook for the overlay — exposes the live locale from the persisted Config so any
// overlay component can call `useLocale()` and pass the result straight to `resolveDisplayName`
// / `displayName`. The hook is a thin read of `config.locale`; the setter lives in `useConfig`
// (the normal Config-mutation path). No React context needed: the locale lives on the shared
// `Config` that `useConfig` already manages.
import type { Locale } from "../engine/contentCatalog";
import type { useConfig } from "./useConfig";

/**
 * Read the live locale from the persisted config. Returns the current locale string so
 * callers can pass it directly to the content-catalog resolver.
 *
 * Usage:
 *   const locale = useLocale(cfg);
 *   resolveDisplayName(def, locale)
 */
export function useLocale(cfg: ReturnType<typeof useConfig>): Locale {
  return cfg.config.locale;
}
