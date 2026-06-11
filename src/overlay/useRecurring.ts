import { useCallback, useEffect, useRef } from "react";
import { badge, readout } from "../engine/cooldown";
import {
  alarmCrossings,
  inAlarm,
  isDue,
  ladderProgress,
  ladderText,
  positionOf,
  readyCrossings,
  remainingMs,
  routineSection,
  routineToDo,
  type RoutineSection,
  type RunningRecurring,
} from "../engine/recurring";
import { activeCharacter, activeRecurring, activeRecurringProgress, activeRecurringRunning } from "../engine/config";
import { displayName, resolveDisplayName } from "../engine/contentCatalog";
import { buildKey } from "../engine/contentKeys";
import { playCooldownReady } from "./audio";
import { useNow } from "./useNow";
import type { useConfig } from "./useConfig";

/** A deadline expiring item projected for the Items accordion: identity, label, live state. */
export type RecurringRow = {
  defId: string;
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

/** The ♻ bar segment's most-urgent datum: the soonest running item's compact badge, or null. */
export type RecurringDatum = { text: string; due: boolean; alarm: boolean } | null;

/** A gate routine item projected for the ✓ Routine accordion: identity, label, live state. */
export type RoutineRow = {
  defId: string;
  name: string;
  /** Live readout: `ready` when do-able now, else the countdown until it next comes due (`3h00`). */
  text: string;
  /** Do-able now — `isDue`, or never started. Drives the highlighted "ready" styling + done button. */
  ready: boolean;
  /** Has a running instance (done-for-now / on its rolling cooldown) — false when never done. */
  running: boolean;
  /** Which band of the panel this gate belongs to (#57): race Abilities, Languages, or universal chores. */
  section: RoutineSection;
  /** The class school (Build tree) this Ability belongs to — set only on `books` rows; bands the Skill Books (#57). */
  school?: string;
  /**
   * The ladder rank layer (#44/#46), present only on a def carrying a `ladderId`. `text` is the
   * formatted rung readout (`M3 · 2→M4`, or `Stage 5/10 · …`, or the `… ✓ max` trophy); `capped`
   * marks the inert end state; `ladderId` + `rungLabel` (the current rung) scope the set-rung
   * curtain. A plain gate has no `ladder` — it keeps its single ✓ and permissive done-early.
   */
  ladder?: { text: string; capped: boolean; ladderId: string; rungLabel: string };
};

/**
 * The ✓ bar segment's nudge: how many gate routines are `ready` (need doing now) of the total. A
 * to-do count, not a completion meter — it reads `ready` so the bar shows what's left to do and
 * goes calm when you're caught up, rather than sitting "full" once everything's done.
 */
export type RoutineDatum = { ready: number; total: number };

/**
 * The recurring-chore control layer for the overlay — both tools (#37 deadline write path, #38
 * gate routine). Like `useCooldowns` it rides the shared 1-second app-level tick (`useNow`) over
 * the persisted recurring catalog + running set, re-deriving each item's readout every second. It
 * surfaces **both** kinds: the ♻ **expiring items** (`deadline`) as `rows`/`datum`, and the ✓
 * **routine** (`gate`) as `routineRows`/`routineDatum`.
 *
 * The completion gesture is a single `markRecurringDone` restamp — a full-cycle stamp from now,
 * which also serves as the start gesture for an unstarted item (so each accordion lists every def
 * of its kind, started or not). It is surfaced as `refresh` (↻ "feed"/re-project, deadlines) and
 * `markDone` (✓, routines); same transform, names that read right per tool. One instance per def.
 *
 * Best-effort cue (ADR-0002 / ADR-0003 §3), split by kind: each observation of the running set is
 * compared against the previous one, chiming on any *live* crossing — a `deadline` into the
 * under-24h alarm window (`alarmCrossings`), a `gate` into ready at the zero boundary
 * (`readyCrossings`) — reusing the cooldown-ready sound. The ref seeds with the mount snapshot, so
 * an item already crossed on restore has no prior outside tick and stays silent; both detectors key
 * on running-instance identity, so a sitting state never re-fires and a mark-done re-arms.
 */
export function useRecurring(cfg: ReturnType<typeof useConfig>) {
  const now = useNow(); // the shared 1s app-level tick (overlay/useNow)
  const { config, markRecurringDone, markReadOutcome, setLadderRung } = cfg;
  const locale = config.locale; // live locale from persisted config (slice #83)
  // The recurring side belongs to the ACTIVE character now (#47): read its slices, not the (gone)
  // top-level Config fields. Everything downstream is unchanged — it's the same shapes, re-scoped.
  const catalog = activeRecurring(config);
  // The active character's race prefixes the Skill Books school sub-headers (#57: "Sura - Black Magic").
  // Undefined on an unclassified character — which also has no school'd abilities, so no sub-header shows.
  const activeRace = activeCharacter(config)?.race;
  const running = activeRecurringRunning(config);
  const progress = activeRecurringProgress(config);

  // Live-only cue, split by kind (ADR-0003 §3): a `deadline` chimes on the crossing INTO the
  // under-24h alarm window (`alarmCrossings`), a `gate` on the ZERO crossing into ready
  // (`readyCrossings`). The running set is partitioned by the def's kind first, so a gate item
  // draining under 24h doesn't trip the deadline alarm. Watching `running` (not just `now`)
  // means a mark-done can't sneak a phantom crossing past the comparison (mirrors useCooldowns).
  const prevObs = useRef<{ running: RunningRecurring[]; now: number }>({ running, now });
  useEffect(() => {
    const prev = prevObs.current;
    const ofKind = (rs: RunningRecurring[], kind: "deadline" | "gate") => {
      const ids = new Set(catalog.filter((d) => d.kind === kind).map((d) => d.id));
      return rs.filter((r) => ids.has(r.defId));
    };
    const crossed =
      alarmCrossings(ofKind(prev.running, "deadline"), prev.now, ofKind(running, "deadline"), now).length > 0 ||
      readyCrossings(ofKind(prev.running, "gate"), prev.now, ofKind(running, "gate"), now).length > 0;
    if (crossed) playCooldownReady();
    prevObs.current = { running, now };
  }, [now, running, catalog]);

  // Every deadline def projected in catalog order, joined with its running instance (if any).
  const items = catalog
    .filter((def) => def.kind === "deadline")
    .map((def) => {
      const r = running.find((x) => x.defId === def.id);
      const rem = r ? remainingMs(r, now) : null;
      return {
        defId: def.id,
        // Seeded items resolve per-locale (PRD #77, slice #83 wires up the live locale); user-added verbatim.
        name: resolveDisplayName(def, locale),
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

  const rows: RecurringRow[] = items.map(({ defId, name, rem, due, alarm }) => ({
    defId,
    name,
    text: rem == null ? "—" : due ? "overdue" : readout(rem),
    running: rem != null,
    due,
    alarm,
  }));

  // ---- the ✓ Routine tool (gate kind, #38) ----
  // Every gate def projected in catalog order, joined with its running instance. A gate reads the
  // opposite valence to a deadline: `isDue` is "ready" (do it now), not "overdue". An unstarted def
  // (never done) also reads ready. A satisfied item (running, not yet due) shows the countdown until
  // it rolls back into ready.
  const gateDefs = catalog.filter((def) => def.kind === "gate");
  const routineRows: RoutineRow[] = gateDefs.map((def) => {
    const r = running.find((x) => x.defId === def.id);
    const ready = r ? isDue(r, now) : true; // unstarted → ready (never done)
    // Ladder layer (#44): a def carrying a `ladderId` gets the rung readout projected onto the row;
    // `ladderProgress` returns null for a plain gate, so `ladder` stays undefined and the row reads
    // exactly as before. Rank lives in the parallel `recurringProgress` map, independent of the gate.
    const pos = positionOf(progress, def.id);
    const lp = ladderProgress(def.ladderId, pos);
    return {
      defId: def.id,
      // Seeded chores/Abilities resolve per-locale (PRD #77, slice #83 wires up the live locale); user-added verbatim.
      name: resolveDisplayName(def, locale),
      text: ready ? "ready" : readout(remainingMs(r!, now)),
      ready,
      running: r != null,
      section: routineSection(def.ladderId),
      // The school band label is a Build (school) name — resolved per-locale through its content key.
      ...(def.school ? { school: displayName(buildKey(def.school), locale) } : {}),
      ...(lp
        ? {
            ladder: {
              // Biologist consignment item names inside the readout resolve per-locale too.
              text: ladderText(def.ladderId, pos, (k) => displayName(k, locale))!,
              capped: lp.capped,
              ladderId: def.ladderId!,
              rungLabel: lp.rungLabel,
            },
          }
        : {}),
    };
  });

  // The ✓ bar nudge — how many gate routines still need doing, of the total. A capped ladder def is
  // a finished trophy, not an outstanding to-do, so `routineToDo` drops it from the count entirely
  // (#45) — otherwise the bar would sit forever nudging a ladder you've maxed.
  const routineDatum: RoutineDatum = routineToDo(running, gateDefs, progress, now);

  // Both gestures are the one `markDone` restamp: ↻ "feed/re-project" for deadlines, ✓ "mark done"
  // for routines. Same transform, surfaced under names that read right for each tool.
  const markDone = useCallback((defId: string) => markRecurringDone(defId, Date.now()), [markRecurringDone]);
  // The ladder read-outcome gesture (#45): ✓ advances the rank + restamps the gate, ✗ restamps only.
  const markRead = useCallback(
    (defId: string, success: boolean) => markReadOutcome(defId, Date.now(), success),
    [markReadOutcome],
  );
  // The set-rung curtain (#46): snap a def's rank to a chosen rung; gate untouched (no Date.now()).
  const setRung = useCallback((defId: string, rungLabel: string) => setLadderRung(defId, rungLabel), [setLadderRung]);

  return { rows, datum, refresh: markDone, routineRows, routineDatum, activeRace, markDone, markRead, setRung };
}
