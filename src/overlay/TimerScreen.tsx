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
 * Screen 2: the active boss's skills as draining chips. `useTimers` owns the single
 * render loop and is fed this boss's skills directly (a `SkillCfg` is a `TimerInit`).
 * Leaving this screen unmounts the loop, so returning to any boss starts fresh — which
 * keeps "only the active boss runs" and "switching boss resets all timers" true.
 */
export function TimerScreen({ boss, onChangeBoss }: Props) {
  const { views, register, onToggle, onReset, onTrigger } = useTimers(boss.skills);
  // Only mounted here, so only the active boss's bindings are registered; a fired key
  // re-arms (reset + start) its timer. Re-registers when this boss's bindings change.
  useHotkeys(boss.skills, onTrigger);

  return (
    <div className="panel timer-screen" style={{ "--accent": boss.accent } as CSSProperties}>
      <div className="timer-head">
        <button className="icon-btn" onClick={onChangeBoss} title="change boss">
          ←
        </button>
        <span className="timer-head__name">{boss.name.toUpperCase()}</span>
        <span className="icon-btn-spacer" />
      </div>

      {views.map((v) => (
        <Chip
          key={v.id}
          id={v.id}
          label={v.label}
          running={v.running}
          register={register}
          onToggle={() => onToggle(v.id)}
          onReset={() => onReset(v.id)}
        />
      ))}
      {views.length === 0 && <div className="empty">no skills — add some in ⚙ settings</div>}
    </div>
  );
}
