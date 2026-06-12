// The per-row set-rung curtain (issue #46): tapping a ladder row's rung readout opens a compact,
// searchable dropdown of that readable's seeded ladder, scoped to its own structure. Players install
// with progress already in hand (nobody starts at M1/Stage 1), so they set their current rung once;
// the same gesture corrects a mis-tapped ✓ later — it is the only correction path, by design.
//
// Picking a rung snaps `position` to that rung's *entry* threshold (rung granularity — the first few
// ✓s true up the within-rung count). It writes the progress map only; the daily gate is untouched,
// so setting your rank never spends today's read. Follows CooldownPicker's idiom — self-owned
// edge-aware placement (#27) so the menu opens inward wherever the overlay sits — minus the wheel.
import { useCallback, useEffect, useRef, useState } from "react";
import { ladderRungs } from "../engine/recurring";
import { type Anchor } from "./anchor";
import { measureAnchor } from "./measureOverlay";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";
import { tipHint } from "./Tooltip";

const DEFAULT_ANCHOR: Anchor = { horizontal: "left", vertical: "down" };

type Props = {
  /** The readout shown as the trigger (`M3 · 2→M4`, `Stage 5/10 · …`, or the `… ✓ max` trophy). */
  text: string;
  /** Which seeded ladder this readable climbs — scopes the rung list. */
  ladderId: string;
  /** The current rung label, highlighted in the list. */
  currentRung: string;
  /** Snap the def's rank to the picked rung's entry threshold (writes progress only). */
  onPick: (rungLabel: string) => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

export function RungCurtain({ text, ladderId, currentRung, onPick, locale }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = useState<Anchor>(DEFAULT_ANCHOR);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const rungs = ladderRungs(ladderId);

  // Re-resolve the open direction from the overlay's current position whenever it might have moved
  // (mount, resize, after a drag) and as the menu opens — mirrors CooldownPicker.
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
  useEffect(() => {
    if (!open) return;
    recompute();
    inputRef.current?.focus(); // type-to-filter straight away
  }, [open, recompute]);

  // Close on an outside click, so the curtain behaves like the other dock dropdowns.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = q ? rungs.filter((r) => r.label.toLowerCase().includes(q)) : rungs;

  const pick = (label: string) => {
    onPick(label);
    setOpen(false);
    setQuery("");
  };

  return (
    <span className="rung-curtain" ref={rootRef}>
      <button
        className="dock-acc__ladder rung-curtain__trigger"
        onClick={() => setOpen((o) => !o)}
        {...tipHint(t("rung.triggerTitle", locale))}
      >
        {text}
      </button>
      {open && (
        <div
          className={`rung-menu${anchor.horizontal === "right" ? " rung-menu--right" : ""}${
            anchor.vertical === "up" ? " rung-menu--up" : ""
          }`}
        >
          <input
            ref={inputRef}
            className="rung-menu__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("rung.filterPlaceholder", locale)}
            aria-label={t("rung.filterAriaLabel", locale)}
          />
          <div className="rung-menu__list">
            {shown.length === 0 ? (
              <div className="rung-menu__empty">{t("rung.noMatch", locale)}</div>
            ) : (
              shown.map((r) => (
                <button
                  key={r.label}
                  className={`rung-menu__item${r.label === currentRung ? " is-current" : ""}`}
                  onClick={() => pick(r.label)}
                >
                  {r.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </span>
  );
}
