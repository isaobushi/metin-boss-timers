// The settings window's root — the full config-editing surface that lives *outside* the
// compact overlay (slice #6). It runs its own `useConfig()`; every edit persists and
// broadcasts, so the overlay window reflects changes live (configSync). One BossSettings
// block per boss, plus add-boss and reset-to-defaults that used to crowd the overlay.
import { useEffect } from "react";
import { BossSettings } from "../overlay/BossSettings";
import { useConfig } from "../overlay/useConfig";
import { unlockAudio } from "../overlay/audio";
import { closeSettingsWindow } from "../overlay/settingsWindow";

// `onClose` is supplied when the settings render inline in the browser (App's modal): Esc
// and the ✕ button dismiss the modal. In the Tauri settings window it's absent, so closing
// falls back to closing the real OS window (which also has its own titlebar close button).
export default function SettingsApp({ onClose }: { onClose?: () => void }) {
  const cfg = useConfig();
  const close = onClose ?? closeSettingsWindow;

  // Audio is gated behind a user gesture — unlock on the first interaction so the per-skill
  // ▶ beep-preview works (mirrors the overlay's App.tsx).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Esc closes the settings surface — unless a hotkey capture is mid-flight, where Esc means
  // "clear that binding" (BossSettings handles it; the capturing chip carries the class).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".skill-key--capturing")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="settings-app">
      <div className="settings-app__head">
        <span className="settings-app__title">SETTINGS</span>
        <div className="settings-app__actions">
          <button
            className="btn-link"
            onClick={() => {
              if (window.confirm("Reset all bosses and skills to defaults?")) cfg.resetConfig();
            }}
          >
            reset to defaults
          </button>
          {onClose && (
            <button className="btn-link" onClick={onClose} title="close settings">
              ✕ close
            </button>
          )}
        </div>
      </div>

      <div className="settings-app__bosses">
        {cfg.config.bosses.map((boss) => (
          <BossSettings
            key={boss.id}
            boss={boss}
            onRenameBoss={(name) => cfg.editBossName(boss.id, name)}
            onDeleteBoss={() => cfg.removeBoss(boss.id)}
            onAddSkill={() => cfg.createSkill(boss.id)}
            onRenameSkill={(skillId, label) => cfg.editSkillName(boss.id, skillId, label)}
            onSetDuration={(skillId, durationMs) => cfg.editSkillDuration(boss.id, skillId, durationMs)}
            onSetHotkey={(skillId, hotkey) => cfg.editSkillHotkey(boss.id, skillId, hotkey)}
            onRemoveSkill={(skillId) => cfg.deleteSkill(boss.id, skillId)}
          />
        ))}
      </div>

      <button className="btn-dashed" onClick={() => cfg.createBoss()}>
        + ADD BOSS
      </button>
    </div>
  );
}
