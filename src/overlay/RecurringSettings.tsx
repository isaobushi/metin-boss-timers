import type { RecurringDef, RecurringKind } from "../engine/recurring";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  recurring: RecurringDef[];
  /** Which flavour this section edits — `deadline` (EXPIRING ITEMS) or `gate` (ROUTINE). */
  kind: RecurringKind;
  onAdd: () => void;
  onRename: (defId: string, name: string) => void;
  onSetDuration: (defId: string, durationMs: number) => void;
  onRemove: (defId: string) => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * The recurring-catalog editor (issue #37/#38) — the day-scale sibling of `CooldownSettings`,
 * rendered once per kind: an EXPIRING ITEMS section over the `deadline` definitions (pet, costume,
 * mount) and a ROUTINE section over the `gate` ones (biologist, book reading). Each row renames the
 * definition, edits the duration, or removes the entry; the footer adds a blank one of this
 * section's kind. `kind` only selects which definitions show and what a new one is — the row
 * editing is identical for both. Unlike `CooldownSettings` there is no Tag column: recurring items
 * show their full name in the accordion, so there's nothing to abbreviate.
 *
 * Duration is edited on a DAYS / HOURS / MINUTES control — the cooldown editor's h/m control
 * extended with a days field, because these chores run hours to weeks. The three number inputs
 * are split out of the stored ms and recombined on edit; the engine clamps the result to the
 * day-scale [1m, 365d] band (overlay/useConfig → setRecurringDuration), so an empty/zero entry
 * snaps back to 1 minute.
 */
export function RecurringSettings({
  recurring,
  kind,
  onAdd,
  onRename,
  onSetDuration,
  onRemove,
  locale,
}: Props) {
  const items = recurring.filter((d) => d.kind === kind);
  const title = kind === "deadline" ? t("recurring.titleItems", locale) : t("recurring.titleRoutine", locale);
  const addLabel = kind === "deadline" ? t("recurring.addItem", locale) : t("recurring.addRoutine", locale);
  const emptyLabel = kind === "deadline" ? t("recurring.noItems", locale) : t("recurring.noRoutine", locale);
  return (
    <div className="panel cooldown-settings">
      <div className="settings-head">
        <span className="cooldown-settings__title">{title}</span>
      </div>

      <div className="cd-head">
        <span className="cd-head__name">{t("recurring.colName", locale)}</span>
        <span className="cd-head__dur">{t("recurring.colDuration", locale)}</span>
        <span className="cd-head__x" />
      </div>

      {items.map((d) => {
        const days = Math.floor(d.durationMs / MS_PER_DAY);
        const h = Math.floor((d.durationMs % MS_PER_DAY) / MS_PER_HOUR);
        const m = Math.round((d.durationMs % MS_PER_HOUR) / MS_PER_MIN);
        const setDHM = (dd: number, hh: number, mm: number) =>
          onSetDuration(d.id, dd * MS_PER_DAY + hh * MS_PER_HOUR + mm * MS_PER_MIN);
        return (
          <div className="cd-row" key={d.id}>
            <input
              className="cd-name"
              value={d.name}
              onChange={(e) => onRename(d.id, e.target.value)}
              placeholder={t("recurring.namePlaceholder", locale)}
            />
            <div className="cd-dur" title={t("recurring.durationTitle", locale)}>
              <input
                className="cd-dur__n"
                type="number"
                min={0}
                max={365}
                value={days}
                onChange={(e) => setDHM(Number(e.target.value), h, m)}
              />
              <span className="cd-dur__u">d</span>
              <input
                className="cd-dur__n"
                type="number"
                min={0}
                max={23}
                value={h}
                onChange={(e) => setDHM(days, Number(e.target.value), m)}
              />
              <span className="cd-dur__u">h</span>
              <input
                className="cd-dur__n"
                type="number"
                min={0}
                max={59}
                value={m}
                onChange={(e) => setDHM(days, h, Number(e.target.value))}
              />
              <span className="cd-dur__u">m</span>
            </div>
            <button className="icon-btn icon-btn--danger" onClick={() => onRemove(d.id)} title={t("recurring.removeItem", locale)}>
              ✕
            </button>
          </div>
        );
      })}
      {items.length === 0 && <div className="empty">{emptyLabel}</div>}

      <button className="btn-dashed" onClick={onAdd}>
        {addLabel}
      </button>
    </div>
  );
}
