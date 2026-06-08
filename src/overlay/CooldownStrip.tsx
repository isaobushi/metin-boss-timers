// Variant A "whisper row": a subdued, app-level strip of Tag + readout pills sitting above
// the boss panel on every overlay screen. Deliberately quieter than the boss-skill chips —
// text-only, low opacity, no bars; only a Ready pill lights up. Left-click a pill restarts
// it, right-click clears it (the wheel does NOT live on running pills — duration tuning is
// the picker's job, see CooldownPicker). The + opens a plain catalog dropdown; clicking a
// row starts that cooldown at its (possibly tuned) catalog duration in one tap. Because the
// overlay is freely draggable, the dropdown is edge-aware (#27): the pure anchorFor decides
// which way it opens, fed real per-platform metrics by measureAnchor; the strip re-resolves
// on mount, resize, and after every drag (pointerup), then the pills and the + hug whichever
// horizontal side keeps them attached to the screen edge.
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtDur, type CooldownDef } from "../engine/cooldown";
import { GAP_MS, applyNotch } from "../engine/cooldownTuning";
import { type Anchor } from "./anchor";
import { measureAnchor } from "./measureOverlay";
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
  /** Lay the + out on the same row as the running pills (the compact cooldowns-only HUD, #29). */
  inlineAdd?: boolean;
};

export function CooldownStrip({ pills, catalog, onStart, onRestart, onClear, onTune, onDuplicate, inlineAdd }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor>(DEFAULT_ANCHOR);

  // Re-resolve the open direction whenever the overlay might have moved: on mount, when the
  // viewport resizes, and after any drag (a drag ends with a pointerup). Cheap and async —
  // a null result (failed metrics read) just leaves the last good placement in place.
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
        inlineAdd ? " cooldown-strip--inline-add" : ""
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
        </div>
      )}
      <CooldownPicker
        catalog={catalog}
        anchor={anchor}
        onOpen={recompute}
        onStart={onStart}
        onTune={onTune}
        onDuplicate={onDuplicate}
      />
    </div>
  );
}

// The + picker: a compact dropdown of the catalog. Scrolling a row tunes that definition's
// catalog duration (velocity-sensitive — see engine/cooldownTuning); one tap on a row then
// starts it at the tuned value; the per-row + duplicates that definition (a numbered copy,
// so the same boss can run twice at once). The menu opens in the `anchor` direction resolved
// by the strip (#27) — horizontal/vertical modifier classes flip it leftward/upward so it
// never overflows when the overlay is dragged to a screen edge; opening also re-resolves the
// anchor (onOpen) so a drag that didn't end on this window still places it correctly. The
// wheel listener is attached natively + non-passive (React 19 delegates `wheel` passively, so
// an `onWheel` prop could not preventDefault page scroll); every tuning decision is delegated
// to the pure `applyNotch`, so this stays a thin shell.
function CooldownPicker({
  catalog,
  anchor,
  onOpen,
  onStart,
  onTune,
  onDuplicate,
}: {
  catalog: CooldownDef[];
  anchor: Anchor;
  onOpen: () => void;
  onStart: (defId: string) => void;
  onTune: (defId: string, durationMs: number) => void;
  onDuplicate: (defId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  // Latest catalog, read inside the native listener without re-subscribing on every tune.
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  });
  // Per-spin state the pure engine needs: streak, which row, when the last notch landed,
  // and the working duration (so a fast burst of notches accumulates before React commits
  // the catalog change). All refs — they steer feel, never the render.
  const streak = useRef(0);
  const lastRow = useRef<string | null>(null);
  const lastAt = useRef(0);
  const working = useRef(0);

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>("[data-defid]");
      if (!row) return;
      const defId = row.dataset.defid!;
      const def = catalogRef.current.find((d) => d.id === defId);
      if (!def || e.deltaY === 0) return;
      e.preventDefault(); // hold the page still while the wheel tunes

      const now = Date.now();
      const gapMs = now - lastAt.current;
      const sameRow = lastRow.current === defId;
      const direction: 1 | -1 = e.deltaY < 0 ? 1 : -1; // scroll up = add, down = subtract
      // Continue from the working value during a fast same-row burst; otherwise (re)seed
      // from the committed catalog duration so a fresh spin starts from the truth on screen.
      const base = sameRow && gapMs < GAP_MS ? working.current : def.durationMs;
      const out = applyNotch(base, streak.current, direction, gapMs, sameRow);

      working.current = out.durationMs;
      streak.current = out.streak;
      lastRow.current = defId;
      lastAt.current = now;
      onTune(defId, out.durationMs);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, onTune]);

  return (
    <div className="cooldown-picker">
      <button
        className="cooldown-add"
        onClick={() =>
          setOpen((o) => {
            if (!o) onOpen(); // re-resolve placement as the menu opens, before it paints
            return !o;
          })
        }
        title="start a cooldown"
        aria-label="start a cooldown"
      >
        +
      </button>
      {open && (
        <div
          className={`cooldown-menu${anchor.horizontal === "right" ? " cooldown-menu--right" : ""}${
            anchor.vertical === "up" ? " cooldown-menu--up" : ""
          }`}
          ref={menuRef}
        >
          <div className="cooldown-menu__hint">scroll to change time</div>
          {catalog.map((d) => (
            // data-defid on the row so scroll-to-tune works across the whole row, including
            // over the duplicate button; the start and duplicate actions are separate buttons.
            <div key={d.id} className="cooldown-menu__row" data-defid={d.id}>
              <button
                className="cooldown-menu__item"
                onClick={() => {
                  onStart(d.id);
                  setOpen(false);
                }}
                title="click to start · scroll to tune duration"
              >
                <span className="cooldown-menu__tag">{d.tag}</span>
                <span className="cooldown-menu__name">{d.name}</span>
                <span className="cooldown-menu__dur">{fmtDur(d.durationMs)}</span>
              </button>
              <button
                className="cooldown-menu__dupe"
                onClick={() => onDuplicate(d.id)}
                title={`add another ${d.name}`}
                aria-label={`add another ${d.name}`}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
