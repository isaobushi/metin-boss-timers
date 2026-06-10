import { useEffect } from "react";
import { badge, readout } from "../engine/cooldown";
import { isDue, remainingMs } from "../engine/recurring";
import { useNow } from "./useNow";
import type { useConfig } from "./useConfig";

/** A running elapsable item projected for the Items accordion: identity, label, live readout. */
export type RecurringRow = {
  defId: string;
  tag: string;
  name: string;
  /** Live readout: the day-scale countdown (`2d 06h`), or the sticky `overdue` once elapsed. */
  text: string;
  /** Past its expiry — a deadline item reads as `overdue` (and styles as a loss). */
  due: boolean;
};

/** The 👘 bar segment's most-urgent datum: the soonest item's compact badge, or null if none. */
export type RecurringDatum = { text: string; due: boolean } | null;

/**
 * The recurring-chore control layer for the overlay (read path, #36). Like `useCooldowns` it
 * adds the shared 1-second app-level tick (`useNow`) over the persisted recurring catalog +
 * running set, re-deriving each item's readout every second. This slice surfaces the
 * **elapsable items** (`kind: 'deadline'`) only — the routine (`gate`) accordion lands later.
 *
 * Read-path demo seed: until the add/start gesture ships (#3), there is no way to start a
 * recurring item, so any catalog def with no running instance is auto-started once on hydrate
 * (markDone restamps a full cycle) — giving the accordion live countdowns to show. Gated on
 * hydration so the persisted running set loads first and we never stamp over a restored item.
 */
export function useRecurring(cfg: ReturnType<typeof useConfig>) {
  const now = useNow();
  const { config, hydrated, markRecurringDone } = cfg;
  const catalog = config.recurring;
  const running = config.recurringRunning;

  useEffect(() => {
    if (!hydrated) return; // wait for the persisted running set before seeding the demo
    for (const def of catalog) {
      if (!running.some((r) => r.defId === def.id)) markRecurringDone(def.id, Date.now());
    }
  }, [hydrated, catalog, running, markRecurringDone]);

  // The elapsable items (deadline kind) projected in catalog order, each with its live readout.
  const items = catalog
    .filter((def) => def.kind === "deadline")
    .map((def) => {
      const r = running.find((x) => x.defId === def.id);
      if (!r) return null; // unstarted (only briefly, before the seed effect runs)
      const rem = remainingMs(r, now);
      const due = isDue(r, now);
      return { defId: def.id, tag: def.tag, name: def.name, rem, due };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // The soonest item drives the bar (the most urgent loss is always visible at a glance).
  const soonest = items.reduce<(typeof items)[number] | null>(
    (a, b) => (a && a.rem <= b.rem ? a : b),
    null,
  );
  const datum: RecurringDatum = soonest
    ? { text: soonest.due ? "due" : badge(soonest.rem), due: soonest.due }
    : null;

  const rows: RecurringRow[] = items.map(({ defId, tag, name, rem, due }) => ({
    defId,
    tag,
    name,
    text: due ? "overdue" : readout(rem),
    due,
  }));

  return { rows, datum };
}
