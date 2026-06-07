import { useEffect, useRef } from "react";
import type { ChipEls } from "./useTimers";

type ChipProps = {
  id: string;
  label: string;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
  /** Hands this chip's DOM nodes to the render loop, which paints them each frame. */
  register: (id: string, els: ChipEls | null) => void;
};

/**
 * A single timer chip — purely presentational. It owns no clock and no loop: it just
 * registers its fill/glow/count nodes with the central render loop (which drives them)
 * and forwards interaction. Left-click toggles, right-click resets; stopped chips dim.
 */
export function Chip({ id, label, running, onToggle, onReset, register }: ChipProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    register(id, { fill: fillRef.current!, glow: glowRef.current!, count: countRef.current! });
    return () => register(id, null);
  }, [id, register]);

  return (
    <div
      className={`chip${running ? "" : " chip--stopped"}`}
      onClick={onToggle}
      onContextMenu={(e) => {
        e.preventDefault();
        onReset();
      }}
    >
      <div className="chip__head">
        <span className="chip__label">{label}</span>
        <span className="chip__count" ref={countRef}>
          —
        </span>
      </div>
      <div className="chip__track">
        <div className="chip__fill" ref={fillRef} />
        <div className="chip__glow" ref={glowRef} />
      </div>
    </div>
  );
}
