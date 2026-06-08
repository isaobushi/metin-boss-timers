import { useCallback, useEffect, useState } from "react";
import { readout, remainingMs, type CooldownDef } from "../engine/cooldown";
import type { useConfig } from "./useConfig";

/** A running cooldown projected for the strip: identity, labels, and the live readout. */
export type CooldownPill = {
  defId: string;
  tag: string;
  name: string;
  readout: string;
  ready: boolean;
};

/**
 * The cooldown control layer for the overlay. Owns a single app-level 1-second tick
 * (a plain `setInterval`, NOT the rAF skill-timer loop — cooldowns are coarse h/m/s and
 * never need 60fps), which re-derives every running pill's readout each second so the
 * strip keeps counting on every overlay screen. The definitions and running set live in
 * the persisted `Config`; this hook only adds the clock and the start/restart/clear
 * gestures, each stamping `Date.now()` at the moment of the click.
 */
export function useCooldowns(cfg: ReturnType<typeof useConfig>) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { config, beginCooldown, reCooldown, stopCooldown } = cfg;
  const catalog: CooldownDef[] = config.cooldowns;

  const pills: CooldownPill[] = config.running.map((r) => {
    const def = catalog.find((d) => d.id === r.defId);
    const rem = remainingMs(r, now);
    return {
      defId: r.defId,
      tag: def?.tag ?? "?",
      name: def?.name ?? r.defId,
      readout: readout(rem),
      ready: rem <= 0,
    };
  });

  const start = useCallback((defId: string) => beginCooldown(defId, Date.now()), [beginCooldown]);
  const restart = useCallback((defId: string) => reCooldown(defId, Date.now()), [reCooldown]);

  return { pills, catalog, start, restart, clear: stopCooldown };
}
