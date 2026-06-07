import type { CSSProperties } from "react";
import type { Boss } from "../engine/config";

type Props = {
  bosses: Boss[];
  onPick: (id: string) => void;
  onOpenSettings: () => void;
};

/**
 * Screen 1 of the pick-boss-first flow: choose the active boss (→ its timers). The overlay
 * stays compact during play — all editing (add/rename/delete bosses & skills, pitches,
 * hotkeys, reset) lives behind ⚙, which opens the separate settings window. Each boss
 * button carries its accent so bosses read distinctly.
 */
export function BossSelect({ bosses, onPick, onOpenSettings }: Props) {
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
      <button className="btn-link" onClick={onOpenSettings} title="open settings window">
        ⚙ settings
      </button>
    </div>
  );
}
