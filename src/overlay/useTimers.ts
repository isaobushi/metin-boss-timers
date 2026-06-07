import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeTimer,
  progressAt,
  remainingMsAt,
  reset as resetTimer,
  tick,
  toggle as toggleTimer,
  trigger as triggerTimer,
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
 *
 * The timer map is reconciled against the current `inits` (keyed by id): new skills
 * get a fresh timer, removed skills are dropped, and a changed duration/pitch/label
 * is applied in place. Switching boss swaps the whole id set, so the outgoing boss's
 * timers are dropped and the incoming boss's are created fresh (stopped, full) — which
 * is exactly the "switching boss stops and resets all timers" rule, for free.
 */
export function useTimers(inits: TimerInit[]) {
  const timers = useRef<Map<string, Timer>>(new Map());
  const els = useRef<Map<string, ChipEls>>(new Map());
  const [, force] = useState(0);

  // Reconcile on any change to the init set (ids/durations/labels/pitches). A fresh
  // timer for a new boss's skill is stopped at a full cycle, so a boss switch resets.
  const sig = inits.map((i) => `${i.id}:${i.durationMs}:${i.pitch}:${i.label}`).join("|");
  useEffect(() => {
    const map = timers.current;
    const wanted = new Set<string>();
    for (const i of inits) {
      wanted.add(i.id);
      const ex = map.get(i.id);
      if (!ex) {
        map.set(i.id, makeTimer(i));
      } else if (ex.durationMs !== i.durationMs || ex.pitch !== i.pitch || ex.label !== i.label) {
        // A running timer keeps draining (new duration takes effect on its next loop);
        // a stopped one snaps to a fresh full cycle at the new duration.
        map.set(i.id, ex.running ? { ...ex, label: i.label, pitch: i.pitch, durationMs: i.durationMs } : makeTimer(i));
      }
    }
    for (const id of [...map.keys()]) if (!wanted.has(id)) map.delete(id);
    // No re-render needed: the render that changed `inits` already painted the new
    // chip set, and reconcile only seeds/updates the ref map (running state unchanged).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

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

  // The hotkey action: reset-and-start from any state, so a fired shortcut always
  // re-arms the skill (unlike onToggle). Stable, so the hotkey effect can depend on it.
  const onTrigger = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) timers.current.set(id, triggerTimer(t, Date.now()));
    force((x) => x + 1);
  }, []);

  // Derived from inits so a just-selected boss renders its chips immediately; the
  // running flag comes from the timer map (absent until the reconcile effect runs).
  const views: ChipView[] = inits.map((i) => ({
    id: i.id,
    label: i.label,
    running: timers.current.get(i.id)?.running ?? false,
  }));

  return { views, register, onToggle, onReset, onTrigger };
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
