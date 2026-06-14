import { describe, expect, it } from "vitest";
import { pickLocale } from "./locale";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./localeTypes";
import { resolveDisplayName } from "./contentCatalog";
import { deserialize, serialize } from "./persist";
import { makeConfig, activeRecurring, activeRecurringProgress, markRecurring, markRead } from "./config";
import { cooldownKey, recurringKey } from "./contentKeys";

// ---- pickLocale — the pure OS-locale → supported-locale mapping ----

describe("pickLocale", () => {
  it("returns the default locale for null/undefined/empty input", () => {
    expect(pickLocale(null)).toBe(DEFAULT_LOCALE);
    expect(pickLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(pickLocale("")).toBe(DEFAULT_LOCALE);
    expect(pickLocale("   ")).toBe(DEFAULT_LOCALE);
  });

  it('maps "en" to "en" (exact match)', () => {
    expect(pickLocale("en")).toBe("en");
  });

  it('maps a supported locale with a region subtag via prefix match ("en-AU" → "en")', () => {
    expect(pickLocale("en-AU")).toBe("en");
    expect(pickLocale("en-US")).toBe("en");
    expect(pickLocale("en-GB")).toBe("en");
  });

  it("normalises underscore separators (e.g. \"en_AU\" → \"en\")", () => {
    expect(pickLocale("en_AU")).toBe("en");
    expect(pickLocale("en_US")).toBe("en");
  });

  it("is case-insensitive (\"EN\", \"EN-AU\" all map to \"en\")", () => {
    expect(pickLocale("EN")).toBe("en");
    expect(pickLocale("EN-AU")).toBe("en");
  });

  it('maps "de" to "de" (German is now a supported locale — Slice 5)', () => {
    expect(pickLocale("de")).toBe("de");
    expect(pickLocale("de-DE")).toBe("de");
    expect(pickLocale("de-AT")).toBe("de");
  });

  it('maps "it" to "it" (Italian — #99 slice 1; region + prefix variants resolve)', () => {
    expect(pickLocale("it")).toBe("it");
    expect(pickLocale("it-IT")).toBe("it");
    expect(pickLocale("it-CH")).toBe("it"); // Italian-speaking Switzerland → it
  });

  it("falls back to English for an unsupported language", () => {
    // fr/zh are not yet shipped (fr lands in a later #99 slice); they must fall back to English.
    expect(pickLocale("fr-FR")).toBe("en");
    expect(pickLocale("zh-CN")).toBe("en");
  });

  it("falls back to English for a completely garbage string", () => {
    expect(pickLocale("not-a-locale-xyz-9999")).toBe("en");
  });

  it("covers every entry in SUPPORTED_LOCALES with an exact-match round-trip", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(pickLocale(locale)).toBe(locale);
    }
  });
});

// ---- locale persist round-trip ----
// `locale` lives on Config and is carried through serialize/deserialize so the user's
// choice survives a disk hop.

describe("locale persist round-trip", () => {
  const throughDisk = (raw: unknown) => JSON.parse(JSON.stringify(raw));

  it("serialize includes locale when set", () => {
    const c = { ...makeConfig(), locale: "en" as const };
    const payload = serialize(c);
    expect(payload.locale).toBe("en");
  });

  it("round-trips locale through a JSON disk hop", () => {
    const c = { ...makeConfig(), locale: "en" as const };
    const restored = deserialize(throughDisk(serialize(c)));
    expect(restored.locale).toBe("en");
  });

  it("defaults to 'en' when locale is absent from the persisted payload (pre-feature config)", () => {
    const c = makeConfig();
    const payload = serialize(c);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload as any).locale;
    const restored = deserialize(throughDisk(payload));
    expect(restored.locale).toBe("en");
  });

  it("defaults to 'en' when locale is an unknown/future value on disk (lenient)", () => {
    const c = makeConfig();
    const payload = serialize(c);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (payload as any).locale = "klingon";
    const restored = deserialize(throughDisk(payload));
    expect(restored.locale).toBe("en");
  });
});

// ---- locale is presentation-only: the resolver answers per-locale, stored data never moves ----
// With Slice 5 ("de" lands) the cross-locale re-resolution test is now real: the same catalogKey
// resolves to a DIFFERENT display string under "en" vs "de" (the DE content table carries the
// transcribed official-client German names). The CONTRACT is that stored data (the `name`
// fallback, running timers, ladder progress) is never touched — only the locale field changes,
// and the resolver picks up the difference at render time.

describe("locale is presentation-only — writing the locale field never touches stored data", () => {
  it("resolveDisplayName returns the English string under 'en'", () => {
    const key = cooldownKey("Hydra");
    expect(resolveDisplayName({ catalogKey: key, name: "Hydra" }, "en")).toBe("Hydra");
  });

  it("a user-created def (no catalogKey) is always rendered verbatim regardless of locale", () => {
    expect(resolveDisplayName({ name: "My Custom Boss" }, "en")).toBe("My Custom Boss");
    expect(resolveDisplayName({ name: "My Custom Boss" }, "de")).toBe("My Custom Boss");
  });

  it("cross-locale re-resolution: a seeded item's displayName changes when locale flips en→de and back", () => {
    // "Battle Horse" has a genuinely divergent DE transcription, so this pins the real contract:
    // the SAME stored def renders differently per locale, and flipping back restores English.
    // (A same-in-both-tables key like Hydra would pass even if the locale argument were ignored.)
    const key = recurringKey("Battle Horse");
    const nameEn = resolveDisplayName({ catalogKey: key, name: "Battle Horse" }, "en");
    const nameDe = resolveDisplayName({ catalogKey: key, name: "Battle Horse" }, "de");
    expect(nameEn).toBe("Battle Horse");
    expect(nameDe).not.toBe(nameEn); // the DE table answered, not the English fallback
    // Flip back to English — same as before.
    expect(resolveDisplayName({ catalogKey: key, name: "Battle Horse" }, "en")).toBe(nameEn);
  });

  it("recurring defs are read-only for localization (resolution happens at render, not in Config)", () => {
    // The recurring catalog in Config is untouched by a locale change — localization is a
    // PRESENTATION concern resolved at render time, not a mutation of the stored name.
    const c = makeConfig();
    const defs = activeRecurring(c);
    const first = defs[0];
    expect(resolveDisplayName(first, "en")).toBe(first.name);
    // The def itself is unchanged — localization is presentation-only.
    expect(first.name).toBe(activeRecurring(c)[0].name);
  });

  it("ladder progress (recurringProgress) is untouched when the locale field is rewritten", () => {
    // A locale change only writes the locale value on Config; the progress map is not touched.
    let c = makeConfig();
    const def = activeRecurring(c).find((d) => d.ladderId === "class-skill")!;
    c = markRead(c, def.id, 1000, true); // advance rank by one read
    const progressBefore = activeRecurringProgress(c);
    expect(progressBefore.length).toBe(1); // one rung advancement recorded

    // Rewrite the `locale` field on Config (en→de).
    const switched = { ...c, locale: "de" as const };
    // Progress map is unchanged.
    expect(activeRecurringProgress(switched)).toEqual(progressBefore);
  });

  it("the recurringRunning set is untouched when the locale field is rewritten", () => {
    let c = makeConfig();
    const gateId = activeRecurring(c).find((d) => d.kind === "gate")!.id;
    c = markRecurring(c, gateId, 1000);
    const runningBefore = c.characters.find((ch) => ch.id === c.activeCharacterId)!.recurringRunning;

    // Rewriting the locale field does not disturb the running set.
    const switched = { ...c, locale: "de" as const };
    expect(switched.characters.find((ch) => ch.id === switched.activeCharacterId)!.recurringRunning)
      .toEqual(runningBefore);
  });

  it("seeded recurring name (the English fallback `name` field) is untouched when the locale field is rewritten", () => {
    // Per spec: user-created free-text names and seeded def names must stay exactly as typed/seeded.
    const c = makeConfig();
    const def = activeRecurring(c).find((d) => d.catalogKey === recurringKey("Skill Books"))!;
    const nameBefore = def.name;

    const switched = { ...c, locale: "de" as const };
    const defAfter = activeRecurring(switched).find((d) => d.id === def.id)!;
    expect(defAfter.name).toBe(nameBefore);
  });
});
