// Audio adapter — the thin layer that renders engine cues as sound. The engine stays
// pure and only emits `Cue` values; this module turns each into a pitch-shifted
// kick-drum sample (per-timer pitch via playbackRate). The 0-boundary `hit` lands
// harder than the 3/2/1 ticks. A synth beep covers the gap until the sample decodes,
// or permanently if the sample fails to load.
import kickUrl from "../assets/kick-drum-timer.wav";
import type { Cue } from "../engine/timer";

let ctx: AudioContext | null = null;
let sample: AudioBuffer | null = null;
let loading = false;

function ac(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

async function loadSample() {
  if (sample || loading) return;
  loading = true;
  try {
    const res = await fetch(kickUrl);
    sample = await ac().decodeAudioData(await res.arrayBuffer());
  } catch {
    sample = null; // keep falling back to the synth
  } finally {
    loading = false;
  }
}

/** Audio is gated behind a user gesture — call this once on the first click/keypress. */
export function unlockAudio() {
  ac().resume();
  loadSample();
}

/** The pitch the sample is recorded at; each timer's pitch shifts playbackRate around it. */
const BASE_FREQ = 660;

/** Render one engine cue as sound, pitched for the timer that emitted it. */
export function playCue(cue: Cue, pitch: number) {
  beep(pitch, cue === "hit" ? "final" : "tick");
}

function beep(freq: number, kind: "tick" | "final") {
  const a = ac();
  const t = a.currentTime;

  if (sample) {
    const src = a.createBufferSource();
    src.buffer = sample;
    src.playbackRate.value = freq / BASE_FREQ; // higher-pitched timers -> tighter/higher kick
    const gain = a.createGain();
    gain.gain.value = kind === "final" ? 0.95 : 0.5; // the 0-hit lands harder than the ticks
    src.connect(gain);
    gain.connect(a.destination);
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
  osc.frequency.setValueAtTime(freq, t);
  if (kind === "final") osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);

  const peak = kind === "final" ? 0.28 : 0.18;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.start(t);
  osc.stop(t + dur + 0.02);
}
