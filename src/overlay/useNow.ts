import { useEffect, useState } from "react";

/**
 * The cheap app-level wall-clock tick that drives the persistent countdowns (Cooldowns and
 * recurring chores). A plain `setInterval` at a coarse cadence — NOT the 60fps rAF loop the
 * skill timers use — re-rendering its consumer each tick so derived readouts keep counting on
 * every overlay screen. Returns the current `Date.now()`; the pure engines turn that into
 * remaining time. Defaults to one second, which is all h/m/s and day-scale readouts need.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
