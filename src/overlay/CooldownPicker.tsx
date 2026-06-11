// The cooldown "+" picker: a compact dropdown of the catalog, extracted from CooldownStrip so it
// can live in two places — trailing the pill row (cooldowns-only / unpinned), or inline beside the
// first timer chip when the pinned cooldown strip and the boss timers are open together (ADR-0003,
// dock home). Self-contained: it owns its own edge-aware placement (#27) so wherever it's mounted,
// the dropdown opens inward from the overlay's screen position.
//
// Scrolling a row tunes that definition's catalog duration (velocity-sensitive — see
// engine/cooldownTuning); one tap on a row then starts it at the tuned value; the per-row +
// duplicates that definition (a numbered copy, so the same boss can run twice at once). The menu
// opens in the resolved `anchor` direction; horizontal/vertical modifier classes flip it
// leftward/upward so it never overflows when the overlay is dragged to a screen edge. The wheel
// listener is attached natively + non-passive (React 19 delegates `wheel` passively, so an
// `onWheel` prop could not preventDefault page scroll); every tuning decision is delegated to the
// pure `applyNotch`, so this stays a thin shell.
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtDur, type CooldownDef } from "../engine/cooldown";
import { GAP_MS, applyNotch } from "../engine/cooldownTuning";
import { type Anchor } from "./anchor";
import { measureAnchor } from "./measureOverlay";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

const DEFAULT_ANCHOR: Anchor = { horizontal: "left", vertical: "down" };

type Props = {
  catalog: CooldownDef[];
  onStart: (defId: string) => void;
  onTune: (defId: string, durationMs: number) => void;
  onDuplicate: (defId: string) => void;
  /** Optional controlled open state — lets the dock's ⏱ open the add menu directly. Omit for
   *  self-managed (the cooldowns-only HUD just clicks the + itself). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

export function CooldownPicker({ catalog, onStart, onTune, onDuplicate, open: controlledOpen, onOpenChange, locale }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor>(DEFAULT_ANCHOR);
  const [internalOpen, setInternalOpen] = useState(false);
  // Controlled when a parent passes `open`; otherwise self-managed.
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => (onOpenChange ? onOpenChange(next) : setInternalOpen(next)),
    [onOpenChange],
  );

  // Re-resolve the open direction from the overlay's current position whenever it might have moved:
  // on mount, on resize, after any drag (a drag ends with a pointerup), and as the menu opens.
  // measureAnchor reads the enclosing `.overlay`, so this works wherever the picker is mounted.
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
  // Re-resolve placement whenever the menu opens — covers both the + click and an external open
  // (the dock's ⏱ jumping straight to the add menu when nothing is running).
  useEffect(() => {
    if (open) recompute();
  }, [open, recompute]);

  // Latest catalog, read inside the native listener without re-subscribing on every tune.
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  });
  // Per-spin state the pure engine needs: streak, which row, when the last notch landed, and the
  // working duration (so a fast burst of notches accumulates before React commits the change).
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
      // Continue from the working value during a fast same-row burst; otherwise (re)seed from the
      // committed catalog duration so a fresh spin starts from the truth on screen.
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
    <div className="cooldown-picker" ref={rootRef}>
      <button
        className="cooldown-add"
        onClick={() => setOpen(!open)}
        title={t("picker.startCooldown", locale)}
        aria-label={t("picker.startCooldown", locale)}
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
          <div className="cooldown-menu__hint">{t("picker.hint", locale)}</div>
          {catalog.map((d) => (
            // data-defid on the row so scroll-to-tune works across the whole row, including over the
            // duplicate button; the start and duplicate actions are separate buttons.
            <div key={d.id} className="cooldown-menu__row" data-defid={d.id}>
              <button
                className="cooldown-menu__item"
                onClick={() => {
                  onStart(d.id);
                  setOpen(false);
                }}
                title={t("picker.itemTitle", locale)}
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
