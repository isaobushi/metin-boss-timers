import type { CSSProperties } from "react";
import type { Boss } from "../engine/config";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  bosses: Boss[];
  onPick: (id: string) => void;
  onOpenSequence: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

// Templum reads as its own dungeon, so it gets a fixed serpent-green accent rather than a
// cycled boss colour — distinct from the timer bosses above it in the list.
const TEMPLUM_ACCENT = { accent: "#48d597", accent2: "#2bb6c4" } as const;

/**
 * Screen 1 of the pick-dungeon-first flow: choose a dungeon. Most are timer bosses (→ their
 * draining-chip screen); Templum is the odd one out — it opens the sequence-memory helper
 * instead. They share one button style ("dungeon buttons"), each carrying its accent so they
 * read distinctly. The overlay stays compact during play — all editing (add/rename/delete
 * bosses & skills, pitches, hotkeys, reset) lives behind ⚙, the separate settings window.
 */
export function BossSelect({ bosses, onPick, onOpenSequence, locale }: Props) {
  return (
    <div className="panel boss-select">
      {/* title doubles as the window's drag handle; the dock bar carries settings (⚙) + quit (✕) */}
      <div className="panel__title" data-tauri-drag-region>
        {t("bossSelect.title", locale)}
      </div>
      {bosses.map((b) => (
        <div className="boss-row" key={b.id} style={{ "--accent": b.accent, "--accent2": b.accent2 } as CSSProperties}>
          <button className="boss-row__pick" onClick={() => onPick(b.id)}>
            {b.name.toUpperCase()}
          </button>
        </div>
      ))}
      {/* Templum is a dungeon too — same button, but routes to the sequence helper. */}
      <div
        className="boss-row"
        style={{ "--accent": TEMPLUM_ACCENT.accent, "--accent2": TEMPLUM_ACCENT.accent2 } as CSSProperties}
      >
        <button className="boss-row__pick" onClick={onOpenSequence} title="Templum Serpens helper">
          TEMPLUM
        </button>
      </div>
    </div>
  );
}
