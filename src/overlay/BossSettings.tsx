import type { CSSProperties } from "react";
import type { Boss } from "../engine/config";

type Props = {
  boss: Boss;
  onBack: () => void;
  onRenameBoss: (name: string) => void;
  onDeleteBoss: () => void;
  onAddSkill: () => void;
  onRenameSkill: (skillId: string, label: string) => void;
  onSetDuration: (skillId: string, durationMs: number) => void;
  onRemoveSkill: (skillId: string) => void;
};

/**
 * Per-boss settings: rename or delete the boss, and edit its skills (rename, set
 * duration in whole seconds, remove, add). Durations are stored in ms; the input
 * shows/edits seconds. Hotkeys are intentionally absent — that's slice #6.
 */
export function BossSettings({
  boss,
  onBack,
  onRenameBoss,
  onDeleteBoss,
  onAddSkill,
  onRenameSkill,
  onSetDuration,
  onRemoveSkill,
}: Props) {
  return (
    <div className="panel boss-settings" style={{ "--accent": boss.accent } as CSSProperties}>
      <div className="settings-head">
        <button className="icon-btn" onClick={onBack} title="back">
          ←
        </button>
        <input
          className="boss-name-input"
          value={boss.name}
          onChange={(e) => onRenameBoss(e.target.value)}
          placeholder="boss name"
        />
        <button className="icon-btn icon-btn--danger" onClick={onDeleteBoss} title="delete boss">
          🗑
        </button>
      </div>

      <div className="skill-head">
        <span className="skill-head__name">SKILL</span>
        <span className="skill-head__sec">SEC</span>
        <span className="skill-head__x" />
      </div>

      {boss.skills.map((s) => (
        <div className="skill-row" key={s.id}>
          <input
            className="skill-name"
            value={s.label}
            onChange={(e) => onRenameSkill(s.id, e.target.value)}
            placeholder="name"
          />
          <input
            className="skill-sec"
            type="number"
            min={1}
            max={999}
            value={Math.round(s.durationMs / 1000)}
            onChange={(e) => onSetDuration(s.id, Number(e.target.value) * 1000)}
            title="duration (seconds)"
          />
          <button className="icon-btn icon-btn--danger" onClick={() => onRemoveSkill(s.id)} title="remove skill">
            ✕
          </button>
        </div>
      ))}
      {boss.skills.length === 0 && <div className="empty">no skills yet</div>}

      <button className="btn-dashed" onClick={onAddSkill}>
        + ADD SKILL
      </button>
    </div>
  );
}
