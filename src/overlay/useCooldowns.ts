import { useCallback, useEffect, useRef } from "react";
import { readout, readyCrossings, remainingMs, type CooldownDef, type RunningCooldown } from "../engine/cooldown";
import { resolveDisplayName } from "../engine/contentCatalog";
import { playCooldownReady } from "./audio";
import { useNow } from "./useNow";
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
  const now = useNow(); // the shared 1s app-level tick (overlay/useNow)

  const { config, beginCooldown, reCooldown, stopCooldown, tuneCooldown, dupeCooldown } = cfg;
  const locale = config.locale; // live locale from persisted config (slice #83)
  const catalog: CooldownDef[] = config.cooldowns;

  // Best-effort ready cue (ADR-0002): compare each observation of the running set against
  // the previous one and chime on any *live* zero-crossing. The ref seeds with the mount
  // snapshot, so a cooldown already past zero on restore has no prior not-ready tick and
  // stays silent. `readyCrossings` keys on running-instance identity, so a sticky `Ready`
  // never re-fires and a restart re-arms. Watching `config.running` too (not just `now`)
  // means a start/clear gesture can't sneak a phantom crossing past the comparison.
  const prevObs = useRef<{ running: RunningCooldown[]; now: number }>({ running: config.running, now });
  useEffect(() => {
    const prev = prevObs.current;
    if (readyCrossings(prev.running, prev.now, config.running, now).length > 0) playCooldownReady();
    prevObs.current = { running: config.running, now };
  }, [now, config.running]);

  const pills: CooldownPill[] = config.running.map((r) => {
    const def = catalog.find((d) => d.id === r.defId);
    const rem = remainingMs(r, now);
    return {
      defId: r.defId,
      tag: def?.tag ?? "?",
      // Seeded dungeons resolve their name per-locale (PRD #77, slice #83 wires up the live locale);
      // a user-added cooldown (no catalogKey) renders its free-text name verbatim.
      name: def ? resolveDisplayName(def, locale) : r.defId,
      readout: readout(rem),
      ready: rem <= 0,
    };
  });

  const start = useCallback((defId: string) => beginCooldown(defId, Date.now()), [beginCooldown]);
  const restart = useCallback((defId: string) => reCooldown(defId, Date.now()), [reCooldown]);

  return { pills, catalog, start, restart, clear: stopCooldown, tune: tuneCooldown, duplicate: dupeCooldown };
}
