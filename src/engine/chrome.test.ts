// Tests for the UI chrome resolver (src/engine/chrome.ts, slice #84 / #85).
//
// The public API is `t(key, locale)`. Slice 5 ships the real `de` table, so cross-locale tests
// now drive `t()` directly (rather than the pure-core stub approach used before "de" landed).
// The fallback-to-English path is also exercised through `resolveChrome` with stub tables.

import { describe, expect, it } from "vitest";
import { t, resolveChrome } from "./chrome";
import type { ChromeKey } from "./chrome";

// ---- t() — the public two-arg resolver ----

describe("t(key, locale)", () => {
  it("returns the English string for a known key with locale 'en'", () => {
    expect(t("settings.title", "en")).toBe("SETTINGS");
  });

  it("returns non-empty strings for all known keys in 'en'", () => {
    // A spot-check across surfaces: every authored key should resolve to a non-empty string.
    const spot: ChromeKey[] = [
      "dock.skills",
      "dock.cooldowns",
      "dock.expiring",
      "dock.routine",
      "dock.settings",
      "dock.quit",
      "boss.addSkill",
      "cooldown.addCooldown",
      "recurring.addItem",
      "recurring.addRoutine",
      "wizard.newCharacter",
      "wizard.editCharacter",
      "wizard.next",
      "wizard.back",
      "wizard.save",
      "wizard.create",
      "wizard.cancel",
      "subscribe.title",
      "settings.resetToDefaults",
    ];
    for (const key of spot) {
      expect(t(key, "en"), `key "${key}" should resolve to a non-empty string`).toBeTruthy();
    }
  });
});

// ---- t() cross-locale — real de table (Slice 5) ----

describe("t(key, 'de') — German chrome table", () => {
  it("returns the German string for dock.settings when locale is 'de'", () => {
    // "Einstellungen" is the German translation of "settings" in the DE table.
    expect(t("dock.settings", "de")).toBe("Einstellungen");
  });

  it("returns the German string for dock.skills when locale is 'de'", () => {
    expect(t("dock.skills", "de")).toBe("Skills");
  });

  it("returns the German string for dock.quit when locale is 'de'", () => {
    expect(t("dock.quit", "de")).toBe("Dragon's Aid beenden");
  });

  it("falls back to the English string for a key not in the DE table", () => {
    // subscribe.ledeTrial is a long prose string deliberately omitted from the DE partial table;
    // t() must return the English string (not the raw key, not empty).
    expect(t("subscribe.ledeTrial", "de")).toBe(t("subscribe.ledeTrial", "en"));
  });

  it("returns non-empty strings for all known keys when locale is 'de' (en fallback covers gaps)", () => {
    // Every ChromeKey must resolve to a non-empty string under 'de' — either from the DE table
    // or from the English fallback. The partial DE table must never leave a key blank.
    const spot: ChromeKey[] = [
      "dock.skills",
      "dock.cooldowns",
      "dock.expiring",
      "dock.routine",
      "dock.settings",
      "dock.quit",
      "settings.title",
      "settings.resetToDefaults",
      "wizard.newCharacter",
      "wizard.cancel",
    ];
    for (const key of spot) {
      expect(t(key, "de"), `key "${key}" should resolve to a non-empty string under de`).toBeTruthy();
    }
  });
});

// ---- resolveChrome() — the pure fallback core ----

describe("resolveChrome() — pure fallback core", () => {
  // Simulate what Slice 5 will add: a partial 'de' table with only one key translated.
  const EN_STUB = { "foo.bar": "Hello", "foo.baz": "World" } as Record<string, string>;
  // A partial table: only "foo.bar" is translated in this stub locale.
  const PARTIAL_STUB = { "foo.bar": "Hallo" } as Record<string, string>;

  it("resolves a key present in the requested locale's table", () => {
    const tables = { en: EN_STUB, de: PARTIAL_STUB } as Record<string, Record<string, string>>;
    expect(resolveChrome(tables, "foo.bar", "de")).toBe("Hallo");
  });

  it("falls back to English when the key is missing from the requested locale", () => {
    // "foo.baz" is NOT in PARTIAL_STUB — must fall back to English.
    const tables = { en: EN_STUB, de: PARTIAL_STUB } as Record<string, Record<string, string>>;
    expect(resolveChrome(tables, "foo.baz", "de")).toBe("World");
  });

  it("falls back to English when the locale has no table at all", () => {
    // Locale "fr" doesn't exist in tables — must fall back to English.
    const tables = { en: EN_STUB } as Record<string, Record<string, string>>;
    expect(resolveChrome(tables, "foo.bar", "fr")).toBe("Hello");
  });

  it("returns the English string when locale is 'en'", () => {
    const tables = { en: EN_STUB } as Record<string, Record<string, string>>;
    expect(resolveChrome(tables, "foo.bar", "en")).toBe("Hello");
  });

  it("returns the raw key as last-resort fallback for a key in no table (defensive)", () => {
    // Even if somehow an unknown key is passed, the function must not blow up.
    const tables = { en: EN_STUB } as Record<string, Record<string, string>>;
    expect(resolveChrome(tables, "unknown.key", "en")).toBe("unknown.key");
  });
});
