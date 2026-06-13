// The declarative registry for the first-run tour (PRD #63, slice #70): one entry per beat,
// ordered left-to-right across the dock so the slice-3 spotlight travels predictably. This module
// owns WHAT the tour shows (which glyph, which panel, which copy); tourMachine.ts owns WHERE the
// user stands in it, and config.ts's gate owns WHETHER it fires at all. Copy lives in chrome.ts
// (per-locale) — a step carries only the keys, so the card resolves them like any other chrome.

import type { ChromeKey } from "./chrome";
import type { SettingsTab } from "./settingsLink";

/**
 * The dock glyph a beat talks about — the slice-3 (#71) spotlight target. A superset of the
 * overlay's `DockSegment` (⚙ settings is a dock button but not an openable segment); null = the
 * beat addresses the dock as a whole (welcome / dock-framing / done).
 */
export type TourSegment = "skills" | "cooldowns" | "items" | "routine" | "settings" | null;

export type TourStepId =
  | "welcome"
  | "dock"
  | "character"
  | "skills"
  | "cooldowns"
  | "items"
  | "routine"
  | "settings"
  | "done";

export type TourStep = {
  id: TourStepId;
  /** Spotlight target for slice 3 (#71); null = no single glyph to point at. */
  dockSegment: TourSegment;
  /**
   * The exclusive panel slice 3 opens while the beat shows (mirrors App's `Panel` ids); null =
   * leave the slot to the card alone. Cooldowns is null on purpose — its tool is the *pinned
   * strip*, a sibling of the slot, so slice 3 pins that instead of opening a panel.
   */
  panelToOpen: "skills" | "items" | "routine" | null;
  copy: { title: ChromeKey; body: ChromeKey };
  /**
   * The settings tab the beat's "make it yours" nudge opens (slice 4, #72); null = no nudge
   * (the framing beats have nothing to customize). The ⚙ beat lands on the default tab — its
   * nudge IS the generic "go see settings", pointed without the tour entering the window.
   */
  settingsDeepLink: SettingsTab | null;
};

/**
 * The 9 beats: Welcome → the dock itself → your character (the wizard, embedded — see
 * `tourStepsFor`) → then the tools in dock order (⚔ ⏱ ⧗ ✓ ⚙) → Done. The ⚙ beat points at
 * settings without entering it; the Done beat tells the user the tour can be replayed from
 * settings (the replay row itself is slice 5, #73).
 */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: "welcome",   dockSegment: null,        panelToOpen: null,      copy: { title: "tour.welcomeTitle",   body: "tour.welcomeBody" },   settingsDeepLink: null },
  { id: "dock",      dockSegment: null,        panelToOpen: null,      copy: { title: "tour.dockTitle",      body: "tour.dockBody" },      settingsDeepLink: null },
  { id: "character", dockSegment: null,        panelToOpen: null,      copy: { title: "tour.characterTitle", body: "tour.characterBody" }, settingsDeepLink: null },
  { id: "skills",    dockSegment: "skills",    panelToOpen: "skills",  copy: { title: "tour.skillsTitle",    body: "tour.skillsBody" },    settingsDeepLink: "dungeons" },
  { id: "cooldowns", dockSegment: "cooldowns", panelToOpen: null,      copy: { title: "tour.cooldownsTitle", body: "tour.cooldownsBody" }, settingsDeepLink: "cooldowns" },
  { id: "items",     dockSegment: "items",     panelToOpen: "items",   copy: { title: "tour.itemsTitle",     body: "tour.itemsBody" },     settingsDeepLink: "items" },
  { id: "routine",   dockSegment: "routine",   panelToOpen: "routine", copy: { title: "tour.routineTitle",   body: "tour.routineBody" },   settingsDeepLink: "routine" },
  { id: "settings",  dockSegment: "settings",  panelToOpen: null,      copy: { title: "tour.settingsTitle",  body: "tour.settingsBody" },  settingsDeepLink: "dungeons" },
  { id: "done",      dockSegment: null,        panelToOpen: null,      copy: { title: "tour.doneTitle",      body: "tour.doneBody" },      settingsDeepLink: null },
];

/**
 * The beats a given run actually plays. The character beat exists to get the character DETAILS
 * in — on first run that means classifying the seeded "Main" (rename + empire/race/build; the
 * card embeds the ✎ wizard and gates Next on the save), or minting the first character outright
 * when the roster is somehow empty. A run that starts with the active character already
 * classified (a #73 replay, typically) drops the beat: the tour must never re-ask for details
 * it already has. Callers freeze the result at card mount: the beat saving its details mid-run
 * flips `characterClassified`, and a live re-filter would yank the beat out from under the card.
 */
export function tourStepsFor(characterClassified: boolean): readonly TourStep[] {
  return characterClassified ? TOUR_STEPS.filter((s) => s.id !== "character") : TOUR_STEPS;
}
