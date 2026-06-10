import type { RecurringRow } from "./useRecurring";

type Props = {
  /** The running elapsable items, projected with their live readouts (see `useRecurring`). */
  rows: RecurringRow[];
};

/**
 * The 👘 Items panel expanded below the dock bar: each elapsable item (pet, costume, mount)
 * with its live day-scale countdown, draining toward the moment it elapses. A `due` item reads
 * the sticky `overdue` in the loss colour. Read-only this slice (#36) — the refresh gesture and
 * the under-24h alarm land in a later slice; this just surfaces the countdowns.
 */
export function ElapsableAccordion({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="dock-acc">
        <div className="dock-acc__empty">no elapsable items yet</div>
      </div>
    );
  }
  return (
    <div className="dock-acc">
      {rows.map((row) => (
        <div className="dock-acc__row" key={row.defId}>
          <span className="dock-tag">{row.tag}</span>
          <span className="dock-acc__name">{row.name}</span>
          <span className={`dock-acc__val${row.due ? " dock-due" : ""}`}>{row.text}</span>
        </div>
      ))}
    </div>
  );
}
