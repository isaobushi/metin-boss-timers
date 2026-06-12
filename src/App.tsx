// v1 overlay — the compact, always-on-top play surface. Its home is the DOCK shell (ADR-0003):
// one dense status line whose segments route to the existing surfaces. ⚔ opens the active boss's
// TIMERS (or the SKILLS picker if none is active), ⏱ opens the COOLDOWNS strip, ⚙ the settings
// window; ⧗/✓ expand inline accordions (inert until #36+). All config editing lives in a separate
// settings window (overlay/settingsWindow.ts → settings/SettingsApp.tsx); edits there reflect here
// live via configSync. Config flows through useConfig, persisted to disk; per-skill global hotkeys
// are registered while a boss's timer screen is active.
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { DockBar, type DockSegment, type DockSpotlight } from "./overlay/DockBar";
import { CharacterSwitcher } from "./overlay/CharacterSwitcher";
import { CharacterWizard } from "./overlay/CharacterWizard";
import { TourCard } from "./overlay/TourCard";
import { BossSelect } from "./overlay/BossSelect";
import { TimerScreen } from "./overlay/TimerScreen";
import { SequenceScreen } from "./overlay/SequenceScreen";
import SettingsApp from "./settings/SettingsApp";
import { DemoScene } from "./DemoScene";
import { useConfig } from "./overlay/useConfig";
import { useCooldowns } from "./overlay/useCooldowns";
import { useRecurring } from "./overlay/useRecurring";
import { ExpiringAccordion } from "./overlay/ExpiringAccordion";
import { RoutineAccordion } from "./overlay/RoutineAccordion";
import { CooldownStrip } from "./overlay/CooldownStrip";
import { CooldownPicker } from "./overlay/CooldownPicker";
import { type PurchasePhase, SubscribeScreen } from "./overlay/SubscribeScreen";
import { UpgradeBanner } from "./overlay/UpgradeBanner";
import { CapNudge } from "./overlay/CapNudge";
import { startTrial, subscribe, type Plan } from "./overlay/purchaseFlow";
import { allows, partition, type Entitlement } from "./engine/entitlement";
import { shouldRunTour } from "./engine/config";
import { driveForStep } from "./engine/tourDrive";
import type { TourStep } from "./engine/tourSteps";
import type { SettingsTab } from "./engine/settingsLink";
import { useOverlayPosition } from "./overlay/useOverlayPosition";
import { useOverlayAutosize } from "./overlay/useOverlayAutosize";
import { openSettingsWindow } from "./overlay/settingsWindow";
import { emitTransient, subscribeTransient } from "./overlay/transientSync";
import { quitApp } from "./overlay/quitApp";
import { unlockAudio } from "./overlay/audio";

// In a plain browser the overlay floats over a mock game scene (the live demo); the real
// desktop app is transparent over the actual game, so the scene is never mounted there.
const inBrowser = !isTauri();

// The dock bar is always pinned on top. Two independent things hang below it (ADR-0003, variant A):
//   • `panel` — the one exclusive tool panel expanded below (null = none). The skills tool has three
//     sub-views (the picker, a boss's timers, the Templum sequence); items/routine are single panels.
//   • `cooldownsPinned` — the cooldown strip rides as a *pinned* strip above the panel, so it can be
//     open alongside the boss timers (the one pairing that coexists). ⏱ toggles it.
// ⚙ opens a window, so it isn't tracked here.
type Panel = "skills" | "timers" | "sequence" | "items" | "routine" | null;

export default function App() {
  const cfg = useConfig();
  const cd = useCooldowns(cfg);
  const rec = useRecurring(cfg);
  const [panel, setPanel] = useState<Panel>(null);
  // The character wizard's open state, separate from `panel` so it can override any tool panel: null =
  // closed, { id: null } = create a new character, { id } = edit/classify that character.
  const [charEdit, setCharEdit] = useState<{ id: string | null } | null>(null);
  // The cooldown strip is pinned independently of `panel`, so it coexists with the boss timers.
  const [cooldownsPinned, setCooldownsPinned] = useState(false);
  // Whether the add-cooldown picker menu is open (controlled so ⏱ can open it directly).
  const [addOpen, setAddOpen] = useState(false);
  // Browser only: settings renders inline (a modal over the still-mounted overlay) rather
  // than a second OS window/tab. Tauri spawns a real settings window, so this stays false.
  const [showSettings, setShowSettings] = useState(false);
  // Browser only: the tab a deep link (#72) lands the inline modal on at mount; the Tauri
  // window carries its landing tab in the URL hash instead (settingsWindow.ts owns that).
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  // The in-app subscribe screen (#58), shown as a modal over the overlay. Opened by the upgrade banner
  // (and, later, the #56 cap-hit nudges).
  const [showSubscribe, setShowSubscribe] = useState(false);
  // The tour's spotlight glyph (#71) — App's mirror of the active beat's dockSegment (the card owns
  // the step itself; onStepChange reports it). Null whenever no beat rings a glyph, including always
  // outside the tour. Assigning the engine's TourSegment to DockSpotlight here is the deliberate
  // compile-time seam between the duplicated unions (engine must not import overlay).
  const [tourSpot, setTourSpot] = useState<DockSpotlight>(null);
  // Tour replays requested by settings' "Show me around" row (#73), arriving over the transient
  // bus — the reverse direction of settings-navigate. Session-only state OR-ed into `tourActive`,
  // so the replay path never touches the persisted `hasSeenTour` gate (a crash mid-replay must
  // not resurrect first-run). A counter rather than a boolean: it keys TourCard, so a request
  // landing mid-tour remounts the card and restarts from beat 1 instead of being swallowed.
  const [replayNonce, setReplayNonce] = useState(0);
  useEffect(
    () =>
      subscribeTransient((msg) => {
        if (msg.kind === "tour-replay") setReplayNonce((n) => n + 1);
      }),
    [],
  );

  // Restore the overlay's last position and persist it as it's dragged; in the browser the
  // returned ref turns the .overlay element into a draggable floating panel.
  const overlayRef = useOverlayPosition();
  // Size the (Tauri) window to fit the content column so full names show without clipping; no-op in
  // the browser, where the .overlay element shrink-wraps its content via CSS.
  const contentRef = useRef<HTMLDivElement>(null);
  useOverlayAutosize(contentRef);

  // Browsers/webviews gate audio behind a user gesture — unlock on the first interaction.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // ⚙ opens the real settings window under Tauri, or the inline modal in the browser; the tour's
  // "make it yours" nudge (#72) passes a landing tab. Neither exits the tour (decided on #96's
  // deferral): settings is its own surface, the card holds its beat. The browser split mirrors
  // the Tauri adapter's: a fresh modal mounts on `settingsTab` (its useState seed — prop changes
  // after mount are ignored by design), one already showing re-tabs over the transient bus (a
  // BroadcastChannel delivers to sibling instances in the same document).
  const openSettingsTo = useCallback(
    (tab?: SettingsTab) => {
      if (isTauri()) {
        openSettingsWindow(tab);
        return;
      }
      if (showSettings) {
        if (tab) emitTransient({ kind: "settings-navigate", tab });
        return;
      }
      setSettingsTab(tab ?? null);
      setShowSettings(true);
    },
    [showSettings],
  );
  // Zero-arg wrapper for the dock's ⚙ (its onClick must not leak the MouseEvent as a tab).
  const openSettings = useCallback(() => openSettingsTo(), [openSettingsTo]);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  // The subscribe flow (#58). On Windows the actions run the REAL Store purchase dialog and the
  // result's entitlement comes from re-reading the OS-cached license (the #55 adapter loop); in
  // Store-less runs (web demo, macOS dev) purchaseFlow short-circuits to the granted tier. Either
  // way the setter reflects it so Pro unlocks at runtime as the screen promises, and the unlock is
  // broadcast — the settings surface holds its own entitlement state (separate window under Tauri).
  // `phase` locks the screen's actions while the Store dialog is up and surfaces a Store failure;
  // a cancelled dialog is the user's own deliberate act, so it stays quiet (review of this PR).
  const { setEntitlement } = cfg;
  const [purchasePhase, setPurchasePhase] = useState<PurchasePhase>("idle");
  const applyPurchase = useCallback(
    async (run: Promise<{ ok: true; entitlement: Entitlement } | { ok: false; reason: string }>) => {
      setPurchasePhase("busy");
      const result = await run;
      if (result.ok) {
        setEntitlement(result.entitlement);
        emitTransient({ kind: "entitlement-changed", entitlement: result.entitlement });
        setPurchasePhase("idle");
        setShowSubscribe(false);
      } else {
        setPurchasePhase(result.reason === "error" ? "error" : "idle");
      }
    },
    [setEntitlement],
  );
  const onStartTrial = useCallback(() => void applyPurchase(startTrial()), [applyPurchase]);
  const onSubscribe = useCallback((plan: Plan) => void applyPurchase(subscribe(plan)), [applyPurchase]);
  // A purchase completed in the OTHER surface (the settings window) unlocks this one live too.
  useEffect(
    () =>
      subscribeTransient((msg) => {
        if (msg.kind === "entitlement-changed") setEntitlement(msg.entitlement);
      }),
    [setEntitlement],
  );

  // First-run / empty-roster: no character exists (e.g. the only one was deleted). The create wizard
  // takes over the panel and can't be dismissed — there's nothing to fall back to until one exists.
  const firstRun = cfg.hydrated && cfg.config.characters.length === 0;
  const showWizard = firstRun || charEdit != null;
  // The first-run tour (#68) holds the same exclusive slot right after the wizard. While either gate
  // holds it, the tool panels are shadowed — so their glyphs must not read open, and a tool click
  // during the tour doubles as an exit (the card invites "click around and explore"). Review of #94.
  // A replay request (#73) is OR-ed in as a second, independent way into the same tour — it still
  // defers to the wizard, and the wizard's close re-admits a pending replay just like first-run.
  // Both ways wait for hydration: a replay landing in the boot window (settings stayed open
  // across an overlay reload) would otherwise run the tour over the default config, and an exit
  // there is clobbered by the hydrating setConfig. Slice-5 review.
  const tourActive =
    !showWizard && (shouldRunTour(cfg.hydrated, cfg.config) || (cfg.hydrated && replayNonce > 0));

  // Which dock segments read as open. The skills tool spans three sub-views; the cooldown strip is
  // pinned independently, so it can be open alongside one of the panels. While the WIZARD shadows
  // the exclusive slot, lingering `panel` state must not light a glyph whose panel isn't actually
  // rendered. The tour no longer shadows (slice #71): it drives the real panels open under the
  // coach card, so their glyphs light honestly — the spotlight ring rides on top of that.
  const skillsOpen = panel === "skills" || panel === "timers" || panel === "sequence";
  const openSegs = new Set<DockSegment>();
  if (!showWizard) {
    if (skillsOpen) openSegs.add("skills");
    if (panel === "items") openSegs.add("items");
    if (panel === "routine") openSegs.add("routine");
  }
  if (cooldownsPinned) openSegs.add("cooldowns");
  // items/routine share the single exclusive panel, so they toggle it; cooldowns toggles its pin.
  const toggle = (seg: Panel) => setPanel((p) => (p === seg ? null : seg));

  // The cooldown strip + its add-picker float above the panel; opening another tool should dismiss
  // them so they don't sit over (and block) the panel being opened.
  const closeCooldownStrip = () => {
    setCooldownsPinned(false);
    setAddOpen(false);
  };

  // The card reports each beat (#71); drive the real shell to match — ring on the beat's glyph, its
  // live panel open under the card, the strip pinned on the ⏱ beat. The ⚔ beat shows the real chips
  // surface: adopt the seeded landing boss if none is active yet (bosses can never be empty — config
  // re-seeds on last delete). Fires before paint (the card's layout effect), so mount over lingering
  // pre-tour panel state resets it without a flash. Deps are primitives on purpose (#96 review):
  // `activeBoss` itself is re-derived from a fresh `bosses` array on every config write, so the
  // object would hand this callback — and the card's layout effect keyed on it — a new identity per
  // write, re-driving the same beat for nothing.
  const { selectBoss } = cfg;
  const hasActiveBoss = cfg.activeBoss != null;
  const firstBossId = cfg.config.bosses[0]?.id;
  const onTourStep = useCallback(
    (step: TourStep) => {
      const drive = driveForStep(step);
      setTourSpot(drive.spotlight);
      setCooldownsPinned(drive.pinCooldowns);
      setAddOpen(false);
      if (drive.panel === "timers" && !hasActiveBoss) selectBoss(firstBossId ?? null);
      setPanel(drive.panel);
    },
    [hasActiveBoss, selectBoss, firstBossId],
  );
  // The ONE teardown for every tour exit (#96 review: the reset must not fragment across exit
  // paths): mark it seen, kill the ring, close the tour-pinned strip, and land on `to` — null for
  // Finish/Skip (back to rest; Skip can fire mid-beat with a tour-opened panel showing, so the
  // reset is unconditional), or the clicked tool for the dock escape hatches. Force-OPEN, no
  // toggle: even when the tour has that very panel open (its glyph lit + ringed), clicking the
  // glyph the card just pointed at must keep the tool open, not snap it shut as the card leaves.
  // A replay's exit (#73) additionally clears the transient nonce; completeTour stays
  // unconditional because markTourSeen is idempotent — an already-seen config comes back by
  // reference, so the persist effect (keyed on the object) skips the no-op write + broadcast.
  const endTour = (to: Panel = null) => {
    cfg.completeTour();
    setReplayNonce(0);
    setTourSpot(null);
    closeCooldownStrip();
    setPanel(to);
  };

  // One controlled add-picker instance. `addOpen` lets the ⏱ segment jump straight to the menu. It
  // always lives with the cooldown strip (never on the timer row), so the + stays lined up with the
  // running-cooldown badges whether or not the boss timers are open below.
  const cooldownPicker = (
    <CooldownPicker
      catalog={cd.catalog}
      onStart={cd.start}
      onTune={cd.tune}
      onDuplicate={cd.duplicate}
      open={addOpen}
      onOpenChange={setAddOpen}
      locale={cfg.config.locale}
    />
  );

  // The cooldown strip, pinned above the exclusive panel whenever ⏱ is toggled on. The + rides inline
  // in the pills grid (a trailing cell, so it lines up horizontally with the badges), or stands alone
  // right-anchored when nothing's running.
  const cooldownStrip = cooldownsPinned ? (
    cd.pills.length > 0 ? (
      <CooldownStrip
        pills={cd.pills}
        catalog={cd.catalog}
        onStart={cd.start}
        onRestart={cd.restart}
        onClear={cd.clear}
        onTune={cd.tune}
        onDuplicate={cd.duplicate}
        showAdd={false}
        trailing={cooldownPicker}
        locale={cfg.config.locale}
      />
    ) : (
      cooldownPicker
    )
  ) : null;

  // The tier view over characters (#56): which are frozen (over the 1-character Lite cap) and whether a
  // new one may be added. Under a Pro state nothing freezes and adds are always allowed.
  const charFrozenIds = new Set(partition(cfg.entitlement, cfg.config).characters.frozen);
  const canAddCharacter = allows(cfg.entitlement, cfg.config, "addCharacter");

  // The active-character chip + switcher, pinned at the dock's left (#54). Switching swaps only the
  // recurring surface; ✎ opens the edit/classify flow; "+ New" opens the create wizard below the bar.
  // Frozen characters render read-only and route to the subscribe screen (#56).
  const characterSwitcher = (
    <CharacterSwitcher
      characters={cfg.config.characters.map((c) => ({ id: c.id, name: c.name, race: c.race }))}
      activeId={cfg.config.activeCharacterId}
      frozenIds={charFrozenIds}
      canAdd={canAddCharacter}
      locale={cfg.config.locale}
      onSwitch={cfg.switchCharacter}
      onEdit={(id) => {
        closeCooldownStrip();
        setCharEdit({ id });
      }}
      onDelete={cfg.removeCharacter}
      onNew={() => {
        closeCooldownStrip();
        setCharEdit({ id: null });
      }}
      onUpgrade={() => setShowSubscribe(true)}
    />
  );

  // The character wizard, shared by three entry points: "+ New" (create, cancellable), ✎ (edit/classify
  // an existing character, pre-filled), and first-run (create, no cancel — nothing to fall back to).
  const editingChar = charEdit?.id != null ? cfg.config.characters.find((c) => c.id === charEdit.id) : undefined;
  const characterWizard = (
    <CharacterWizard
      mode={editingChar ? "edit" : "new"}
      initial={
        editingChar
          ? { name: editingChar.name, empire: editingChar.empire, race: editingChar.race, builds: editingChar.builds }
          : undefined
      }
      locale={cfg.config.locale}
      onCreate={(draft) => {
        if (editingChar) cfg.editCharacter(editingChar.id, draft);
        else cfg.createCharacter(draft);
        setCharEdit(null);
      }}
      onCancel={firstRun ? undefined : () => setCharEdit(null)}
    />
  );

  // The one exclusive tool panel rendered below the pinned strip (null = only bar + strip show).
  // During the tour (#71) this chain runs normally — the tour drives `panel`, so each beat's REAL
  // panel renders here, live over the seeded data, while the coach card sits above it.
  let belowPanel = null;
  if (showWizard) {
    belowPanel = characterWizard;
  } else if (panel === "items") {
    // The expiring-items panel (#37): live day-scale countdowns for pet/costume/mount, each with a
    // ↻ refresh ("feed"/re-project) that restamps a fresh cycle — and starts an unstarted item.
    belowPanel = <ExpiringAccordion rows={rec.rows} onRefresh={rec.refresh} locale={cfg.config.locale} />;
  } else if (panel === "routine") {
    // The routine panel (#38): the gate checklist — biologist/books each reading ready or a
    // countdown to next-ready, with a ✓ that restamps the rolling cycle (and starts an unstarted one).
    belowPanel = (
      <RoutineAccordion rows={rec.routineRows} race={rec.activeRace} locale={cfg.config.locale} onDone={rec.markDone} onRead={rec.markRead} onSetRung={rec.setRung} />
    );
  } else if (panel === "sequence") {
    // ← returns to the picker sub-view (still below the pinned bar).
    belowPanel = <SequenceScreen onBack={() => setPanel("skills")} locale={cfg.config.locale} />;
  } else if (panel === "timers" && cfg.activeBoss) {
    belowPanel = <TimerScreen boss={cfg.activeBoss} onChangeBoss={() => setPanel("skills")} locale={cfg.config.locale} />;
  } else if (panel === "skills" || panel === "timers") {
    // The dungeon picker (also the fallback if "timers" is somehow open with no active boss).
    belowPanel = (
      <BossSelect
        bosses={cfg.config.bosses}
        locale={cfg.config.locale}
        onPick={(id) => {
          cfg.selectBoss(id);
          setPanel("timers");
        }}
        onOpenSequence={() => setPanel("sequence")}
      />
    );
  }

  const body = (
    <>
      <DockBar
        leading={characterSwitcher}
        open={openSegs}
        // Gated: opening the character wizard mid-tour (✎ / + New) unmounts the card but leaves
        // `tourSpot` set — the ring must not keep pulsing under the wizard. It returns when the
        // wizard closes and the card re-mounts (the gate is unseen until finished/skipped).
        spotlight={tourActive ? tourSpot : null}
        activeBossName={cfg.activeBoss?.name}
        itemsDatum={rec.datum}
        routineDatum={rec.routineDatum}
        locale={cfg.config.locale}
        onSkills={() => {
          const target = cfg.activeBoss ? "timers" : "skills";
          if (tourActive) endTour(target);
          else setPanel(skillsOpen ? null : target);
        }}
        onCooldowns={() => {
          // Mid-tour, ⏱ exits like the other tools (#96 review): the tour drives the pin now, so
          // the plain toggle would collapse the strip the ⏱ beat just opened while the ring kept
          // pulsing on it. Force-OPEN the strip (re-pin after the teardown unpins; + menu when
          // nothing runs, as the normal empty-strip path does).
          if (tourActive) {
            endTour();
            setCooldownsPinned(true);
            setAddOpen(cd.pills.length === 0);
            return;
          }
          // Running cooldowns → ⏱ toggles the pinned pills strip (which carries the + as its last cell).
          if (cd.pills.length > 0) {
            setCooldownsPinned((p) => !p);
            return;
          }
          // Nothing running → ⏱ pins the strip (which hosts the +) and opens the add menu directly;
          // clicking again closes both. Without the pin there'd be nowhere for the picker to mount.
          const showing = cooldownsPinned;
          setCooldownsPinned(!showing);
          setAddOpen(!showing);
        }}
        onItems={() => {
          if (tourActive) {
            endTour("items");
            return;
          }
          closeCooldownStrip();
          toggle("items");
        }}
        onRoutine={() => {
          if (tourActive) {
            endTour("routine");
            return;
          }
          closeCooldownStrip();
          toggle("routine");
        }}
        onSettings={openSettings}
        onQuit={quitApp}
      />
      {/* The first-run coach card (#68/#71), anchored directly under the dock — ringed glyph above,
          the beat's live tool (pinned strip / exclusive panel) below — so all three read together.
          Finish, Skip, and clicking ⚔/⧗/✓ all mark the tour seen forever (a second character never
          re-triggers it). It follows the blocking wizard: tourActive is false while the wizard shows. */}
      {tourActive && (
        <TourCard
          key={replayNonce} // a replay request mid-tour remounts the card → restart from beat 1 (#73)
          onFinish={endTour}
          onSkip={endTour}
          onStepChange={onTourStep}
          onDeepLink={openSettingsTo}
          locale={cfg.config.locale}
        />
      )}
      {cooldownStrip}
      {belowPanel}
      {/* Standing upgrade / trial-status entry to Pro (#58); renders nothing for a subscribed user. */}
      <UpgradeBanner entitlement={cfg.entitlement} onOpen={() => setShowSubscribe(true)} locale={cfg.config.locale} />
    </>
  );

  return (
    <>
      {inBrowser && <DemoScene />}
      <div className="overlay" ref={overlayRef}>
        <div className="overlay__content" ref={contentRef}>
          {body}
        </div>
      </div>
      {showSettings && (
        <div className="settings-modal">
          <SettingsApp onClose={closeSettings} initialTab={settingsTab ?? undefined} />
        </div>
      )}
      {/* Cap-hit nudge (#56): a capped add (here, a 2nd character) was just refused. Upgrade → subscribe. */}
      {cfg.capNudge && (
        <div className="settings-modal">
          <CapNudge
            mutation={cfg.capNudge}
            onUpgrade={() => {
              cfg.dismissNudge();
              setShowSubscribe(true);
            }}
            onDismiss={cfg.dismissNudge}
            locale={cfg.config.locale}
          />
        </div>
      )}
      {showSubscribe && (
        <div className="settings-modal">
          <SubscribeScreen
            entitlement={cfg.entitlement}
            phase={purchasePhase}
            onStartTrial={onStartTrial}
            onSubscribe={onSubscribe}
            onClose={() => {
              setShowSubscribe(false);
              setPurchasePhase("idle"); // a stale error must not greet the next open
            }}
            locale={cfg.config.locale}
          />
        </div>
      )}
      {/* Dev-only entitlement switcher: the web demo's stubbed license always reads `subscribed`, so
          this is the only way to exercise the Lite/trial/lapsed UI (banner, subscribe screen, and the
          #56 frozen rendering/nudges) without a real Store. Browser-only — never in the desktop app. */}
      {inBrowser && <DevEntitlementSwitch value={cfg.entitlement} onSet={cfg.setEntitlement} />}
    </>
  );
}

const ENTITLEMENTS: Entitlement[] = ["subscribed", "trial", "lapsed", "never"];

/** A throwaway dev affordance (browser demo only) to flip the entitlement and preview each tier's UI. */
function DevEntitlementSwitch({ value, onSet }: { value: Entitlement; onSet: (e: Entitlement) => void }) {
  return (
    <div className="dev-ent-switch">
      <span className="dev-ent-switch__label">tier</span>
      {ENTITLEMENTS.map((e) => (
        <button
          key={e}
          className={`dev-ent-switch__btn${value === e ? " is-active" : ""}`}
          onClick={() => onSet(e)}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
