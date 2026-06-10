import type { RecurringDef, RecurringKind } from "../engine/recurring";

type Props = {
  recurring: RecurringDef[];
  /** Which flavour this section edits — `deadline` (ELAPSABLE ITEMS) or `gate` (ROUTINE). */
  kind: RecurringKind;
  /** Section heading and the "+ add" footer label, so the two sections read distinctly. */
  title: string;
  addLabel: string;
  emptyLabel: string;
  onAdd: () => void;
  onRename: (defId: string, name: string) => void;
  onRetag: (defId: string, tag: string) => void;
  onSetDuration: (defId: string, durationMs: number) => void;
  onRemove: (defId: string) => void;
};

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * The recurring-catalog editor (issue #37/#38) — the day-scale sibling of `CooldownSettings`,
 * rendered once per kind: an ELAPSABLE ITEMS section over the `deadline` definitions (pet, costume,
 * mount) and a ROUTINE section over the `gate` ones (biologist, daily books). Each row renames the
 * definition (re-deriving its short Tag), overrides that Tag, edits the duration, or removes the
 * entry; the footer adds a blank one of this section's kind. `kind` only selects which definitions
 * show and what a new one is — the row editing is identical for both.
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
  title,
  addLabel,
  emptyLabel,
  onAdd,
  onRename,
  onRetag,
  onSetDuration,
  onRemove,
}: Props) {
  const items = recurring.filter((d) => d.kind === kind);
  return (
    <div className="panel cooldown-settings">
      <div className="settings-head">
        <span className="cooldown-settings__title">{title}</span>
      </div>

      <div className="cd-head">
        <span className="cd-head__name">NAME</span>
        <span className="cd-head__tag">TAG</span>
        <span className="cd-head__dur">DURATION</span>
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
              placeholder="name"
            />
            <input
              className="cd-tag"
              value={d.tag}
              onChange={(e) => onRetag(d.id, e.target.value)}
              placeholder="tag"
              maxLength={6}
              title="short label shown on the bar (auto-derived from the name; editable)"
            />
            <div className="cd-dur" title="duration (days / hours / minutes)">
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
            <button className="icon-btn icon-btn--danger" onClick={() => onRemove(d.id)} title="remove item">
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
