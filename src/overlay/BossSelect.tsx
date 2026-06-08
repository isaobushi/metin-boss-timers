import type { CSSProperties } from "react";
import type { Boss } from "../engine/config";
import { quitApp } from "./quitApp";

type Props = {
  bosses: Boss[];
  onPick: (id: string) => void;
  onOpenSettings: () => void;
  onOpenSequence: () => void;
};

/**
 * Screen 1 of the pick-boss-first flow: choose the active boss (→ its timers). The overlay
 * stays compact during play — all editing (add/rename/delete bosses & skills, pitches,
 * hotkeys, reset) lives behind ⚙, which opens the separate settings window. Each boss
 * button carries its accent so bosses read distinctly.
 */
export function BossSelect({ bosses, onPick, onOpenSettings, onOpenSequence }: Props) {
  return (
    <div className="panel boss-select">
      {/* doubles as the window's drag handle — grab the title to move the frameless overlay */}
      <div className="panel__title" data-tauri-drag-region>
        SELECT BOSS
      </div>
      {bosses.map((b) => (
        <div className="boss-row" key={b.id} style={{ "--accent": b.accent, "--accent2": b.accent2 } as CSSProperties}>
          <button className="boss-row__pick" onClick={() => onPick(b.id)}>
            {b.name.toUpperCase()}
          </button>
        </div>
      ))}
      {bosses.length === 0 && <div className="empty">no bosses yet</div>}
      <div className="boss-select__footer">
        <button className="btn-link" onClick={onOpenSettings} title="open settings window">
          ⚙ settings
        </button>
        <button className="btn-link" onClick={onOpenSequence} title="Templum Serpens sequence helper">
          ▦ sequence
        </button>
        <button className="btn-link btn-link--danger" onClick={quitApp} title="close app">
          ✕ quit
        </button>
      </div>
    </div>
  );
}
