// PROTOTYPE — throwaway. Timer audio: a kick-drum sample, pitch-shifted per timer
// (playbackRate keyed off each timer's `freq`). Falls back to a synth beep until the
// sample finishes decoding, or if it fails to load.
import kickUrl from "../assets/kick-drum-timer.wav";

let ctx: AudioContext | null = null;
let sample: AudioBuffer | null = null;
let loading = false;

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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

// Browsers block audio until a user gesture — call this on first click.
export function unlockAudio() {
  ac().resume();
  loadSample();
}

// pitch the sample is treated as "neutral"; each timer's freq shifts playbackRate around it
const BASE_FREQ = 660;

export function beep(freq: number, kind: "tick" | "final" = "tick") {
  const a = ac();
  const t = a.currentTime;

  if (sample) {
    const src = a.createBufferSource();
    src.buffer = sample;
    src.playbackRate.value = freq / BASE_FREQ; // higher-pitched timers -> tighter/higher kick
    const gain = a.createGain();
    gain.gain.value = kind === "final" ? 0.95 : 0.5; // the 0-hit lands harder than the 3-2-1 ticks
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
