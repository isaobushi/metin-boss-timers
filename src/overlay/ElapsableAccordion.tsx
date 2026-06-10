import type { RecurringRow } from "./useRecurring";

type Props = {
  /** The deadline elapsable items, projected with their live state (see `useRecurring`). */
  rows: RecurringRow[];
  /** Refresh ("feed" / re-project) an item — restamps a full cycle from now, or starts it if unstarted. */
  onRefresh: (defId: string) => void;
};

/**
 * The 👘 Items panel expanded below the dock bar: each elapsable item (pet, costume, mount) with
 * its live day-scale countdown draining toward the moment it elapses, and a ↻ refresh that restamps
 * a fresh cycle ("feed" the pet / re-project the costume) — which also starts an unstarted item.
 * A `due` item reads the sticky `overdue` loss colour; an item under 24h reads the red/blink alarm.
 */
export function ElapsableAccordion({ rows, onRefresh }: Props) {
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
          <span className={`dock-acc__val${row.alarm ? " dock-alarm" : row.due ? " dock-due" : ""}`}>
            {row.text}
          </span>
          <button
            className="dock-acc__refresh"
            onClick={() => onRefresh(row.defId)}
            title={row.running ? "refresh — restamp a full cycle from now" : "start — stamp a full cycle from now"}
          >
            ↻
          </button>
        </div>
      ))}
    </div>
  );
}
