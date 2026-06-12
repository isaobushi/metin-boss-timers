import { describe, expect, it } from "vitest";
import { isSettingsTab, parseSettingsHash, settingsHash } from "./settingsLink";

// The deep-link vocabulary (#72): the hash crosses a window boundary as a string, so the
// build/parse pair is a wire contract — a drifted format is a silently dead deep link.
describe("settingsLink (#72)", () => {
  it("builds the bare surface hash without a tab — the historical URL stays valid", () => {
    expect(settingsHash()).toBe("settings");
  });

  it("round-trips every tab through build → parse", () => {
    for (const tab of ["dungeons", "cooldowns", "items", "routine", "language"] as const) {
      expect(parseSettingsHash(settingsHash(tab))).toEqual({ isSettings: true, tab });
    }
  });

  it("parses with or without the leading #", () => {
    expect(parseSettingsHash("#settings?tab=items")).toEqual({ isSettings: true, tab: "items" });
    expect(parseSettingsHash("settings?tab=items")).toEqual({ isSettings: true, tab: "items" });
  });

  it("recognizes the surface but degrades an unknown tab to null (stale link, never a throw)", () => {
    expect(parseSettingsHash("#settings?tab=bogus")).toEqual({ isSettings: true, tab: null });
    expect(parseSettingsHash("#settings")).toEqual({ isSettings: true, tab: null });
  });

  it("rejects non-settings hashes outright — including prefix lookalikes", () => {
    expect(parseSettingsHash("")).toEqual({ isSettings: false, tab: null });
    expect(parseSettingsHash("#overlay")).toEqual({ isSettings: false, tab: null });
    expect(parseSettingsHash("#settingsfoo?tab=items")).toEqual({ isSettings: false, tab: null });
  });

  it("guards wire payloads: only the five tab names pass isSettingsTab", () => {
    expect(isSettingsTab("routine")).toBe(true);
    expect(isSettingsTab("bogus")).toBe(false);
    expect(isSettingsTab(null)).toBe(false);
    expect(isSettingsTab(42)).toBe(false);
  });
});
