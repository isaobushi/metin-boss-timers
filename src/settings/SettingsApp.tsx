// The settings window's root — the full config-editing surface that lives *outside* the
// compact overlay (slice #6). It runs its own `useConfig()`; every edit persists and
// broadcasts, so the overlay window reflects changes live (configSync). One BossSettings
// block per boss, plus add-boss and reset-to-defaults that used to crowd the overlay.
//
// The surface grew a section per dock tool (bosses, cooldowns, items, routine); once the
// routine seed filled out it was too tall to scan, so the four sections live behind tabs
// keyed to the same icons the dock uses (⚔ ⏱ ♻ ✓). Reset/close stay global in the head.
import { useCallback, useEffect, useState } from "react";
import { BossSettings } from "../overlay/BossSettings";
import { CooldownSettings } from "../overlay/CooldownSettings";
import { RecurringSettings } from "../overlay/RecurringSettings";
import { activeRecurring } from "../engine/config";
import { useConfig } from "../overlay/useConfig";
import { unlockAudio } from "../overlay/audio";
import { closeSettingsWindow } from "../overlay/settingsWindow";
import { BackupSection } from "./BackupSection";
import { CapNudge } from "../overlay/CapNudge";
import { SubscribeScreen } from "../overlay/SubscribeScreen";
import { startTrial, subscribe, type Plan } from "../overlay/purchaseFlow";
import type { Entitlement } from "../engine/entitlement";

// One tab per dock tool, in dock order. The icon mirrors the dock segment so the two
// surfaces read as the same vocabulary; ⚔ "Dungeons" is the boss/skill editor (the dock's
// skills tool), ⏱ the dungeon cooldowns, ♻ the expiring items, ✓ the routine gates.
type TabId = "dungeons" | "cooldowns" | "items" | "routine";
const TABS: ReadonlyArray<{ id: TabId; icon: string; label: string }> = [
  { id: "dungeons", icon: "⚔", label: "Dungeons" },
  { id: "cooldowns", icon: "⏱", label: "Cooldowns" },
  { id: "items", icon: "♻", label: "Items" },
  { id: "routine", icon: "✓", label: "Routine" },
];

// `onClose` is supplied when the settings render inline in the browser (App's modal): Esc
// and the ✕ button dismiss the modal. In the Tauri settings window it's absent, so closing
// falls back to closing the real OS window (which also has its own titlebar close button).
export default function SettingsApp({ onClose }: { onClose?: () => void }) {
  const cfg = useConfig();
  const close = onClose ?? closeSettingsWindow;
  const [tab, setTab] = useState<TabId>("dungeons");
  // The subscribe screen, opened by a cap-hit nudge here in the settings window (#56/#58).
  const [showSubscribe, setShowSubscribe] = useState(false);

  // Stubbed purchase flow (mirrors App) — on success reflect the granted entitlement at runtime.
  const { setEntitlement, dismissNudge } = cfg;
  const applyPurchase = useCallback(
    async (run: Promise<{ ok: true; entitlement: Entitlement } | { ok: false; reason: string }>) => {
      const result = await run;
      if (result.ok) {
        setEntitlement(result.entitlement);
        setShowSubscribe(false);
      }
    },
    [setEntitlement],
  );
  const openSubscribe = useCallback(() => {
    dismissNudge();
    setShowSubscribe(true);
  }, [dismissNudge]);

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
              if (window.confirm("Reset all bosses, skills, cooldowns and items to defaults?")) cfg.resetConfig();
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

      <div className="settings-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`settings-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="settings-tab__icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dungeons" && (
        <>
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
                onSetSound={(skillId, soundId) => cfg.editSkillSound(boss.id, skillId, soundId)}
                onSetHotkey={(skillId, hotkey) => cfg.editSkillHotkey(boss.id, skillId, hotkey)}
                onRemoveSkill={(skillId) => cfg.deleteSkill(boss.id, skillId)}
              />
            ))}
          </div>

          <button className="btn-dashed" onClick={() => cfg.createBoss()}>
            + ADD BOSS
          </button>
        </>
      )}

      {tab === "cooldowns" && (
        <CooldownSettings
          cooldowns={cfg.config.cooldowns}
          onAdd={() => cfg.createCooldown()}
          onRename={(defId, name) => cfg.editCooldownName(defId, name)}
          onRetag={(defId, tag) => cfg.editCooldownTag(defId, tag)}
          onSetDuration={(defId, durationMs) => cfg.editCooldownDuration(defId, durationMs)}
          onRemove={(defId) => cfg.deleteCooldown(defId)}
        />
      )}

      {tab === "items" && (
        <RecurringSettings
          recurring={activeRecurring(cfg.config)}
          kind="deadline"
          title="EXPIRING ITEMS"
          addLabel="+ ADD ITEM"
          emptyLabel="no expiring items yet"
          onAdd={() => cfg.createRecurring()}
          onRename={(defId, name) => cfg.editRecurringName(defId, name)}
          onSetDuration={(defId, durationMs) => cfg.editRecurringDuration(defId, durationMs)}
          onRemove={(defId) => cfg.deleteRecurring(defId)}
        />
      )}

      {tab === "routine" && (
        <RecurringSettings
          recurring={activeRecurring(cfg.config)}
          kind="gate"
          title="ROUTINE"
          addLabel="+ ADD ROUTINE"
          emptyLabel="no routine items yet"
          onAdd={() => cfg.createRoutine()}
          onRename={(defId, name) => cfg.editRecurringName(defId, name)}
          onSetDuration={(defId, durationMs) => cfg.editRecurringDuration(defId, durationMs)}
          onRemove={(defId) => cfg.deleteRecurring(defId)}
        />
      )}

      {/* Global backup/trust feature (#56) — export/import a portable copy of the whole config. */}
      <BackupSection onExport={cfg.exportBackup} onImport={cfg.applyImport} />

      {/* Cap-hit nudge (#56): a capped add (boss / reminder) was just refused here. */}
      {cfg.capNudge && (
        <div className="settings-modal">
          <CapNudge mutation={cfg.capNudge} onUpgrade={openSubscribe} onDismiss={cfg.dismissNudge} />
        </div>
      )}
      {showSubscribe && (
        <div className="settings-modal">
          <SubscribeScreen
            entitlement={cfg.entitlement}
            onStartTrial={() => void applyPurchase(startTrial())}
            onSubscribe={(plan: Plan) => void applyPurchase(subscribe(plan))}
            onClose={() => setShowSubscribe(false)}
          />
        </div>
      )}
    </div>
  );
}
