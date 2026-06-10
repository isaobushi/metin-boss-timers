import type { CSSProperties } from "react";
import type { Boss } from "../engine/config";
import { Chip } from "./Chip";
import { useHotkeys } from "./hotkeys";
import { useTimers } from "./useTimers";

type Props = {
  boss: Boss;
  onChangeBoss: () => void;
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
export function TimerScreen({ boss, onChangeBoss }: Props) {
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
      {views.length === 0 && <div className="empty">no skills — add some in ⚙ settings</div>}
      <div className="timer-foot">
        <button className="icon-btn" onClick={onChangeBoss} title="back to dungeons">
          ←
        </button>
        {views.length > 0 && (
          <span className="timer-hint">
            <b>left-click</b> stop / start · <b>right-click</b> reset
          </span>
        )}
      </div>
    </div>
  );
}
