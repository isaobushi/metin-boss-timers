// v1 overlay — the compact, always-on-top play surface. Its home is the DOCK shell (ADR-0003):
// one dense status line whose segments route to the existing surfaces. ⚔ opens the active boss's
// TIMERS (or the SKILLS picker if none is active), ⏱ opens the COOLDOWNS strip, ⚙ the settings
// window; ♻/✓ expand inline accordions (inert until #36+). All config editing lives in a separate
// settings window (overlay/settingsWindow.ts → settings/SettingsApp.tsx); edits there reflect here
// live via configSync. Config flows through useConfig, persisted to disk; per-skill global hotkeys
// are registered while a boss's timer screen is active.
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { DockBar, type DockSegment } from "./overlay/DockBar";
import { CharacterSwitcher } from "./overlay/CharacterSwitcher";
import { CharacterWizard } from "./overlay/CharacterWizard";
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
import { useOverlayPosition } from "./overlay/useOverlayPosition";
import { useOverlayAutosize } from "./overlay/useOverlayAutosize";
import { openSettingsWindow } from "./overlay/settingsWindow";
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

  // ⚙ opens the real settings window under Tauri, or the inline modal in the browser.
  const openSettings = useCallback(() => {
    if (isTauri()) openSettingsWindow();
    else setShowSettings(true);
  }, []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  // Which dock segments read as open. The skills tool spans three sub-views; the cooldown strip is
  // pinned independently, so it can be open alongside one of the panels.
  const skillsOpen = panel === "skills" || panel === "timers" || panel === "sequence";
  const openSegs = new Set<DockSegment>();
  if (skillsOpen) openSegs.add("skills");
  if (cooldownsPinned) openSegs.add("cooldowns");
  if (panel === "items") openSegs.add("items");
  if (panel === "routine") openSegs.add("routine");
  // items/routine share the single exclusive panel, so they toggle it; cooldowns toggles its pin.
  const toggle = (seg: Panel) => setPanel((p) => (p === seg ? null : seg));
  // The cooldown strip + its add-picker float above the panel; opening another tool should dismiss
  // them so they don't sit over (and block) the panel being opened.
  const closeCooldownStrip = () => {
    setCooldownsPinned(false);
    setAddOpen(false);
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
      />
    ) : (
      cooldownPicker
    )
  ) : null;

  // First-run / empty-roster: no character exists (e.g. the only one was deleted). The create wizard
  // takes over the panel and can't be dismissed — there's nothing to fall back to until one exists.
  const firstRun = cfg.hydrated && cfg.config.characters.length === 0;

  // The active-character chip + switcher, pinned at the dock's left (#54). Switching swaps only the
  // recurring surface; ✎ opens the edit/classify flow; "+ New" opens the create wizard below the bar.
  const characterSwitcher = (
    <CharacterSwitcher
      characters={cfg.config.characters.map((c) => ({ id: c.id, name: c.name, race: c.race }))}
      activeId={cfg.config.activeCharacterId}
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
    />
  );

  // The character wizard, shared by three entry points: "+ New" (create, cancellable), ✎ (edit/classify
  // an existing character, pre-filled), and first-run (create, no cancel — nothing to fall back to).
  const editingChar = charEdit?.id != null ? cfg.config.characters.find((c) => c.id === charEdit.id) : undefined;
  const showWizard = firstRun || charEdit != null;
  const characterWizard = (
    <CharacterWizard
      mode={editingChar ? "edit" : "new"}
      initial={
        editingChar
          ? { name: editingChar.name, empire: editingChar.empire, race: editingChar.race, builds: editingChar.builds }
          : undefined
      }
      onCreate={(draft) => {
        if (editingChar) cfg.editCharacter(editingChar.id, draft);
        else cfg.createCharacter(draft);
        setCharEdit(null);
      }}
      onCancel={firstRun ? undefined : () => setCharEdit(null)}
    />
  );

  // The one exclusive tool panel rendered below the pinned strip (null = only bar + strip show).
  let belowPanel = null;
  if (showWizard) {
    belowPanel = characterWizard;
  } else if (panel === "items") {
    // The expiring-items panel (#37): live day-scale countdowns for pet/costume/mount, each with a
    // ↻ refresh ("feed"/re-project) that restamps a fresh cycle — and starts an unstarted item.
    belowPanel = <ExpiringAccordion rows={rec.rows} onRefresh={rec.refresh} />;
  } else if (panel === "routine") {
    // The routine panel (#38): the gate checklist — biologist/books each reading ready or a
    // countdown to next-ready, with a ✓ that restamps the rolling cycle (and starts an unstarted one).
    belowPanel = (
      <RoutineAccordion rows={rec.routineRows} race={rec.activeRace} onDone={rec.markDone} onRead={rec.markRead} onSetRung={rec.setRung} />
    );
  } else if (panel === "sequence") {
    // ← returns to the picker sub-view (still below the pinned bar).
    belowPanel = <SequenceScreen onBack={() => setPanel("skills")} />;
  } else if (panel === "timers" && cfg.activeBoss) {
    belowPanel = <TimerScreen boss={cfg.activeBoss} onChangeBoss={() => setPanel("skills")} />;
  } else if (panel === "skills" || panel === "timers") {
    // The dungeon picker (also the fallback if "timers" is somehow open with no active boss).
    belowPanel = (
      <BossSelect
        bosses={cfg.config.bosses}
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
        activeBossName={cfg.activeBoss?.name}
        itemsDatum={rec.datum}
        routineDatum={rec.routineDatum}
        onSkills={() => setPanel(skillsOpen ? null : cfg.activeBoss ? "timers" : "skills")}
        onCooldowns={() => {
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
          closeCooldownStrip();
          toggle("items");
        }}
        onRoutine={() => {
          closeCooldownStrip();
          toggle("routine");
        }}
        onSettings={openSettings}
        onQuit={quitApp}
      />
      {cooldownStrip}
      {belowPanel}
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
          <SettingsApp onClose={closeSettings} />
        </div>
      )}
    </>
  );
}
