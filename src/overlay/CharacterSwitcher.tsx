// The dock's active-character chip + switcher (PRD #47, create flow #54). The chip shows who you're
// playing and is the trigger; the dropdown lists every character (active ✓), switches on tap, and
// carries inline rename (✎) and delete (🗑) plus a "+ New character" that opens the create wizard.
// Switching only swaps the recurring surface — bosses/cooldowns are global, untouched. Entitlement
// gating lives at the create call site (useConfig), not here — "+ New" simply no-ops when over the
// tier cap (TODO #56: the cap-hit nudge).
//
// The dock bar clips its content (`overflow: hidden`), so unlike the in-panel RungCurtain/CooldownPicker
// dropdowns this menu is PORTALLED to <body> and positioned `fixed` from the chip's rect, with the
// edge-aware open direction (#27) resolved from where the overlay sits — opening inward wherever it's
// dragged.
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Race } from "../engine/skillCatalog";
import { type Anchor } from "./anchor";
import { measureAnchor } from "./measureOverlay";

const DEFAULT_ANCHOR: Anchor = { horizontal: "left", vertical: "down" };
const GAP = 4; // px between the chip and the menu

/** The per-character facts the switcher renders — a projection of `Character`, not the whole shape. */
export type CharacterChip = { id: string; name: string; race?: Race };

type Props = {
  /** Every character, in display order. */
  characters: CharacterChip[];
  /** The active character's id (null = none, i.e. first-run before any character exists). */
  activeId: string | null;
  /** Switch the active character (swaps only the recurring surface). */
  onSwitch: (id: string) => void;
  /** Open the edit/classify flow for a character (name + empire/race/build). */
  onEdit: (id: string) => void;
  /** Delete a character (disabled for the lone remaining one, so the UI never wipes into first-run). */
  onDelete: (id: string) => void;
  /** Open the create wizard ("+ New character"). */
  onNew: () => void;
};

/** Place the menu `fixed` against the chip's rect, opening inward per the resolved anchor. */
function menuStyle(chip: HTMLElement, anchor: Anchor): CSSProperties {
  const r = chip.getBoundingClientRect();
  const style: CSSProperties = {};
  if (anchor.horizontal === "left") style.left = r.left;
  else style.right = window.innerWidth - r.right;
  if (anchor.vertical === "down") style.top = r.bottom + GAP;
  else style.bottom = window.innerHeight - r.top + GAP;
  return style;
}

export function CharacterSwitcher({ characters, activeId, onSwitch, onEdit, onDelete, onNew }: Props) {
  const chipRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});
  const [open, setOpen] = useState(false);

  const active = characters.find((c) => c.id === activeId);

  // Re-resolve the open direction + the fixed position from the chip's current rect (mount, resize,
  // after a drag, and as the menu opens) — the overlay is freely draggable, so neither is fixed.
  const recompute = useCallback(() => {
    const el = chipRef.current;
    if (!el) return;
    void measureAnchor(el).then((a) => setPos(menuStyle(el, a ?? DEFAULT_ANCHOR)));
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
    if (open) recompute();
  }, [open, recompute]);

  // Close on an outside click. The menu is portalled out of the chip's subtree, so check both.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!chipRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (id: string) => {
    onSwitch(id);
    setOpen(false);
  };
  const edit = (id: string) => {
    onEdit(id);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={chipRef}
        className={`dock-seg dock-char${open ? " is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="active character"
      >
        <span className="dock-seg__icon">👤</span>
        <span className="dock-seg__val dock-seg__name">{active ? active.name.toUpperCase() : "—"}</span>
      </button>
      {open &&
        createPortal(
          <div className="char-menu" ref={menuRef} style={pos}>
            <div className="char-menu__list">
              {characters.map((c) => (
                <div key={c.id} className={`char-menu__row${c.id === activeId ? " is-active" : ""}`}>
                  <button className="char-menu__pick" onClick={() => pick(c.id)}>
                    <span className="char-menu__check">{c.id === activeId ? "✓" : ""}</span>
                    <span className="char-menu__name">{c.name}</span>
                    {c.race && <span className="char-menu__race">{c.race}</span>}
                  </button>
                  <button className="char-menu__act" onClick={() => edit(c.id)} title="edit / classify">
                    ✎
                  </button>
                  <button
                    className="char-menu__act char-menu__del"
                    onClick={() => onDelete(c.id)}
                    disabled={characters.length <= 1}
                    title={characters.length <= 1 ? "the only character can't be deleted" : "delete"}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
            <button
              className="char-menu__new"
              onClick={() => {
                onNew();
                setOpen(false);
              }}
            >
              + New character
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
