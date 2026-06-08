// Variant A "whisper row": a subdued, app-level strip of Tag + readout pills sitting above
// the boss panel on every overlay screen. Deliberately quieter than the boss-skill chips —
// text-only, low opacity, no bars; only a Ready pill lights up. Left-click a pill restarts
// it, right-click clears it (the wheel does NOT live on running pills — duration tuning is
// the picker's job in a later slice). The + opens a plain catalog dropdown; clicking a row
// starts that cooldown at its catalog duration in one tap. (Edge-aware placement is #4.)
import { useState } from "react";
import { fmtDur, type CooldownDef } from "../engine/cooldown";
import type { CooldownPill } from "./useCooldowns";

type Props = {
  pills: CooldownPill[];
  catalog: CooldownDef[];
  onStart: (defId: string) => void;
  onRestart: (defId: string) => void;
  onClear: (defId: string) => void;
};

export function CooldownStrip({ pills, catalog, onStart, onRestart, onClear }: Props) {
  return (
    <div className="cooldown-strip">
      {pills.length > 0 && (
        <div className="cooldown-strip__pills">
          {pills.map((p) => (
            <button
              key={p.defId}
              className={`cooldown-pill${p.ready ? " is-ready" : ""}`}
              onClick={() => onRestart(p.defId)}
              onContextMenu={(e) => {
                e.preventDefault();
                onClear(p.defId);
              }}
              title={`${p.name} — left-click restart · right-click clear`}
            >
              <span className="cooldown-pill__tag">{p.tag}</span>
              <span className="cooldown-pill__num">{p.readout}</span>
            </button>
          ))}
        </div>
      )}
      <CooldownPicker catalog={catalog} onStart={onStart} />
    </div>
  );
}

// The + picker: a compact dropdown of the catalog. One tap on a row starts that cooldown
// at its catalog duration. No wheel tuning (#3) and no edge-aware placement (#4) yet — a
// plain downward dropdown is intentionally enough for this slice.
function CooldownPicker({ catalog, onStart }: { catalog: CooldownDef[]; onStart: (defId: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cooldown-picker">
      <button
        className="cooldown-add"
        onClick={() => setOpen((o) => !o)}
        title="start a cooldown"
        aria-label="start a cooldown"
      >
        +
      </button>
      {open && (
        <div className="cooldown-menu">
          {catalog.map((d) => (
            <button
              key={d.id}
              className="cooldown-menu__item"
              onClick={() => {
                onStart(d.id);
                setOpen(false);
              }}
            >
              <span className="cooldown-menu__tag">{d.tag}</span>
              <span className="cooldown-menu__name">{d.name}</span>
              <span className="cooldown-menu__dur">{fmtDur(d.durationMs)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
