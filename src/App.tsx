// v1 overlay — Slice 3: the pick-boss-first flow over a user-editable config.
// Screen 1 SELECT BOSS → (⚙ per-boss SETTINGS) → Screen 2 TIMERS (that boss's chips).
// Config lives in the pure model (src/engine/config.ts) behind the useConfig control
// layer. Persistence (#5) and hotkeys (#6) are deliberately out of this slice.
import { useEffect, useState } from "react";
import { BossSelect } from "./overlay/BossSelect";
import { BossSettings } from "./overlay/BossSettings";
import { TimerScreen } from "./overlay/TimerScreen";
import { useConfig } from "./overlay/useConfig";
import { unlockAudio } from "./overlay/audio";

type Screen = { name: "select" } | { name: "settings"; bossId: string } | { name: "timers" };

export default function App() {
  const cfg = useConfig();
  const [screen, setScreen] = useState<Screen>({ name: "select" });

  // Browsers/webviews gate audio behind a user gesture — unlock on the first interaction.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const toSelect = () => setScreen({ name: "select" });

  let body;
  const settingsBoss = screen.name === "settings" ? cfg.config.bosses.find((b) => b.id === screen.bossId) : undefined;

  if (settingsBoss) {
    const id = settingsBoss.id;
    body = (
      <BossSettings
        boss={settingsBoss}
        onBack={toSelect}
        onRenameBoss={(name) => cfg.editBossName(id, name)}
        onDeleteBoss={() => {
          cfg.removeBoss(id);
          toSelect();
        }}
        onAddSkill={() => cfg.createSkill(id)}
        onRenameSkill={(skillId, label) => cfg.editSkillName(id, skillId, label)}
        onSetDuration={(skillId, durationMs) => cfg.editSkillDuration(id, skillId, durationMs)}
        onRemoveSkill={(skillId) => cfg.deleteSkill(id, skillId)}
      />
    );
  } else if (screen.name === "timers" && cfg.activeBoss) {
    body = <TimerScreen boss={cfg.activeBoss} onChangeBoss={toSelect} />;
  } else {
    body = (
      <BossSelect
        bosses={cfg.config.bosses}
        onPick={(id) => {
          cfg.selectBoss(id);
          setScreen({ name: "timers" });
        }}
        onSettings={(id) => setScreen({ name: "settings", bossId: id })}
        onAddBoss={() => setScreen({ name: "settings", bossId: cfg.createBoss() })}
      />
    );
  }

  return <div className="overlay">{body}</div>;
}
