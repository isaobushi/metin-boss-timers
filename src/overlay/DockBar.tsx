import type { RecurringDatum, RoutineDatum } from "./useRecurring";

/** Which tools' panels are open (for each segment's open-highlight). Cooldowns is a pinned strip,
 *  so it can read as open alongside one of the others (ADR-0003). */
export type DockSegment = "skills" | "cooldowns" | "items" | "routine";

type Props = {
  /** The set of open tool groups, so each reads as active independently. Empty when only the bar shows. */
  open: ReadonlySet<DockSegment>;
  /** Active boss's name, shown on the ⚔ segment when a boss is selected. */
  activeBossName?: string;
  /** 👘 — the soonest elapsable item's compact datum, shown inline on the bar (null = none running). */
  itemsDatum: RecurringDatum;
  /** ✓ — the routine done counter (`x/n`), shown inline on the bar; reads `ready` when any are do-able. */
  routineDatum: RoutineDatum;
  /** ⚔ — toggle the skills panel (active boss's timers, or the dungeon picker). */
  onSkills: () => void;
  /** ⏱ — toggle the cooldown strip (pinned above the panel). */
  onCooldowns: () => void;
  /** 👘 — toggle the elapsable-items panel (live: countdowns + alarm + refresh, #37). */
  onItems: () => void;
  /** ✓ — toggle the routine panel (live: gate checklist + x/n counter, #38). */
  onRoutine: () => void;
  /** ⚙ — open the settings window (not a panel; doesn't change what's open below). */
  onSettings: () => void;
  /** ✕ — quit the app. The overlay is frameless (no OS titlebar), so this is the only way out. */
  onQuit: () => void;
};

/**
 * The overlay's home shell (ADR-0003): one dense status line that stays pinned on top. Clicking a
 * tool segment toggles that tool open — ⚔ surfaces the active boss's timers (or the dungeon
 * picker), ⏱ pins the cooldown strip above the panel, 👘/✓ the two new tools; ⚙ opens the settings
 * window and ✕ quits (the frameless overlay has no OS titlebar, so this is the only way out). The
 * cooldown strip coexists with the boss timers, so more than one segment can read open
 * at once. ⏱ is icon-only — multiple cooldowns can run, so no single inline readout would be
 * honest. A leading ⠿ grip carries the window drag region; the clickable segments sit outside it so
 * a tap never starts a drag.
 */
export function DockBar({ open, activeBossName, itemsDatum, routineDatum, onSkills, onCooldowns, onItems, onRoutine, onSettings, onQuit }: Props) {
  // Any gate routine do-able now (done < total) reads the green "ready" cue on the counter.
  const routineReady = routineDatum.done < routineDatum.total;
  return (
    <div className="dock-bar">
      {/* drag handle — grab the grip to move the frameless overlay */}
      <span className="dock-grip" data-tauri-drag-region title="drag to move">
        ⠿
      </span>

      <button className={`dock-seg${open.has("skills") ? " is-open" : ""}`} onClick={onSkills} title="skills">
        <span className="dock-seg__icon">⚔</span>
        {activeBossName && <span className="dock-seg__val dock-seg__name">{activeBossName.toUpperCase()}</span>}
      </button>

      <button
        className={`dock-seg${open.has("cooldowns") ? " is-open" : ""}`}
        onClick={onCooldowns}
        title="dungeon cooldowns"
      >
        <span className="dock-seg__icon">⏱</span>
      </button>

      <button className={`dock-seg${open.has("items") ? " is-open" : ""}`} onClick={onItems} title="elapsable items">
        <span className="dock-seg__icon">👘</span>
        {itemsDatum ? (
          <span className={`dock-seg__val${itemsDatum.alarm ? " dock-alarm" : itemsDatum.due ? " dock-due" : ""}`}>
            {itemsDatum.text}
          </span>
        ) : (
          <span className="dock-seg__val dock-muted">—</span>
        )}
      </button>

      <button className={`dock-seg${open.has("routine") ? " is-open" : ""}`} onClick={onRoutine} title="routine">
        <span className="dock-seg__icon">✓</span>
        <span className={`dock-seg__val${routineReady ? " dock-ready" : " dock-muted"}`}>
          {routineDatum.done}/{routineDatum.total}
        </span>
      </button>

      <button className="dock-seg" onClick={onSettings} title="settings">
        <span className="dock-seg__icon">⚙</span>
      </button>

      <button className="dock-seg dock-seg--danger" onClick={onQuit} title="quit DungeonAid">
        <span className="dock-seg__icon">✕</span>
      </button>
    </div>
  );
}
