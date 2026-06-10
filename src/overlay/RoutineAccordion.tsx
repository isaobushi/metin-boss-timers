import type { RoutineRow } from "./useRecurring";

type Props = {
  /** The gate routine items, projected with their live state (see `useRecurring`). */
  rows: RoutineRow[];
  /** Mark a routine done — restamps a full cycle from now (also starts an unstarted one). */
  onDone: (defId: string) => void;
};

/**
 * The ✓ Routine panel expanded below the dock bar (#38): the standing checklist of `gate` chores
 * (biologist hand-in, daily book reading). Each row reads **ready** when it is do-able now (the
 * rolling clock has rolled over, or it was never done) — highlighted, with a ✓ to mark it done —
 * or the live countdown until it next becomes do-able once satisfied. Marking done restamps the
 * rolling cycle, moving the item out of the ready set until it comes due again.
 *
 * A row carrying a ladder (#44) also shows its rung readout (`M3 · 2→M4`, or the `… ✓ max` trophy)
 * beneath the name — read-only for now; the ✓/✗ read-outcome gesture and the set-rung curtain land
 * in #45/#46.
 */
export function RoutineAccordion({ rows, onDone }: Props) {
  if (rows.length === 0) {
    return (
      <div className="dock-acc">
        <div className="dock-acc__empty">no routine items yet</div>
      </div>
    );
  }
  return (
    <div className="dock-acc">
      {rows.map((row) => (
        <div className={`dock-acc__row${row.ready ? " is-ready" : " is-done"}`} key={row.defId}>
          <span className="dock-acc__main">
            <span className="dock-acc__name">{row.name}</span>
            {row.ladder && <span className="dock-acc__ladder">{row.ladder.text}</span>}
          </span>
          <span className={`dock-acc__val${row.ready ? " dock-ready" : " dock-muted"}`}>{row.text}</span>
          <button
            className="dock-acc__done"
            onClick={() => onDone(row.defId)}
            title={row.ready ? "mark done — restamp a full cycle from now" : "done early — restamp from now (forfeits the wait)"}
          >
            ✓
          </button>
        </div>
      ))}
    </div>
  );
}
