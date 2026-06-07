import { useEffect, useState, type CSSProperties } from "react";
import type { Boss } from "../engine/config";
import { eventToCombo, prettyCombo } from "../engine/hotkey";
import { inTextField } from "./hotkeys";

type Props = {
  boss: Boss;
  onRenameBoss: (name: string) => void;
  onDeleteBoss: () => void;
  onAddSkill: () => void;
  onRenameSkill: (skillId: string, label: string) => void;
  onSetDuration: (skillId: string, durationMs: number) => void;
  onSetHotkey: (skillId: string, hotkey: string | undefined) => void;
  onRemoveSkill: (skillId: string) => void;
};

/**
 * Per-boss settings: rename or delete the boss, and edit its skills (rename, set
 * duration in whole seconds, bind a hotkey, remove, add). Durations are stored in ms;
 * the input shows/edits seconds. The hotkey button is a minimal capture affordance —
 * click it, then press a combo to bind (Esc clears). The combo is stored canonical and
 * shown pretty. One block per boss makes up the settings window's editing surface
 * (overlay/SettingsApp).
 */
export function BossSettings({
  boss,
  onRenameBoss,
  onDeleteBoss,
  onAddSkill,
  onRenameSkill,
  onSetDuration,
  onSetHotkey,
  onRemoveSkill,
}: Props) {
  // While a skill is "capturing", the next keypress becomes its binding (Esc clears).
  const [capturing, setCapturing] = useState<string | null>(null);
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      if (inTextField()) return; // don't hijack typing in a focused field
      e.preventDefault();
      if (e.key === "Escape") {
        onSetHotkey(capturing, undefined);
        setCapturing(null);
        return;
      }
      const combo = eventToCombo(e);
      if (!combo) return; // modifier-only so far — keep waiting for the real key
      onSetHotkey(capturing, combo);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capturing, onSetHotkey]);

  return (
    <div className="panel boss-settings" style={{ "--accent": boss.accent } as CSSProperties}>
      <div className="settings-head">
        <span className="boss-accent-dot" style={{ background: boss.accent }} />
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
        <span className="skill-head__key">HOTKEY</span>
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
          <button
            className={`skill-key${capturing === s.id ? " skill-key--capturing" : ""}`}
            onClick={() => setCapturing(capturing === s.id ? null : s.id)}
            title="hotkey to reset this timer — click, then press a key (Esc clears)"
          >
            {capturing === s.id ? "…" : prettyCombo(s.hotkey)}
          </button>
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
