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
import { SELECT_SOUND_URL, SOUND_URLS } from "./soundAssets";

let ctx: AudioContext | null = null;
const buffers = new Map<SoundId, AudioBuffer>();
// The Templum selection-tap sound — a single fixed UI sound, decoded alongside the
// per-skill samples but kept out of the `buffers` map (it's not a `SoundId`).
let selectBuffer: AudioBuffer | null = null;
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

async function decodeInto(url: string, set: (b: AudioBuffer) => void) {
  try {
    const res = await fetch(url);
    set(await ac().decodeAudioData(await res.arrayBuffer()));
  } catch {
    // leave it unset — callers fall back (synth beep for cues, silence for the UI tap)
  }
}

async function loadSamples() {
  if (loading || (buffers.size === SOUND_IDS.length && selectBuffer)) return;
  loading = true;
  try {
    await Promise.all([
      ...SOUND_IDS.map((id) =>
        buffers.has(id) ? Promise.resolve() : decodeInto(SOUND_URLS[id], (b) => buffers.set(id, b)),
      ),
      selectBuffer ? Promise.resolve() : decodeInto(SELECT_SOUND_URL, (b) => (selectBuffer = b)),
    ]);
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

/**
 * Play a sound once for the settings picker, independent of any timer: it's not tracked
 * in `voices`, so a preview never cuts (or is cut by) a running skill. Falls back to the
 * synth beep if the sample hasn't decoded. `resume()` defensively in case the click that
 * triggered the preview is itself the first gesture.
 */
export function previewSound(soundId: string) {
  const a = ac();
  a.resume();
  const id: SoundId = isSoundId(soundId) ? soundId : DEFAULT_SOUND_ID;
  const sample = buffers.get(id);
  if (!sample) {
    beep("final", id, `__preview__:${id}`); // no buffer yet → synth (own key, cuts nothing real)
    return;
  }
  const src = a.createBufferSource();
  src.buffer = sample;
  const gain = a.createGain();
  gain.gain.value = 0.8;
  src.connect(gain);
  gain.connect(a.destination);
  src.start(a.currentTime);
}

/**
 * Play the Templum selection-tap sound once. Fire-and-forget and untracked, so taps can
 * overlap freely; silent until the sample decodes (the tap itself is the unlock gesture,
 * so the very first tap may not sound). `resume()` defensively for that first gesture.
 */
export function playSelect() {
  const a = ac();
  a.resume();
  if (!selectBuffer) return;
  const src = a.createBufferSource();
  src.buffer = selectBuffer;
  const gain = a.createGain();
  gain.gain.value = 0.15; // deliberately subtle — just enough to confirm a tap registered
  src.connect(gain);
  gain.connect(a.destination);
  src.start(a.currentTime);
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
