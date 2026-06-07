import { useCallback, useEffect, useState } from "react";
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
  type Boss,
  type Config,
} from "../engine/config";
import { deserialize, serialize } from "../engine/persist";
import { loadPersisted, savePersisted } from "./configStore";

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
 */
export function useConfig() {
  const [config, setConfig] = useState<Config>(makeConfig);
  const [activeBossId, setActiveBossId] = useState<string | null>(null);
  // Gate saves until the on-disk config has been read, so the initial in-memory
  // defaults can never clobber a stored config before it loads.
  const [hydrated, setHydrated] = useState(false);

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

  useEffect(() => {
    if (!hydrated) return;
    void savePersisted(serialize(config));
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
  const deleteSkill = useCallback(
    (bossId: string, skillId: string) => setConfig((c) => removeSkill(c, bossId, skillId)),
    [],
  );
  const editSkillHotkey = useCallback(
    (bossId: string, skillId: string, hotkey: string | undefined) =>
      setConfig((c) => setSkillHotkey(c, bossId, skillId, hotkey)),
    [],
  );

  const selectBoss = useCallback((id: string | null) => setActiveBossId(id), []);

  // Wipe all customization back to the shipped defaults (persisted by the save effect).
  const resetConfig = useCallback(() => {
    setConfig(makeConfig());
    setActiveBossId(null);
  }, []);

  const activeBoss: Boss | undefined = bossById(config, activeBossId);

  return {
    config,
    activeBoss,
    createBoss,
    editBossName,
    removeBoss,
    createSkill,
    editSkillName,
    editSkillDuration,
    deleteSkill,
    editSkillHotkey,
    selectBoss,
    resetConfig,
  };
}
