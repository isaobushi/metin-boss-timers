// Variant A "whisper row": a subdued, app-level strip of Tag + readout pills sitting above the
// boss panel on every overlay screen. Deliberately quieter than the boss-skill chips — text-only,
// low opacity, no bars; only a Ready pill lights up. Left-click a pill restarts it, right-click
// clears it (the wheel does NOT live on running pills — duration tuning is the picker's job, see
// CooldownPicker). The + picker is a sibling component; this strip just lays it out after the pills
// — unless `showAdd` is false, which the dock home uses when the + has moved inline beside the
// first timer chip (the pinned strip then shows pills only, ADR-0003).
//
// Because the overlay is freely draggable, the pill wrap is edge-aware (#27): the pure anchorFor
// decides which horizontal side the pills hug, fed real per-platform metrics by measureAnchor; the
// strip re-resolves on mount, resize, and after every drag (pointerup) so the pills stay attached
// to the screen edge. (The picker resolves its own dropdown direction independently.)
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { type CooldownDef } from "../engine/cooldown";
import { type Anchor } from "./anchor";
import { measureAnchor } from "./measureOverlay";
import { CooldownPicker } from "./CooldownPicker";
import type { CooldownPill } from "./useCooldowns";

const DEFAULT_ANCHOR: Anchor = { horizontal: "left", vertical: "down" };

type Props = {
  pills: CooldownPill[];
  catalog: CooldownDef[];
  onStart: (defId: string) => void;
  onRestart: (defId: string) => void;
  onClear: (defId: string) => void;
  onTune: (defId: string, durationMs: number) => void;
  onDuplicate: (defId: string) => void;
  /** Render the + picker here. False when the dock has moved it inline with the timers (default true). */
  showAdd?: boolean;
  /** A node (the dock's controlled + picker) dropped into the pills grid as a trailing cell, so it
   *  lines up horizontally with the badges instead of getting its own row below them (ADR-0003). */
  trailing?: ReactNode;
};

export function CooldownStrip({
  pills,
  catalog,
  onStart,
  onRestart,
  onClear,
  onTune,
  onDuplicate,
  showAdd = true,
  trailing,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor>(DEFAULT_ANCHOR);

  // Re-resolve which side the pills hug whenever the overlay might have moved: on mount, when the
  // viewport resizes, and after any drag (a drag ends with a pointerup). A null result (failed
  // metrics read) just leaves the last good placement in place.
  const recompute = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    void measureAnchor(el).then((a) => a && setAnchor(a));
  }, []);
  useEffect(() => {
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("pointerup", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("pointerup", recompute);
    };
  }, [recompute]);

  return (
    <div
      className={`cooldown-strip${anchor.horizontal === "right" ? " cooldown-strip--right" : ""}${
        trailing ? " cooldown-strip--inline" : ""
      }`}
      ref={rootRef}
    >
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
          {trailing}
        </div>
      )}
      {showAdd && <CooldownPicker catalog={catalog} onStart={onStart} onTune={onTune} onDuplicate={onDuplicate} />}
    </div>
  );
}
