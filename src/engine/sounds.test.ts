import { describe, expect, it } from "vitest";
import { DEFAULT_SOUND_ID, SOUND_IDS, isSoundId, soundLabel } from "./sounds";

// The sound vocabulary is the pure, asset-free core of the per-skill-sound feature:
// engine modules (config, persist, timer) validate against it without ever importing a
// `.wav`. Slugs are the persisted contract; labels are display-only.

describe("isSoundId", () => {
  it("accepts every known slug", () => {
    for (const id of SOUND_IDS) expect(isSoundId(id)).toBe(true);
  });

  it("rejects unknown, empty and non-string values", () => {
    expect(isSoundId("trumpet")).toBe(false);
    expect(isSoundId("")).toBe(false);
    expect(isSoundId(undefined)).toBe(false);
    expect(isSoundId(880)).toBe(false);
    expect(isSoundId(null)).toBe(false);
  });
});

describe("DEFAULT_SOUND_ID", () => {
  it("is itself a valid sound id", () => {
    expect(isSoundId(DEFAULT_SOUND_ID)).toBe(true);
  });
});

describe("soundLabel", () => {
  it("resolves a non-empty label for every id", () => {
    for (const id of SOUND_IDS) expect(soundLabel(id)).toBeTruthy();
  });
});
