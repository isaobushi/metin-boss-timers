import { describe, expect, it } from "vitest";
import { t } from "./chrome";
import { TOUR_STEPS, tourStepsFor } from "./tourSteps";

// The tour registry (#70): order and shape are the contract — slice 3 spotlights dockSegment and
// opens panelToOpen per beat, so a reorder or a broken copy key is a real regression, not style.
describe("tourSteps (#70)", () => {
  it("declares the 9 beats in dock order: welcome → dock → character → ⚔ ⏱ ⧗ ✓ ⚙ → done", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "welcome",
      "dock",
      "character",
      "skills",
      "cooldowns",
      "items",
      "routine",
      "settings",
      "done",
    ]);
  });

  it("tool beats point at their dock glyph; framing beats (welcome/dock/character/done) point at none", () => {
    const segs = Object.fromEntries(TOUR_STEPS.map((s) => [s.id, s.dockSegment]));
    expect(segs).toEqual({
      welcome: null,
      dock: null,
      character: null,
      skills: "skills",
      cooldowns: "cooldowns",
      items: "items",
      routine: "routine",
      settings: "settings",
      done: null,
    });
  });

  it("panelToOpen names only exclusive panels — cooldowns stays null (its tool is the pinned strip)", () => {
    const panels = Object.fromEntries(TOUR_STEPS.map((s) => [s.id, s.panelToOpen]));
    expect(panels).toEqual({
      welcome: null,
      dock: null,
      character: null,
      skills: "skills",
      cooldowns: null,
      items: "items",
      routine: "routine",
      settings: null,
      done: null,
    });
  });

  // The character beat (design walk 4): it gets the character details in (classify the seeded
  // "Main", or create over an empty roster), so it plays only while the active character is
  // unclassified — a replay over a classified one drops it; the rest of the registry is untouched.
  it("tourStepsFor keeps the character beat only while the active character is unclassified", () => {
    expect(tourStepsFor(false)).toEqual(TOUR_STEPS);
    expect(tourStepsFor(true).map((s) => s.id)).toEqual(
      TOUR_STEPS.map((s) => s.id).filter((id) => id !== "character"),
    );
  });

  it("every beat's copy resolves to non-empty strings in both shipped locales", () => {
    for (const step of TOUR_STEPS) {
      for (const locale of ["en", "de"] as const) {
        expect(t(step.copy.title, locale), `${step.id} title (${locale})`).not.toBe("");
        expect(t(step.copy.body, locale), `${step.id} body (${locale})`).not.toBe("");
      }
    }
  });

  it("copy respects the glossary avoid-words (no reminder/daily/quest/alarm)", () => {
    for (const step of TOUR_STEPS) {
      for (const locale of ["en", "de"] as const) {
        const text = `${t(step.copy.title, locale)} ${t(step.copy.body, locale)}`;
        expect(text, `${step.id} (${locale})`).not.toMatch(/\b(reminder|daily|quest|alarm)/i);
      }
    }
  });

  it("frames the Routine beat as a menu, not a checklist", () => {
    const routine = TOUR_STEPS.find((s) => s.id === "routine")!;
    expect(t(routine.copy.body, "en")).toMatch(/menu/i);
    expect(t(routine.copy.body, "en")).toMatch(/not behind/i);
  });

  it("tool beats deep-link to their settings tab; framing beats carry no nudge (#72)", () => {
    const links = Object.fromEntries(TOUR_STEPS.map((s) => [s.id, s.settingsDeepLink]));
    expect(links).toEqual({
      welcome: null,
      dock: null,
      character: null, // its editor is embedded right in the card — nothing to deep-link to
      skills: "dungeons", // the ⚔ boss/skill editor lives on the Dungeons tab
      cooldowns: "cooldowns",
      items: "items",
      routine: "routine",
      settings: "dungeons", // ⚙'s nudge is the generic "go see settings" — lands on the default tab
      done: null,
    });
  });
});
