import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeTimer,
  progressAt,
  remainingMsAt,
  reset as resetTimer,
  tick,
  toggle as toggleTimer,
  type Timer,
  type TimerInit,
} from "../engine/timer";
import { urgencyColor } from "./colors";
import { playCue } from "./audio";

// The DOM nodes a chip hands to the render loop so the loop can paint it imperatively
// each frame (transform/colour/count), keeping React out of the per-frame hot path.
export type ChipEls = { fill: HTMLDivElement; glow: HTMLDivElement; count: HTMLSpanElement };

// Pixels of travel for the leading-edge glow — tied to the fixed track width in
// overlay.css. LOCKED with the rendering decision: the fill is `transform: scaleX()`
// and the glow `translateX`, never `width` (animating `width` froze frame-to-frame in
// real Chrome under rAF; see src/proto/NOTES.md). If the track ever flexes to the
// window width, this must become a *measured* value, not a constant.
const TRACK_W = 268;

export type ChipView = { id: string; label: string; running: boolean };

/**
 * Owns the set of timers and the single render loop. One rAF tick per frame advances
 * every timer (the engine emits cues, which we hand to the audio adapter) and paints
 * each chip straight to the DOM. React only re-renders on running-state changes (for
 * the dimmed style), never per frame.
 */
export function useTimers(inits: TimerInit[]) {
  const timers = useRef<Map<string, Timer>>(null as unknown as Map<string, Timer>);
  if (timers.current === null) {
    timers.current = new Map(inits.map((i) => [i.id, makeTimer(i)]));
  }
  const els = useRef<Map<string, ChipEls>>(new Map());
  const [, force] = useState(0);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const now = Date.now();
      for (const [id, t] of timers.current) {
        const { timer, cues } = tick(t, now);
        if (timer !== t) timers.current.set(id, timer);
        for (const cue of cues) playCue(cue, timer.pitch);
        paint(els.current.get(id), timer, now);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // stable so the chip's register effect doesn't re-run every render
  const register = useCallback((id: string, e: ChipEls | null) => {
    if (e) els.current.set(id, e);
    else els.current.delete(id);
  }, []);

  const onToggle = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) timers.current.set(id, toggleTimer(t, Date.now()));
    force((x) => x + 1); // re-render so the dimmed style tracks running state
  }, []);

  const onReset = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) timers.current.set(id, resetTimer(t, Date.now()));
    force((x) => x + 1);
  }, []);

  const views: ChipView[] = inits.map((i) => {
    const t = timers.current.get(i.id)!;
    return { id: t.id, label: t.label, running: t.running };
  });

  return { views, register, onToggle, onReset };
}

function paint(e: ChipEls | undefined, t: Timer, now: number) {
  if (!e) return;
  const p = progressAt(t, now);
  const color = urgencyColor(p);
  e.fill.style.transform = `scaleX(${p})`;
  e.fill.style.backgroundColor = color;
  e.glow.style.transform = `translateX(${p * TRACK_W}px)`;
  e.glow.style.color = color;
  e.count.textContent = String(Math.ceil(remainingMsAt(t, now) / 1000));
}
