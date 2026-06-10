import { useCallback, useEffect, useRef, useState } from "react";
import {
  addBoss,
  addSkill,
  bossById,
  deleteBoss,
  makeConfig,
  removeSkill,
  renameBoss,
  renameSkill,
  setSkillDuration,
  setSkillHotkey,
  setSkillSound,
  startCooldown,
  restartCooldown,
  setCooldownDuration,
  duplicateCooldown,
  addCooldown,
  renameCooldown,
  retagCooldown,
  removeCooldown,
  clearCooldown,
  markRecurring,
  markRead,
  setRung,
  addRecurring,
  renameRecurring,
  setRecurringDuration,
  removeRecurring,
  type Boss,
  type Config,
} from "../engine/config";
import type { SoundId } from "../engine/sounds";
import { deserialize, serialize } from "../engine/persist";
import { loadPersisted, savePersisted } from "./configStore";
import { broadcastConfig, subscribeConfig } from "./configSync";

/**
 * Thin React control layer over the pure config model. It holds the `Config` and the
 * active-boss selection in state and exposes edit actions; every action just runs the
 * matching pure transform. Persistence is wired here (load on mount, save on change,
 * reset-to-defaults), as is the hotkey binding (set/clear); OS registration of those
 * bindings is the timer screen's job (overlay/hotkeys.ts).
 *
 * Edits go through functional `setConfig` updaters (always current, stable identity).
 * `createBoss` is the exception: it runs the transform on this render's `config` so it
 * can hand the new id back synchronously — the caller jumps straight into that boss's
 * settings.
 *
 * Runs in both windows (overlay + settings), kept in sync via configSync: a local edit
 * persists and broadcasts; a broadcast from the other window is applied as state only.
 * The `skipBroadcast` ref breaks the echo — a remote-applied change neither re-persists
 * (it's already on disk) nor re-broadcasts (which would ping-pong forever).
 */
export function useConfig() {
  const [config, setConfig] = useState<Config>(makeConfig);
  const [activeBossId, setActiveBossId] = useState<string | null>(null);
  // Gate saves until the on-disk config has been read, so the initial in-memory
  // defaults can never clobber a stored config before it loads.
  const [hydrated, setHydrated] = useState(false);
  // True for exactly the next change effect when that change came from the other window.
  const skipBroadcast = useRef(false);

  useEffect(() => {
    let alive = true;
    loadPersisted().then((raw) => {
      if (!alive) return;
      setConfig(deserialize(raw)); // null/corrupt → shipped defaults; ids seeded past max
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Apply edits the other window broadcast — state only; don't re-persist or re-broadcast.
  useEffect(
    () => subscribeConfig((payload) => {
      skipBroadcast.current = true;
      setConfig(deserialize(payload));
    }),
    [],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (skipBroadcast.current) {
      skipBroadcast.current = false; // remote-applied: already on disk, and echoing would loop
      return;
    }
    const payload = serialize(config);
    void savePersisted(payload);
    broadcastConfig(payload);
  }, [config, hydrated]);

  const createBoss = useCallback((): string => {
    const next = addBoss(config);
    setConfig(next);
    return next.bosses[next.bosses.length - 1].id;
  }, [config]);

  const editBossName = useCallback((id: string, name: string) => setConfig((c) => renameBoss(c, id, name)), []);

  const removeBoss = useCallback((id: string) => {
    setConfig((c) => deleteBoss(c, id));
    // if the active boss vanished, drop back to the select screen's default
    setActiveBossId((cur) => (cur === id ? null : cur));
  }, []);

  const createSkill = useCallback((bossId: string) => setConfig((c) => addSkill(c, bossId)), []);
  const editSkillName = useCallback(
    (bossId: string, skillId: string, label: string) => setConfig((c) => renameSkill(c, bossId, skillId, label)),
    [],
  );
  const editSkillDuration = useCallback(
    (bossId: string, skillId: string, durationMs: number) =>
      setConfig((c) => setSkillDuration(c, bossId, skillId, durationMs)),
    [],
  );
  const editSkillSound = useCallback(
    (bossId: string, skillId: string, soundId: SoundId) =>
      setConfig((c) => setSkillSound(c, bossId, skillId, soundId)),
    [],
  );
  const deleteSkill = useCallback(
    (bossId: string, skillId: string) => setConfig((c) => removeSkill(c, bossId, skillId)),
    [],
  );
  const editSkillHotkey = useCallback(
    (bossId: string, skillId: string, hotkey: string | undefined) =>
      setConfig((c) => setSkillHotkey(c, bossId, skillId, hotkey)),
    [],
  );

  // Cooldown actions — like the skill edits, each just runs the matching pure transform
  // through setConfig, so the running set persists and cross-window syncs for free. `now`
  // is supplied by the caller (the 1s tick in useCooldowns), keeping this layer clock-free.
  const beginCooldown = useCallback(
    (defId: string, now: number, durationMs?: number) => setConfig((c) => startCooldown(c, defId, now, durationMs)),
    [],
  );
  const reCooldown = useCallback(
    (defId: string, now: number) => setConfig((c) => restartCooldown(c, defId, now)),
    [],
  );
  const stopCooldown = useCallback((defId: string) => setConfig((c) => clearCooldown(c, defId)), []);
  // Velocity-wheel tuning in the + picker: persist the tuned catalog duration so it sticks
  // and cross-window syncs like any other edit. The wheel math (engine/cooldownTuning) is
  // the picker's; this only commits the result.
  const tuneCooldown = useCallback(
    (defId: string, durationMs: number) => setConfig((c) => setCooldownDuration(c, defId, durationMs)),
    [],
  );
  // Add another copy of a definition (the same boss spawns in two places); the pure action
  // numbers it off the base name. Persists and cross-window syncs like any other edit.
  const dupeCooldown = useCallback((defId: string) => setConfig((c) => duplicateCooldown(c, defId)), []);

  // Catalog CRUD for the settings Cooldowns section (issue #28): add a blank definition,
  // rename it (which re-derives its tag), override the tag, set its duration on the h/m
  // control, or remove it. Each rides the same setConfig → persist + configSync path.
  const createCooldown = useCallback(() => setConfig((c) => addCooldown(c)), []);
  const editCooldownName = useCallback(
    (defId: string, name: string) => setConfig((c) => renameCooldown(c, defId, name)),
    [],
  );
  const editCooldownTag = useCallback(
    (defId: string, tag: string) => setConfig((c) => retagCooldown(c, defId, tag)),
    [],
  );
  // The h/m duration control commits through the same clamped catalog transform the
  // velocity wheel uses (`setCooldownDuration`, [1m, 12h]).
  const editCooldownDuration = useCallback(
    (defId: string, durationMs: number) => setConfig((c) => setCooldownDuration(c, defId, durationMs)),
    [],
  );
  const deleteCooldown = useCallback((defId: string) => setConfig((c) => removeCooldown(c, defId)), []);

  // Recurring action — like the cooldown gestures, just runs the pure transform through
  // setConfig, so the running set persists and cross-window syncs for free. `now` is the
  // caller's (the 1s tick in useRecurring). markDone doubles as the start gesture.
  const markRecurringDone = useCallback(
    (defId: string, now: number) => setConfig((c) => markRecurring(c, defId, now)),
    [],
  );
  // The ladder read-outcome gesture (#45): ✓ (success) restamps the gate AND advances the rank, ✗
  // (fail) restamps the gate only. Same setConfig → persist + configSync path as every other edit.
  const markReadOutcome = useCallback(
    (defId: string, now: number, success: boolean) => setConfig((c) => markRead(c, defId, now, success)),
    [],
  );
  // The set-rung curtain (#46): snap a ladder def's rank to a chosen rung's entry threshold,
  // writing the progress map only (the daily gate is untouched). Also the misclick-correction path.
  const setLadderRung = useCallback(
    (defId: string, rungLabel: string) => setConfig((c) => setRung(c, defId, rungLabel)),
    [],
  );

  // Recurring catalog CRUD for the settings Items section (issue #37): add a blank deadline
  // definition, rename it, set its day-scale duration, or remove it. Mirrors the cooldown catalog
  // CRUD (minus the tag — recurring items carry none); each rides the same setConfig → persist +
  // configSync path.
  const createRecurring = useCallback(() => setConfig((c) => addRecurring(c, "deadline")), []);
  // The ROUTINE section's add (#38) — same CRUD path, gate kind. Rename/duration/remove are
  // kind-agnostic, so both sections share editRecurringName/Duration + deleteRecurring.
  const createRoutine = useCallback(() => setConfig((c) => addRecurring(c, "gate")), []);
  const editRecurringName = useCallback(
    (defId: string, name: string) => setConfig((c) => renameRecurring(c, defId, name)),
    [],
  );
  const editRecurringDuration = useCallback(
    (defId: string, durationMs: number) => setConfig((c) => setRecurringDuration(c, defId, durationMs)),
    [],
  );
  const deleteRecurring = useCallback((defId: string) => setConfig((c) => removeRecurring(c, defId)), []);

  const selectBoss = useCallback((id: string | null) => setActiveBossId(id), []);

  // Wipe all customization back to the shipped defaults (persisted by the save effect).
  const resetConfig = useCallback(() => {
    setConfig(makeConfig());
    setActiveBossId(null);
  }, []);

  const activeBoss: Boss | undefined = bossById(config, activeBossId);

  return {
    config,
    hydrated,
    activeBoss,
    createBoss,
    editBossName,
    removeBoss,
    createSkill,
    editSkillName,
    editSkillDuration,
    editSkillSound,
    deleteSkill,
    editSkillHotkey,
    beginCooldown,
    reCooldown,
    stopCooldown,
    tuneCooldown,
    dupeCooldown,
    createCooldown,
    editCooldownName,
    editCooldownTag,
    editCooldownDuration,
    deleteCooldown,
    markRecurringDone,
    markReadOutcome,
    setLadderRung,
    createRecurring,
    createRoutine,
    editRecurringName,
    editRecurringDuration,
    deleteRecurring,
    selectBoss,
    resetConfig,
  };
}
