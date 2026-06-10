import { useCallback, useEffect, useRef } from "react";
import { badge, readout } from "../engine/cooldown";
import { alarmCrossings, inAlarm, isDue, remainingMs, type RunningRecurring } from "../engine/recurring";
import { playCooldownReady } from "./audio";
import { useNow } from "./useNow";
import type { useConfig } from "./useConfig";

/** A deadline elapsable item projected for the Items accordion: identity, label, live state. */
export type RecurringRow = {
  defId: string;
  tag: string;
  name: string;
  /** Live readout: the day-scale countdown (`2d 06h`), `overdue` once elapsed, or `—` if unstarted. */
  text: string;
  /** Whether an instance is running — drives the refresh affordance's "feed" vs "start" sense. */
  running: boolean;
  /** Past its expiry — reads as `overdue` and styles as a loss. */
  due: boolean;
  /** Under 24h to elapse (and not yet due) — the red/blink "act now" alarm. */
  alarm: boolean;
};

/** The 👘 bar segment's most-urgent datum: the soonest running item's compact badge, or null. */
export type RecurringDatum = { text: string; due: boolean; alarm: boolean } | null;

/**
 * The recurring-chore control layer for the overlay (deadline write path, #37). Like
 * `useCooldowns` it rides the shared 1-second app-level tick (`useNow`) over the persisted
 * recurring catalog + running set, re-deriving each item's readout every second. This slice
 * surfaces the **elapsable items** (`kind: 'deadline'`) only — the routine (`gate`) accordion
 * lands later.
 *
 * The refresh gesture ("feed" the pet / re-project a costume) is `markRecurringDone` — a full-
 * cycle restamp from now, which doubles as the start gesture for an unstarted item (so the
 * accordion lists every deadline def, started or not, each with a ↻ affordance). One running
 * instance per def.
 *
 * Best-effort alarm cue (ADR-0002 / ADR-0003 §3): each observation of the running set is
 * compared against the previous one, chiming on any *live* crossing into the under-24h alarm
 * window — reusing the cooldown-ready sound. The ref seeds with the mount snapshot, so an item
 * already in-alarm (or already overdue) on restore has no prior outside tick and stays silent;
 * `alarmCrossings` keys on running-instance identity, so a sitting alarm never re-fires and a
 * refresh re-arms.
 */
export function useRecurring(cfg: ReturnType<typeof useConfig>) {
  const now = useNow(); // the shared 1s app-level tick (overlay/useNow)
  const { config, markRecurringDone } = cfg;
  const catalog = config.recurring;
  const running = config.recurringRunning;

  // Live-only alarm cue: chime on any crossing into the 24h window the running app watched.
  // Watching `running` too (not just `now`) means a refresh gesture can't sneak a phantom
  // crossing past the comparison (mirrors useCooldowns' ready-cue posture exactly).
  const prevObs = useRef<{ running: RunningRecurring[]; now: number }>({ running, now });
  useEffect(() => {
    const prev = prevObs.current;
    if (alarmCrossings(prev.running, prev.now, running, now).length > 0) playCooldownReady();
    prevObs.current = { running, now };
  }, [now, running]);

  // Every deadline def projected in catalog order, joined with its running instance (if any).
  const items = catalog
    .filter((def) => def.kind === "deadline")
    .map((def) => {
      const r = running.find((x) => x.defId === def.id);
      const rem = r ? remainingMs(r, now) : null;
      return {
        defId: def.id,
        tag: def.tag,
        name: def.name,
        rem,
        due: r ? isDue(r, now) : false,
        alarm: r ? inAlarm(r, now) : false,
      };
    });

  // The soonest *running* item drives the bar (the most urgent loss is always visible at a glance).
  const soonest = items.reduce<(typeof items)[number] | null>(
    (a, b) => (b.rem == null ? a : a && a.rem != null && a.rem <= b.rem ? a : b),
    null,
  );
  const datum: RecurringDatum =
    soonest && soonest.rem != null
      ? { text: soonest.due ? "due" : badge(soonest.rem), due: soonest.due, alarm: soonest.alarm }
      : null;

  const rows: RecurringRow[] = items.map(({ defId, tag, name, rem, due, alarm }) => ({
    defId,
    tag,
    name,
    text: rem == null ? "—" : due ? "overdue" : readout(rem),
    running: rem != null,
    due,
    alarm,
  }));

  const refresh = useCallback((defId: string) => markRecurringDone(defId, Date.now()), [markRecurringDone]);

  return { rows, datum, refresh };
}
