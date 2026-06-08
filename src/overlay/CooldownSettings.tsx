import type { CooldownDef } from "../engine/cooldown";

type Props = {
  cooldowns: CooldownDef[];
  onAdd: () => void;
  onRename: (defId: string, name: string) => void;
  onRetag: (defId: string, tag: string) => void;
  onSetDuration: (defId: string, durationMs: number) => void;
  onRemove: (defId: string) => void;
};

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;

/**
 * The cooldown-catalog editor — one panel listing every definition the user starts from,
 * mirroring the per-boss skill editor (overlay/BossSettings) so all configuration lives in
 * one settings window. Each row renames the definition (which re-derives its short Tag),
 * overrides that Tag, edits the duration, or removes the entry; the footer adds a blank one.
 *
 * Duration is edited on an HOURS/MINUTES control — deliberately NOT the seconds-scale skill
 * input — because dungeon cooldowns run minutes to hours. The two number inputs are split
 * out of the stored ms and recombined on edit; the engine clamps the result to [1m, 12h]
 * (overlay/useConfig → setCooldownDuration), so an empty/zero entry snaps back to 1 minute.
 */
export function CooldownSettings({ cooldowns, onAdd, onRename, onRetag, onSetDuration, onRemove }: Props) {
  return (
    <div className="panel cooldown-settings">
      <div className="settings-head">
        <span className="cooldown-settings__title">COOLDOWNS</span>
      </div>

      <div className="cd-head">
        <span className="cd-head__name">NAME</span>
        <span className="cd-head__tag">TAG</span>
        <span className="cd-head__dur">DURATION</span>
        <span className="cd-head__x" />
      </div>

      {cooldowns.map((d) => {
        const h = Math.floor(d.durationMs / MS_PER_HOUR);
        const m = Math.round((d.durationMs % MS_PER_HOUR) / MS_PER_MIN);
        const setHM = (hh: number, mm: number) => onSetDuration(d.id, hh * MS_PER_HOUR + mm * MS_PER_MIN);
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
              title="short label shown in the strip (auto-derived from the name; editable)"
            />
            <div className="cd-dur" title="duration (hours / minutes)">
              <input
                className="cd-dur__n"
                type="number"
                min={0}
                max={12}
                value={h}
                onChange={(e) => setHM(Number(e.target.value), m)}
              />
              <span className="cd-dur__u">h</span>
              <input
                className="cd-dur__n"
                type="number"
                min={0}
                max={59}
                value={m}
                onChange={(e) => setHM(h, Number(e.target.value))}
              />
              <span className="cd-dur__u">m</span>
            </div>
            <button className="icon-btn icon-btn--danger" onClick={() => onRemove(d.id)} title="remove cooldown">
              ✕
            </button>
          </div>
        );
      })}
      {cooldowns.length === 0 && <div className="empty">no cooldowns yet</div>}

      <button className="btn-dashed" onClick={onAdd}>
        + ADD COOLDOWN
      </button>
    </div>
  );
}
