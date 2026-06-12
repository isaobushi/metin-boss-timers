import type { CSSProperties } from "react";
import type { Boss } from "../engine/config";
import { Chip } from "./Chip";
import { BackIcon } from "./icons";
import { useHotkeys } from "./hotkeys";
import { useTimers } from "./useTimers";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  boss: Boss;
  onChangeBoss: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * Screen 2: the active boss's skills as draining chips. `useTimers` owns the single render loop
 * and is fed this boss's skills directly (a `SkillCfg` is a `TimerInit`). Leaving this screen
 * unmounts the loop, so returning to any boss starts fresh — which keeps "only the active boss
 * runs" and "switching boss resets all timers" true.
 *
 * Under the dock home (ADR-0003) this is deliberately minimal — just the bare chips, no header:
 * the dock bar already carries the boss name (⚔ <boss>) and the drag grip, ⚙ opens settings, and a
 * quiet footer ← changes dungeon (matching Templum's back control). The + add-picker rides with the
 * cooldown strip above, not here, so it stays lined up with the running-cooldown badges.
 */
export function TimerScreen({ boss, onChangeBoss, locale }: Props) {
  const { views, register, onToggle, onReset, onTrigger } = useTimers(boss.skills);
  // Only mounted here, so only the active boss's bindings are registered; a fired key re-arms
  // (reset + start) its timer. Re-registers when this boss's bindings change.
  useHotkeys(boss.skills, onTrigger);

  // Bound combo per skill id, so each chip can badge its hotkey (views carry no binding).
  const hotkeyById = new Map(boss.skills.map((s) => [s.id, s.hotkey]));

  return (
    <div className="timer-stack" style={{ "--accent": boss.accent } as CSSProperties}>
      {views.map((v) => (
        <div key={v.id}>
          <Chip
            id={v.id}
            label={v.label}
            running={v.running}
            hotkey={hotkeyById.get(v.id)}
            register={register}
            onToggle={() => onToggle(v.id)}
            onReset={() => onReset(v.id)}
          />
        </div>
      ))}
      {views.length === 0 && <div className="empty">{t("timer.noSkills", locale)}</div>}
      <div className="timer-foot">
        <button className="icon-btn" onClick={onChangeBoss} title={t("timer.back", locale)}>
          <BackIcon />
        </button>
        {views.length > 0 && (
          <span className="timer-hint">
            <b>{t("timer.hintLeftClick", locale)}</b> {t("timer.hintStopStart", locale)} ·{" "}
            <b>{t("timer.hintRightClick", locale)}</b> {t("timer.hintReset", locale)}
          </span>
        )}
      </div>
    </div>
  );
}
