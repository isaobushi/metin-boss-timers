// v1 overlay — Slice 2: a set of independent draining-chip timers with full control
// (left-click toggle, right-click reset, auto-loop) and audio cues at 3/2/1/0. Config
// is still hardcoded here; per-boss user config arrives in Slice 3.
import { useEffect } from "react";
import { Chip } from "./overlay/Chip";
import { useTimers } from "./overlay/useTimers";
import { unlockAudio } from "./overlay/audio";
import type { TimerInit } from "./engine/timer";

// Hardcoded skills. Distinct durations + pitches so the chips drain and beep
// independently; the short one loops quickly to make the cues easy to hear.
const TIMERS: TimerInit[] = [
  { id: "skill-1", label: "Skill 1", durationMs: 18_000, pitch: 880 },
  { id: "skill-2", label: "Skill 2", durationMs: 20_000, pitch: 523 },
  { id: "skill-3", label: "Skill 3", durationMs: 12_000, pitch: 659 },
];

export default function App() {
  const { views, register, onToggle, onReset } = useTimers(TIMERS);

  // Browsers/webviews gate audio behind a user gesture — unlock on the first interaction.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  return (
    <div className="overlay">
      {views.map((v) => (
        <Chip
          key={v.id}
          id={v.id}
          label={v.label}
          running={v.running}
          register={register}
          onToggle={() => onToggle(v.id)}
          onReset={() => onReset(v.id)}
        />
      ))}
    </div>
  );
}
