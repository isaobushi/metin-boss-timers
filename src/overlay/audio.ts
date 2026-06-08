// Audio adapter — the thin layer that renders engine cues as sound. The engine stays
// pure and only emits `Cue` values; this module plays each as the skill's chosen sample.
// The 0-boundary `hit` lands harder than the 3/2/1 ticks. A synth beep covers the gap
// until a sample decodes, or permanently if it fails to load.
//
// Playback is MONOPHONIC PER SKILL, keyed on the skill (timer) id — not the sound id:
// when a skill fires its next cue we stop that skill's previous source, so a sample
// longer than the 1s tick interval self-cuts cleanly. Two different skills sharing the
// same sound have different keys, so they never cut each other.
import type { Cue } from "../engine/timer";
import { DEFAULT_SOUND_ID, SOUND_IDS, isSoundId, type SoundId } from "../engine/sounds";
import { SOUND_URLS } from "./soundAssets";

let ctx: AudioContext | null = null;
const buffers = new Map<SoundId, AudioBuffer>();
let loading = false;
// The currently-playing source per skill id, so the next cue for that skill can cut it.
const voices = new Map<string, AudioBufferSourceNode>();

function ac(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

async function loadSamples() {
  if (loading || buffers.size === SOUND_IDS.length) return;
  loading = true;
  try {
    await Promise.all(
      SOUND_IDS.map(async (id) => {
        if (buffers.has(id)) return;
        try {
          const res = await fetch(SOUND_URLS[id]);
          buffers.set(id, await ac().decodeAudioData(await res.arrayBuffer()));
        } catch {
          // leave this id unbuffered — it falls back to the synth beep
        }
      }),
    );
  } finally {
    loading = false;
  }
}

/** Audio is gated behind a user gesture — call this once on the first click/keypress. */
export function unlockAudio() {
  ac().resume();
  loadSamples();
}

/** Frequency for the fallback synth beep (used only until a sample decodes). */
const FALLBACK_FREQ = 660;

/**
 * Render one engine cue as sound: the sample bound to `soundId`, voiced under `skillId`
 * so the skill's previous source is cut first (monophonic per skill). Falls back to a
 * synth beep when the sample is missing or hasn't decoded yet.
 */
export function playCue(cue: Cue, soundId: string, skillId: string) {
  const id: SoundId = isSoundId(soundId) ? soundId : DEFAULT_SOUND_ID;
  beep(cue === "hit" ? "final" : "tick", id, skillId);
}

function beep(kind: "tick" | "final", soundId: SoundId, skillId: string) {
  const a = ac();
  const t = a.currentTime;
  const sample = buffers.get(soundId);

  if (sample) {
    voices.get(skillId)?.stop(); // cut this skill's previous sound before starting the next
    const src = a.createBufferSource();
    src.buffer = sample;
    const gain = a.createGain();
    gain.gain.value = kind === "final" ? 0.95 : 0.5; // the 0-hit lands harder than the ticks
    src.connect(gain);
    gain.connect(a.destination);
    src.onended = () => {
      if (voices.get(skillId) === src) voices.delete(skillId);
    };
    voices.set(skillId, src);
    src.start(t);
    return;
  }

  // fallback synth (until the sample decodes / if it failed to load)
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.connect(gain);
  gain.connect(a.destination);

  const dur = kind === "final" ? 0.5 : 0.12;
  osc.type = kind === "final" ? "sawtooth" : "square";
  osc.frequency.setValueAtTime(FALLBACK_FREQ, t);
  if (kind === "final") osc.frequency.exponentialRampToValueAtTime(FALLBACK_FREQ * 0.6, t + dur);

  const peak = kind === "final" ? 0.28 : 0.18;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.start(t);
  osc.stop(t + dur + 0.02);
}
