// v1 overlay — the compact, always-on-top play surface. Two screens only:
// Screen 1 SELECT BOSS (pick → timers, or ⚙ → the settings window) → Screen 2 TIMERS
// (that boss's chips). All config editing now lives in a separate settings window
// (overlay/settingsWindow.ts → settings/SettingsApp.tsx); edits there reflect here live
// via configSync. Config still flows through useConfig, persisted to disk; per-skill
// global hotkeys are registered while a boss's timer screen is active.
import { useEffect, useState } from "react";
import { BossSelect } from "./overlay/BossSelect";
import { TimerScreen } from "./overlay/TimerScreen";
import { SequenceScreen } from "./overlay/SequenceScreen";
import { useConfig } from "./overlay/useConfig";
import { useOverlayPosition } from "./overlay/useOverlayPosition";
import { openSettingsWindow } from "./overlay/settingsWindow";
import { unlockAudio } from "./overlay/audio";

type Screen = { name: "select" } | { name: "timers" } | { name: "sequence" };

export default function App() {
  const cfg = useConfig();
  const [screen, setScreen] = useState<Screen>({ name: "select" });

  // Restore the overlay's last on-screen position and persist it as it's dragged (no-op in browser-dev).
  useOverlayPosition();

  // Browsers/webviews gate audio behind a user gesture — unlock on the first interaction.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

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
        onOpenSettings={openSettingsWindow}
        onOpenSequence={() => setScreen({ name: "sequence" })}
      />
    );
  }

  return <div className="overlay">{body}</div>;
}
