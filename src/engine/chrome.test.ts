// Tests for the UI chrome resolver (src/engine/chrome.ts, slice #84).
//
// The public API is `t(key, locale)`. Because `Locale = "en"` is a single-member union until
// Slice 5, the fallback-to-English path must be exercised through the exported pure core
// `resolveChrome(tables, key, locale)` — the same approach `locale.test.ts` used to test a
// contract that couldn't be fully exercised with only one live locale. A comment marks where
// the real cross-locale test lands in Slice 5.

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

// ---- resolveChrome() — the pure fallback core ----
// HONEST SCOPE: `Locale = "en"` is a single-member union until Slice 5, so a real en→de
// transition is unwritable through `t()` today. We drive `resolveChrome` directly with a
// typed cast to simulate a partial locale table. When `de` lands (Slice 5), add a test that
// `t(key, "de")` returns the German string when present, and falls back for missing keys.

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
