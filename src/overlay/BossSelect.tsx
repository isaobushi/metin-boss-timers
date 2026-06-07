import type { CSSProperties } from "react";
import type { Boss } from "../engine/config";

type Props = {
  bosses: Boss[];
  onPick: (id: string) => void;
  onSettings: (id: string) => void;
  onAddBoss: () => void;
  onReset: () => void;
};

/**
 * Screen 1 of the pick-boss-first flow: choose the active boss (→ its timers) or open
 * a boss's ⚙ settings. Each boss button carries its accent so bosses read distinctly.
 */
export function BossSelect({ bosses, onPick, onSettings, onAddBoss, onReset }: Props) {
  return (
    <div className="panel boss-select">
      <div className="panel__title">SELECT BOSS</div>
      {bosses.map((b) => (
        <div className="boss-row" key={b.id} style={{ "--accent": b.accent, "--accent2": b.accent2 } as CSSProperties}>
          <button className="boss-row__pick" onClick={() => onPick(b.id)}>
            {b.name.toUpperCase()}
          </button>
          <button className="boss-row__gear" onClick={() => onSettings(b.id)} title={`${b.name} settings`}>
            ⚙
          </button>
        </div>
      ))}
      {bosses.length === 0 && <div className="empty">no bosses yet</div>}
      <button className="btn-dashed" onClick={onAddBoss}>
        + ADD BOSS
      </button>
      <button
        className="btn-link"
        onClick={() => {
          if (window.confirm("Reset all bosses and skills to defaults?")) onReset();
        }}
      >
        reset to defaults
      </button>
    </div>
  );
}
