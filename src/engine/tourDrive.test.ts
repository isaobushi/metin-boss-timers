import { describe, expect, it } from "vitest";
import { driveForStep } from "./tourDrive";
import { TOUR_STEPS } from "./tourSteps";

// The slice-3 (#71) drive contract: each beat's spotlight/panel/pin is what the shell renders, so
// a wrong mapping is a tour pointing at the wrong tool — a real regression, not style.
describe("tourDrive (#71)", () => {
  const drives = Object.fromEntries(TOUR_STEPS.map((s) => [s.id, driveForStep(s)]));

  it("spotlights each tool beat's own glyph; framing beats (welcome/dock/done) ring nothing", () => {
    expect(Object.fromEntries(Object.entries(drives).map(([id, d]) => [id, d.spotlight]))).toEqual({
      welcome: null,
      dock: null,
      skills: "skills",
      cooldowns: "cooldowns",
      items: "items",
      routine: "routine",
      settings: "settings",
      done: null,
    });
  });

  it("opens the live panel per beat — ⚔ drives the TIMERS surface (chips, not the picker)", () => {
    expect(Object.fromEntries(Object.entries(drives).map(([id, d]) => [id, d.panel]))).toEqual({
      welcome: null,
      dock: null,
      skills: "timers",
      cooldowns: null,
      items: "items",
      routine: "routine",
      settings: null,
      done: null,
    });
  });

  it("pins the cooldown strip on the ⏱ beat only — every other beat unpins it", () => {
    for (const [id, d] of Object.entries(drives)) {
      expect(d.pinCooldowns, id).toBe(id === "cooldowns");
    }
  });

  it("the ⚙ beat points at settings without opening anything (the window is not a panel)", () => {
    expect(drives.settings).toEqual({ spotlight: "settings", panel: null, pinCooldowns: false });
  });

  it("the done beat drives everything closed, so finishing needs no extra cleanup", () => {
    expect(drives.done).toEqual({ spotlight: null, panel: null, pinCooldowns: false });
  });
});
