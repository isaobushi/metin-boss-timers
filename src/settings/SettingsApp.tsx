// The settings window's root — the full config-editing surface that lives *outside* the
// compact overlay (slice #6). It runs its own `useConfig()`; every edit persists and
// broadcasts, so the overlay window reflects changes live (configSync). One BossSettings
// block per boss, plus add-boss and reset-to-defaults that used to crowd the overlay.
//
// The surface grew a section per dock tool (bosses, cooldowns, items, routine); once the
// routine seed filled out it was too tall to scan, so the four sections live behind tabs
// keyed to the same icons the dock uses (⚔ ⏱ ⧗ ✓). Reset/close stay global in the head.
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { BossSettings } from "../overlay/BossSettings";
import { CooldownSettings } from "../overlay/CooldownSettings";
import { RecurringSettings } from "../overlay/RecurringSettings";
import { activeRecurring } from "../engine/config";
import { useConfig } from "../overlay/useConfig";
import { unlockAudio } from "../overlay/audio";
import { closeSettingsWindow } from "../overlay/settingsWindow";
import { emitTransient, subscribeTransient } from "../overlay/transientSync";
import type { SettingsTab } from "../engine/settingsLink";
import { BackupSection } from "./BackupSection";
import { LocaleSettings } from "./LocaleSettings";
import { CapNudge } from "../overlay/CapNudge";
import { type PurchasePhase, SubscribeScreen } from "../overlay/SubscribeScreen";
import { CheckboxIcon, CloseIcon, HourglassIcon, ResetIcon, TourIcon } from "../overlay/icons";
import { startTrial, subscribe, type Plan } from "../overlay/purchaseFlow";
import type { Entitlement } from "../engine/entitlement";
import { t } from "../engine/chrome";

// One tab per dock tool, in dock order. The icon mirrors the dock segment so the two
// surfaces read as the same vocabulary; ⚔ "Dungeons" is the boss/skill editor (the dock's
// skills tool), ⏱ the dungeon cooldowns, ⧗ the expiring items, ✓ the routine gates.
// The union lives in the engine (settingsLink) so tour deep links (#72) stay in lock-step.
type TabId = SettingsTab;

// `onClose` is supplied when the settings render inline in the browser (App's modal): Esc
// and the ✕ button dismiss the modal. In the Tauri settings window it's absent, so closing
// falls back to closing the real OS window (which also has its own titlebar close button).
// `initialTab` is the deep-link seed (#72) — the SINGLE seeding seam: App's inline modal passes
// the nudge's tab, main.tsx passes the Tauri window's URL-hash tab (initialSettingsTab). The
// component never reads location itself; later re-tabs arrive over the transient bus.
export default function SettingsApp({ onClose, initialTab }: { onClose?: () => void; initialTab?: SettingsTab }) {
  const cfg = useConfig();
  const close = onClose ?? closeSettingsWindow;
  const [tab, setTab] = useState<TabId>(initialTab ?? "dungeons");

  // Deep links aimed at an ALREADY-open settings surface (#72) — the URL hash is long consumed,
  // so the tour's nudge re-tabs this window live over the transient bus. A purchase completed in
  // the OTHER surface (the overlay) unlocks this window's gates live too (#58).
  const { setEntitlement, dismissNudge } = cfg;
  useEffect(
    () =>
      subscribeTransient((msg) => {
        if (msg.kind === "settings-navigate") setTab(msg.tab);
        if (msg.kind === "entitlement-changed") setEntitlement(msg.entitlement);
      }),
    [setEntitlement],
  );
  // The subscribe screen, opened by a cap-hit nudge here in the settings window (#56/#58).
  const [showSubscribe, setShowSubscribe] = useState(false);

  // Purchase flow (mirrors App — see the applyPurchase comment there): busy-lock + error surface,
  // broadcast the unlock to the overlay, stay quiet on a user-cancelled Store dialog.
  const [purchasePhase, setPurchasePhase] = useState<PurchasePhase>("idle");
  const applyPurchase = useCallback(
    async (run: Promise<{ ok: true; entitlement: Entitlement } | { ok: false; reason: string }>) => {
      setPurchasePhase("busy");
      const result = await run;
      if (result.ok) {
        setEntitlement(result.entitlement);
        emitTransient({ kind: "entitlement-changed", entitlement: result.entitlement });
        setPurchasePhase("idle");
        setShowSubscribe(false);
      } else {
        setPurchasePhase(result.reason === "error" ? "error" : "idle");
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

  const locale = cfg.config.locale;
  const TABS: ReadonlyArray<{ id: TabId; icon: ReactNode; label: string }> = [
    { id: "dungeons", icon: "⚔", label: t("settings.tabDungeons", locale) },
    { id: "cooldowns", icon: "⏱", label: t("settings.tabCooldowns", locale) },
    { id: "items", icon: <HourglassIcon />, label: t("settings.tabItems", locale) },
    { id: "routine", icon: <CheckboxIcon />, label: t("settings.tabRoutine", locale) },
    { id: "language", icon: "🌐", label: t("settings.tabLanguage", locale) },
  ];

  // The per-tab explainer (#72) — a persistent one-liner in glossary language that teaches what
  // the tab edits on EVERY visit (the tour points here; the header keeps teaching after it's gone).
  // The language tab needs none: LocaleSettings carries its own hint.
  const EXPLAINERS: Partial<Record<TabId, string>> = {
    dungeons: t("settings.explainDungeons", locale),
    cooldowns: t("settings.explainCooldowns", locale),
    items: t("settings.explainItems", locale),
    routine: t("settings.explainRoutine", locale),
  };

  return (
    <div className="settings-app">
      <div className="settings-app__head">
        <span className="settings-app__title">{t("settings.title", locale)}</span>
        {/* The global actions live as one icon strip up here (design walk): tour replay,
            backup export/import, reset — with close set apart and heavier at the end. */}
        <div className="settings-app__actions">
          <button
            className="settings-icon-btn"
            onClick={() => {
              // Rides the transient bus to the overlay (reverse of settings-navigate) and closes
              // this surface so the tour is actually visible (#73).
              emitTransient({ kind: "tour-replay" });
              close();
            }}
            title={`${t("settings.showAround", locale)} — ${t("settings.showAroundHint", locale)}`}
            aria-label={t("settings.showAround", locale)}
          >
            <TourIcon />
          </button>
          <BackupSection onExport={cfg.exportBackup} onImport={cfg.applyImport} locale={locale} />
          <button
            className="settings-icon-btn"
            onClick={() => {
              if (window.confirm(t("settings.resetConfirm", locale))) cfg.resetConfig();
            }}
            title={t("settings.resetToDefaults", locale)}
            aria-label={t("settings.resetToDefaults", locale)}
          >
            <ResetIcon />
          </button>
          {onClose && (
            <button
              className="settings-icon-btn settings-icon-btn--close"
              onClick={onClose}
              title={t("settings.closeTitle", locale)}
              aria-label={t("settings.closeTitle", locale)}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="settings-tabs" role="tablist">
        {TABS.map((tab_) => (
          <button
            key={tab_.id}
            role="tab"
            aria-selected={tab === tab_.id}
            className={`settings-tab${tab === tab_.id ? " is-active" : ""}`}
            onClick={() => setTab(tab_.id)}
          >
            <span className="settings-tab__icon">{tab_.icon}</span>
            {tab_.label}
          </button>
        ))}
      </div>

      {EXPLAINERS[tab] && <p className="settings-explainer">{EXPLAINERS[tab]}</p>}

      {tab === "dungeons" && (
        <>
          <div className="settings-app__bosses">
            {cfg.config.bosses.map((boss) => (
              <BossSettings
                key={boss.id}
                boss={boss}
                locale={cfg.config.locale}
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

          <button className="btn-dashed btn-dashed--glow" onClick={() => cfg.createBoss()}>
            {t("settings.addBoss", locale)}
          </button>
        </>
      )}

      {tab === "cooldowns" && (
        <CooldownSettings
          cooldowns={cfg.config.cooldowns}
          locale={cfg.config.locale}
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
          locale={cfg.config.locale}
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
          locale={cfg.config.locale}
          onAdd={() => cfg.createRoutine()}
          onRename={(defId, name) => cfg.editRecurringName(defId, name)}
          onSetDuration={(defId, durationMs) => cfg.editRecurringDuration(defId, durationMs)}
          onRemove={(defId) => cfg.deleteRecurring(defId)}
          onSetMaxed={(defId, maxed) => cfg.editRecurringMaxed(defId, maxed)}
        />
      )}

      {tab === "language" && (
        <LocaleSettings
          locale={cfg.config.locale}
          onChange={(locale) => cfg.changeLocale(locale)}
        />
      )}

      {/* Cap-hit nudge (#56): a capped add (boss / reminder) was just refused here. */}
      {cfg.capNudge && (
        <div className="settings-modal">
          <CapNudge mutation={cfg.capNudge} onUpgrade={openSubscribe} onDismiss={cfg.dismissNudge} locale={cfg.config.locale} />
        </div>
      )}
      {showSubscribe && (
        <div className="settings-modal">
          <SubscribeScreen
            entitlement={cfg.entitlement}
            phase={purchasePhase}
            onStartTrial={() => void applyPurchase(startTrial())}
            onSubscribe={(plan: Plan) => void applyPurchase(subscribe(plan))}
            onClose={() => {
              setShowSubscribe(false);
              setPurchasePhase("idle"); // a stale error must not greet the next open
            }}
            locale={cfg.config.locale}
          />
        </div>
      )}
    </div>
  );
}
