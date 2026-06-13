// Instant styled tooltip layer, replacing the native title= attribute everywhere (task: the
// native bubble is slow, unstyled, and inconsistent across the transparent overlay window).
//
// One delegated layer per window, mounted once in main.tsx next to the app root — document-level
// pointerover/focusin listeners find the nearest [data-tip] ancestor, so components never wire
// handlers. Components opt in through the helpers below:
//   • tip(text)     — icon-only / glyph controls: sets data-tip AND aria-label, because dropping
//                     title= would otherwise drop the control's only accessible name.
//   • tipHint(text) — controls with their own visible text: data-tip only, so the tooltip stays
//                     supplementary and the visible text remains the accessible name.
//
// Placement is pure geometry in tooltipPlace.ts (flip below at the top edge, clamp inside the
// viewport): the Tauri window shrink-wraps its content, so anything past the viewport edge is
// cut off by the OS window bounds. The layer is position:fixed and pointer-events:none, so it
// never feeds the ResizeObserver in useOverlayAutosize — hovering must not resize the window.
//
// Known trade-off vs native title=: disabled buttons swallow pointer events, so they show no
// tooltip (same as every styled-tooltip library). Keyboard focus shows it only for :focus-visible,
// so plain clicks don't flash a bubble.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { placeTip } from "./tooltipPlace";

/** Tooltip + accessible name for icon-only controls (the common case). */
export function tip(text: string): { "data-tip": string; "aria-label": string } {
  return { "data-tip": text, "aria-label": text };
}

/** Tooltip only, for controls whose visible text already names them. */
export function tipHint(text: string): { "data-tip": string } {
  return { "data-tip": text };
}

export function TooltipLayer() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const find = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-tip]") : null);
    const onOver = (e: PointerEvent) => setAnchor(find(e.target));
    const onOut = (e: PointerEvent) => {
      // Only clear when the pointer truly left the anchor, not when crossing its children.
      if (find(e.target) && !find(e.relatedTarget)) setAnchor(null);
    };
    const onFocusIn = (e: FocusEvent) => {
      const a = find(e.target);
      // Keyboard-only: a mouse click also focuses, but the pointer path already handles that.
      if (a?.matches(":focus-visible")) setAnchor(a);
    };
    const hide = () => setAnchor(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide); // the action takes over; re-hover re-shows
    document.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", hide);
    };
  }, []);

  const text = anchor?.dataset.tip ?? "";

  // Two-pass: React renders the new text first, then this measures the real tip box against the
  // anchor and viewport and positions it — before paint, so it never flashes at the old spot.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const p = placeTip(a, { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
    el.style.left = `${Math.round(p.x)}px`;
    el.style.top = `${Math.round(p.y)}px`;
  }, [anchor, text]);

  if (!anchor || !text) return null;
  // aria-hidden: the helpers already expose the text as the control's accessible name.
  return (
    <div ref={tipRef} className="tip-layer" aria-hidden="true">
      {text}
    </div>
  );
}
