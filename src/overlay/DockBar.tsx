import type { ReactNode } from "react";
import { CheckboxIcon, HourglassIcon } from "./icons";
import { tip, tipHint } from "./Tooltip";
import type { RecurringDatum, RoutineDatum } from "./useRecurring";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

/** Which tools' panels are open (for each segment's open-highlight). Cooldowns is a pinned strip,
 *  so it can read as open alongside one of the others (ADR-0003). */
export type DockSegment = "skills" | "cooldowns" | "items" | "routine";

/** The first-run tour's spotlight target (slice 3, #71): a superset of DockSegment, because ⚙ is a
 *  dock button the tour rings but not an openable segment. Mirrors tourSteps' `TourSegment` — the
 *  engine must not import overlay, so App's pass-through is where a divergence fails to compile. */
export type DockSpotlight = DockSegment | "settings" | null;

type Props = {
  /** The active-character chip + switcher, pinned at the bar's left (its dropdown escapes the bar). */
  leading?: ReactNode;
  /** The set of open tool groups, so each reads as active independently. Empty when only the bar shows. */
  open: ReadonlySet<DockSegment>;
  /** The glyph the tour's pulsing ring sits on (slice 3, #71); null/omitted = no spotlight. */
  spotlight?: DockSpotlight;
  /** Active boss's name, shown on the ⚔ segment when a boss is selected. */
  activeBossName?: string;
  /** ⧗ — the soonest expiring item's compact datum, shown inline on the bar (null = none running). */
  itemsDatum: RecurringDatum;
  /** ✓ — the routine to-do nudge: the count of routines that need doing now (calm when none). */
  routineDatum: RoutineDatum;
  /** ⚔ — toggle the skills panel (active boss's timers, or the dungeon picker). */
  onSkills: () => void;
  /** ⏱ — toggle the cooldown strip (pinned above the panel). */
  onCooldowns: () => void;
  /** ⧗ — toggle the expiring-items panel (live: countdowns + alarm + refresh, #37). */
  onItems: () => void;
  /** ✓ — toggle the routine panel (live: gate checklist + x/n counter, #38). */
  onRoutine: () => void;
  /** ⚙ — open the settings window (not a panel; doesn't change what's open below). */
  onSettings: () => void;
  /** ✕ — quit the app. The overlay is frameless (no OS titlebar), so this is the only way out. */
  onQuit: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * The overlay's home shell (ADR-0003): one dense status line that stays pinned on top. Clicking a
 * tool segment toggles that tool open — ⚔ surfaces the active boss's timers (or the dungeon
 * picker), ⏱ pins the cooldown strip above the panel, ⧗/✓ the two new tools; ⚙ opens the settings
 * window and ✕ quits (the frameless overlay has no OS titlebar, so this is the only way out). The
 * cooldown strip coexists with the boss timers, so more than one segment can read open
 * at once. ⏱ is icon-only — multiple cooldowns can run, so no single inline readout would be
 * honest. A leading ⠿ grip carries the window drag region; the clickable segments sit outside it so
 * a tap never starts a drag.
 */
export function DockBar({ leading, open, spotlight = null, activeBossName, itemsDatum, routineDatum, onSkills, onCooldowns, onItems, onRoutine, onSettings, onQuit, locale }: Props) {
  // The ✓ segment is a to-do nudge: show the count of routines that need doing now, green, and fall
  // back to just the calm ✓ icon (no number) when you're all caught up — so it never sits at "n/n".
  const routineToDo = routineDatum.ready;
  // The tour's ring class per glyph — independent of `is-open` (a beat can ring ⚙, which never opens).
  const spot = (seg: Exclude<DockSpotlight, null>) => (spotlight === seg ? " is-spotlit" : "");
  return (
    <div className="dock-bar">
      {/* drag handle — grab the grip to move the frameless overlay */}
      <span className="dock-grip" data-tauri-drag-region {...tipHint(t("dock.drag", locale))}>
        ⠿
      </span>

      {leading}

      <button className={`dock-seg${open.has("skills") ? " is-open" : ""}${spot("skills")}`} onClick={onSkills} {...tipHint(t("dock.skills", locale))}>
        <span className="dock-seg__icon">⚔</span>
        <span className="dock-seg__label">{t("settings.tabDungeons", locale)}</span>
        {activeBossName && <span className="dock-seg__val dock-seg__name">{activeBossName.toUpperCase()}</span>}
      </button>

      <button
        className={`dock-seg${open.has("cooldowns") ? " is-open" : ""}${spot("cooldowns")}`}
        onClick={onCooldowns}
        {...tipHint(t("dock.cooldowns", locale))}
      >
        <span className="dock-seg__icon">⏱</span>
        <span className="dock-seg__label">{t("settings.tabCooldowns", locale)}</span>
      </button>

      <button className={`dock-seg${open.has("items") ? " is-open" : ""}${spot("items")}`} onClick={onItems} {...tipHint(t("dock.expiring", locale))}>
        <span className="dock-seg__icon"><HourglassIcon /></span>
        <span className="dock-seg__label">{t("settings.tabItems", locale)}</span>
        {itemsDatum ? (
          <span className={`dock-seg__val${itemsDatum.alarm ? " dock-alarm" : itemsDatum.due ? " dock-due" : ""}`}>
            {itemsDatum.text}
          </span>
        ) : (
          <span className="dock-seg__val dock-muted">—</span>
        )}
      </button>

      <button className={`dock-seg${open.has("routine") ? " is-open" : ""}${spot("routine")}`} onClick={onRoutine} {...tipHint(t("dock.routine", locale))}>
        <span className="dock-seg__icon"><CheckboxIcon /></span>
        <span className="dock-seg__label">{t("settings.tabRoutine", locale)}</span>
        {routineToDo > 0 && <span className="dock-seg__val dock-ready">{routineToDo}</span>}
      </button>

      <button className={`dock-seg${spot("settings")}`} onClick={onSettings} {...tip(t("dock.settings", locale))}>
        <span className="dock-seg__icon">⚙</span>
      </button>

      <button className="dock-seg dock-seg--danger" onClick={onQuit} {...tip(t("dock.quit", locale))}>
        <span className="dock-seg__icon">✕</span>
      </button>
    </div>
  );
}
