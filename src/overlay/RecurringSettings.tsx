import type { RecurringDef } from "../engine/recurring";

type Props = {
  recurring: RecurringDef[];
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
 * The elapsable-items catalog editor (issue #37) — the day-scale sibling of `CooldownSettings`,
 * listing every deadline definition the user starts from (pet, costume, mount). Each row renames
 * the definition (re-deriving its short Tag), overrides that Tag, edits the duration, or removes
 * the entry; the footer adds a blank one.
 *
 * Duration is edited on a DAYS / HOURS / MINUTES control — the cooldown editor's h/m control
 * extended with a days field, because these chores run hours to weeks. The three number inputs
 * are split out of the stored ms and recombined on edit; the engine clamps the result to the
 * day-scale [1m, 365d] band (overlay/useConfig → setRecurringDuration), so an empty/zero entry
 * snaps back to 1 minute. Only `deadline` items show here; the routine (`gate`) editor is separate.
 */
export function RecurringSettings({ recurring, onAdd, onRename, onRetag, onSetDuration, onRemove }: Props) {
  const items = recurring.filter((d) => d.kind === "deadline");
  return (
    <div className="panel cooldown-settings">
      <div className="settings-head">
        <span className="cooldown-settings__title">ELAPSABLE ITEMS</span>
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
      {items.length === 0 && <div className="empty">no elapsable items yet</div>}

      <button className="btn-dashed" onClick={onAdd}>
        + ADD ITEM
      </button>
    </div>
  );
}
