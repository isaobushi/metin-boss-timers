import { describe, expect, it } from "vitest";
import { makeConfig, type Config } from "./config";
import { DEFAULT_CHARACTER_NAME, activeCharacter, makeCharacter } from "./character";
import type { RecurringDef } from "./recurring";

// The Character owns the recurring side of the app (#47). These cover the module's own surface — the
// constructor and the active-character read scoping — purely: `(inputs) -> value`, no clock, no I/O.

describe("makeCharacter", () => {
  it("holds the given recurring slices", () => {
    const recurring: RecurringDef[] = [{ id: "recurring-1", name: "A", durationMs: 1000, kind: "gate" }];
    const ch = makeCharacter("character-7", "Alt", { recurring });
    expect(ch.id).toBe("character-7");
    expect(ch.name).toBe("Alt");
    expect(ch.recurring).toBe(recurring);
    expect(ch.recurringRunning).toEqual([]);
    expect(ch.recurringProgress).toEqual([]);
  });

  it("starts unclassified — empire/race unset, no builds, empty bags by default", () => {
    const ch = makeCharacter("character-1", DEFAULT_CHARACTER_NAME);
    expect(ch.empire).toBeUndefined();
    expect(ch.race).toBeUndefined();
    expect(ch.builds).toEqual([]);
    expect(ch.recurring).toEqual([]);
    expect(ch.recurringRunning).toEqual([]);
    expect(ch.recurringProgress).toEqual([]);
  });
});

describe("activeCharacter", () => {
  it("resolves the character matching activeCharacterId", () => {
    const c = makeConfig();
    const ch = activeCharacter(c);
    expect(ch).toBeDefined();
    expect(ch!.id).toBe(c.activeCharacterId);
  });

  it("is the default-named character on a fresh config", () => {
    expect(activeCharacter(makeConfig())!.name).toBe(DEFAULT_CHARACTER_NAME);
  });

  it("is undefined when no character is active (null id)", () => {
    const c: Config = { ...makeConfig(), activeCharacterId: null };
    expect(activeCharacter(c)).toBeUndefined();
  });

  it("is undefined when activeCharacterId dangles (points at no surviving character)", () => {
    const c: Config = { ...makeConfig(), activeCharacterId: "character-999" };
    expect(activeCharacter(c)).toBeUndefined();
  });

  it("follows the active id across characters — no chore slice leaks between them", () => {
    const base = makeConfig();
    const other = makeCharacter("character-2", "Alt", {
      recurring: [{ id: "recurring-99", name: "Alt chore", durationMs: 1000, kind: "gate" }],
    });
    const c: Config = { ...base, characters: [...base.characters, other], characterSeq: 2 };
    // active is still the seeded default (character-1) — its catalog, never the alt's
    expect(activeCharacter(c)!.id).toBe("character-1");
    expect(activeCharacter(c)!.recurring.some((d) => d.id === "recurring-99")).toBe(false);
    // switching the active id surfaces the alt's single chore, isolated from the default's
    const switched: Config = { ...c, activeCharacterId: "character-2" };
    expect(activeCharacter(switched)!.recurring.map((d) => d.id)).toEqual(["recurring-99"]);
  });
});
