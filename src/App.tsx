// v1 overlay — the compact, always-on-top play surface. Two screens only:
// Screen 1 SELECT BOSS (pick → timers, or ⚙ → the settings window) → Screen 2 TIMERS
// (that boss's chips). All config editing now lives in a separate settings window
// (overlay/settingsWindow.ts → settings/SettingsApp.tsx); edits there reflect here live
// via configSync. Config still flows through useConfig, persisted to disk; per-skill
// global hotkeys are registered while a boss's timer screen is active.
import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { BossSelect } from "./overlay/BossSelect";
import { TimerScreen } from "./overlay/TimerScreen";
import { SequenceScreen } from "./overlay/SequenceScreen";
import SettingsApp from "./settings/SettingsApp";
import { DemoScene } from "./DemoScene";
import { useConfig } from "./overlay/useConfig";
import { useOverlayPosition } from "./overlay/useOverlayPosition";
import { openSettingsWindow } from "./overlay/settingsWindow";
import { unlockAudio } from "./overlay/audio";

// In a plain browser the overlay floats over a mock game scene (the live demo); the real
// desktop app is transparent over the actual game, so the scene is never mounted there.
const inBrowser = !isTauri();

type Screen = { name: "select" } | { name: "timers" } | { name: "sequence" };

export default function App() {
  const cfg = useConfig();
  const [screen, setScreen] = useState<Screen>({ name: "select" });
  // Browser only: settings renders inline (a modal over the still-mounted overlay) rather
  // than a second OS window/tab. Tauri spawns a real settings window, so this stays false.
  const [showSettings, setShowSettings] = useState(false);

  // Restore the overlay's last position and persist it as it's dragged; in the browser the
  // returned ref turns the .overlay element into a draggable floating panel.
  const overlayRef = useOverlayPosition();

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

  let body;
  if (screen.name === "timers" && cfg.activeBoss) {
    body = <TimerScreen boss={cfg.activeBoss} onChangeBoss={() => setScreen({ name: "select" })} />;
  } else if (screen.name === "sequence") {
    body = <SequenceScreen onBack={() => setScreen({ name: "select" })} />;
  } else {
    body = (
      <BossSelect
        bosses={cfg.config.bosses}
        onPick={(id) => {
          cfg.selectBoss(id);
          setScreen({ name: "timers" });
        }}
        onOpenSettings={openSettings}
        onOpenSequence={() => setScreen({ name: "sequence" })}
      />
    );
  }

  return (
    <>
      {inBrowser && <DemoScene />}
      <div className="overlay" ref={overlayRef}>
        {body}
      </div>
      {showSettings && (
        <div className="settings-modal">
          <SettingsApp onClose={closeSettings} />
        </div>
      )}
    </>
  );
}
