import type { RecurringRow } from "./useRecurring";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  /** The deadline expiring items, projected with their live state (see `useRecurring`). */
  rows: RecurringRow[];
  /** Refresh ("feed" / re-project) an item — restamps a full cycle from now, or starts it if unstarted. */
  onRefresh: (defId: string) => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * The ⧗ Items panel expanded below the dock bar: each expiring item (pet, costume, mount) with
 * its live day-scale countdown draining toward the moment it elapses, and a ↻ refresh that restamps
 * a fresh cycle ("feed" the pet / re-project the costume) — which also starts an unstarted item.
 * A `due` item reads the sticky `overdue` loss colour; an item under 24h reads the red/blink alarm.
 */
export function ExpiringAccordion({ rows, onRefresh, locale }: Props) {
  if (rows.length === 0) {
    return (
      <div className="dock-acc">
        <div className="dock-acc__empty">{t("expiring.empty", locale)}</div>
      </div>
    );
  }
  return (
    <div className="dock-acc">
      {rows.map((row) => (
        <div className="dock-acc__row" key={row.defId}>
          {/* name flexes (via __main, like the routine rows) so the readout + ↻ sit at the right edge */}
          <span className="dock-acc__main">
            <span className="dock-acc__name">{row.name}</span>
          </span>
          <span className={`dock-acc__val${row.alarm ? " dock-alarm" : row.due ? " dock-due" : ""}`}>
            {row.text}
          </span>
          <button
            className="dock-acc__refresh"
            onClick={() => onRefresh(row.defId)}
            title={row.running ? t("expiring.refresh", locale) : t("expiring.start", locale)}
          >
            ↻
          </button>
        </div>
      ))}
    </div>
  );
}
