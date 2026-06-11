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
  addCharacter,
  renameCharacter,
  deleteCharacter,
  selectCharacter,
  classifyCharacter,
  type Boss,
  type CharacterDraft,
  type Config,
} from "../engine/config";
import type { SoundId } from "../engine/sounds";
import { allows, DEV_ENTITLEMENT, type Entitlement, type Mutation } from "../engine/entitlement";
import { deserialize, serialize } from "../engine/persist";
import { exportConfig, importConfig } from "../engine/backup";
import { loadPersisted, savePersisted } from "./configStore";
import { resolveLaunchEntitlement } from "./entitlementSource";
import { broadcastConfig, subscribeConfig } from "./configSync";
import type { Locale } from "../engine/contentCatalog";
import { readOsLocale } from "./osLocale";

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
  // The paid state driving every cap (PRD #48). Seeded with the dev default for the first synchronous
  // render, then replaced on mount by the real `storeLicense` adapter, which reads the OS-cached Store
  // license + grace memory (issue #55). Still settable here so the gate is exercisable in dev. The
  // create paths below consult `allows` before mutating — the seam that keeps caps from being
  // retrofitted (issue #53).
  const [entitlement, setEntitlement] = useState<Entitlement>(DEV_ENTITLEMENT);
  // The last cap-hit (#56): which capped mutation was just refused, so the UI can show a nudge naming
  // what Pro unlocks. null = no pending nudge. Set by the blocked create paths, cleared on dismiss.
  const [capNudge, setCapNudge] = useState<Mutation | null>(null);
  // Gate saves until the on-disk config has been read, so the initial in-memory
  // defaults can never clobber a stored config before it loads.
  const [hydrated, setHydrated] = useState(false);
  // True for exactly the next change effect when that change came from the other window.
  const skipBroadcast = useRef(false);

  useEffect(() => {
    let alive = true;
    loadPersisted().then(async (raw) => {
      if (!alive) return;
      setConfig(deserialize(raw)); // null/corrupt → shipped defaults; ids seeded past max
      setHydrated(true);
      // OS-locale seed (slice #83): when no locale was persisted — a new install, or an upgrade from
      // a pre-#83 payload — ask the OS and patch just the locale. Runs AFTER hydration so first paint
      // never waits on the (slice 5) Tauri IPC round-trip, and as a functional updater so an edit or
      // cross-window broadcast landing during the await is preserved: only the locale field is written.
      // The seeded value persists via the normal change effect, so this runs at most once per install.
      // `readOsLocale` (real plugin-os since slice #85) never throws: it maps IPC failure — e.g.
      // the web demo, which has no Tauri backend — to the English default inside the seam.
      // KNOWN CAVEAT (accepted): a blob written by a #83/#84 dev build carries the stub-seeded
      // locale "en", indistinguishable from a user choice, so the OS is never re-asked — those
      // pre-release installs (dev machines only; nothing shipped) switch manually in Settings.
      // Every post-#85 install hits the real OS read on first run.
      if (!raw || !(raw as Record<string, unknown>).locale) {
        const osLocale = await readOsLocale();
        if (!alive) return; // unmounted during the await — don't write into a dead instance
        setConfig((c) => ({ ...c, locale: osLocale }));
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Resolve the real paid state at launch from the OS-cached Store license (issue #55), replacing the
  // dev seed. One-shot on mount; the adapter is best-effort (resolves to `never`/Lite, never throws).
  useEffect(() => {
    let alive = true;
    resolveLaunchEntitlement().then((e) => {
      if (alive) setEntitlement(e);
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
    // Seam: refuse a new boss when over the tier cap — raise the cap-hit nudge (#56) and return the
    // existing last boss so the caller never navigates to a boss that wasn't created. Always allowed
    // under a Pro state.
    if (!allows(entitlement, config, "addBoss")) {
      setCapNudge("addBoss");
      return config.bosses[config.bosses.length - 1].id;
    }
    const next = addBoss(config);
    setConfig(next);
    return next.bosses[next.bosses.length - 1].id;
  }, [config, entitlement]);

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
  // Seam: both add into the active character's shared 3-reminder pool, so each consults `allows` first
  // (no-op when capped). Routine and Elapsable item draw from the SAME pool. Always allowed under
  // dev `subscribed`.
  const createRecurring = useCallback(() => {
    if (!allows(entitlement, config, "addReminder")) return setCapNudge("addReminder");
    setConfig((c) => addRecurring(c, "deadline"));
  }, [config, entitlement]);
  // The ROUTINE section's add (#38) — same CRUD path, gate kind. Rename/duration/remove are
  // kind-agnostic, so both sections share editRecurringName/Duration + deleteRecurring.
  const createRoutine = useCallback(() => {
    if (!allows(entitlement, config, "addReminder")) return setCapNudge("addReminder");
    setConfig((c) => addRecurring(c, "gate"));
  }, [config, entitlement]);
  const editRecurringName = useCallback(
    (defId: string, name: string) => setConfig((c) => renameRecurring(c, defId, name)),
    [],
  );
  const editRecurringDuration = useCallback(
    (defId: string, durationMs: number) => setConfig((c) => setRecurringDuration(c, defId, durationMs)),
    [],
  );
  const deleteRecurring = useCallback((defId: string) => setConfig((c) => removeRecurring(c, defId)), []);

  // Character actions (PRD #47, create flow #54). `createCharacter` mirrors `createBoss`: it runs the
  // transform on this render's `config` so it can hand the new id back synchronously — the caller
  // lands the dock on the freshly-created character. Seam: refuse over the tier cap — raise the cap-hit
  // nudge (#56) and return null so the caller stays put. Always allowed under a Pro state.
  const createCharacter = useCallback(
    (draft: CharacterDraft): string | null => {
      if (!allows(entitlement, config, "addCharacter")) {
        setCapNudge("addCharacter");
        return null;
      }
      const next = addCharacter(config, draft);
      setConfig(next);
      return next.characters[next.characters.length - 1].id;
    },
    [config, entitlement],
  );
  // Switch which character the dock shows — swaps only the recurring surface (bosses/cooldowns are global).
  const switchCharacter = useCallback((id: string) => setConfig((c) => selectCharacter(c, id)), []);
  const editCharacterName = useCallback((id: string, name: string) => setConfig((c) => renameCharacter(c, id, name)), []);
  // The ✎ edit flow: set/change a character's name + class. Changing the class re-seeds its skill books
  // (keeping deadline items); a name-only edit just renames. Classifies the unclassified migrated default.
  const editCharacter = useCallback(
    (id: string, draft: CharacterDraft) => setConfig((c) => classifyCharacter(c, id, draft)),
    [],
  );
  const removeCharacter = useCallback((id: string) => setConfig((c) => deleteCharacter(c, id)), []);

  const selectBoss = useCallback((id: string | null) => setActiveBossId(id), []);

  // Wipe all customization back to the shipped defaults (persisted by the save effect).
  const resetConfig = useCallback(() => {
    setConfig(makeConfig());
    setActiveBossId(null);
  }, []);

  // Switch the active locale — persisted + cross-window synced like any other config edit.
  const changeLocale = useCallback((locale: Locale) => setConfig((c) => ({ ...c, locale })), []);

  // Dismiss the cap-hit nudge (#56) — the user closed it or opened the subscribe screen.
  const dismissNudge = useCallback(() => setCapNudge(null), []);

  // Export/import (#56). Export serializes the live config to a portable backup string. Import parses
  // one back and replaces the config wholesale — returning false (no change) if the text isn't a valid
  // backup, so the UI can warn instead of wiping. Over-cap data imports intact; the gate freezes the
  // excess as a view (no data dropped here).
  const exportBackup = useCallback((): string => exportConfig(config), [config]);
  const applyImport = useCallback((text: string): boolean => {
    const next = importConfig(text);
    if (!next) return false;
    setConfig(next);
    setActiveBossId(null);
    return true;
  }, []);

  const activeBoss: Boss | undefined = bossById(config, activeBossId);

  return {
    config,
    hydrated,
    // The current paid state + its dev setter — read by cap-aware UI (nudges, frozen rendering) and
    // set on mount by the `storeLicense` adapter. The create paths above already gate on it.
    entitlement,
    setEntitlement,
    // The pending cap-hit nudge (#56) + its dismiss; the export/import backup helpers.
    capNudge,
    dismissNudge,
    exportBackup,
    applyImport,
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
    createCharacter,
    switchCharacter,
    editCharacterName,
    editCharacter,
    removeCharacter,
    selectBoss,
    resetConfig,
    changeLocale,
  };
}
