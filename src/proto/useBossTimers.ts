// PROTOTYPE — throwaway. Shared timer engine (logic locked during grilling).
// Timers are now user-configurable per boss: add/remove/rename/duration/hotkey.
// Wall-clock anchored loop, beeps at 3/2/1 + final at 0, per-timer pitch.
// Switching boss stops + resets every timer (only active boss runs).
import { useEffect, useRef, useState } from "react";
import { beep } from "./audio";

export type TimerCfg = { id: string; label: string; duration: number; pitch: number; hotkey?: string };
export type Boss = { id: string; name: string; accent: string; accent2: string };

const DEFAULT_BOSSES: Boss[] = [
  { id: "balathor", name: "Balathor", accent: "#ff2d6b", accent2: "#ff8a3d" },
  { id: "alastor", name: "Alastor", accent: "#00e5ff", accent2: "#8a5bff" },
];

// accent pairs cycled when new bosses are added, so each boss reads distinctly
const ACCENTS: [string, string][] = [
  ["#ff2d6b", "#ff8a3d"],
  ["#00e5ff", "#8a5bff"],
  ["#39ff88", "#00e5ff"],
  ["#ffd166", "#ff5d8f"],
  ["#b388ff", "#5d9bff"],
  ["#ff7b3d", "#ffd166"],
];

// fallback so `boss` is never undefined even if every boss is deleted
const FALLBACK_BOSS: Boss = { id: "", name: "", accent: "#7c6cff", accent2: "#7c6cff" };

// pitch palette cycled when new skills are added, so beeps stay distinguishable
const PITCHES = [880, 523, 659, 740, 988, 440, 587, 784];

// default skills per boss (durations kept from the original spec; labels are generic now)
const DEFAULT_TIMERS: Record<string, TimerCfg[]> = {
  balathor: [
    { id: "balathor-1", label: "Skill 1", duration: 18, pitch: 880 },
    { id: "balathor-2", label: "Skill 2", duration: 20, pitch: 523 },
  ],
  alastor: [{ id: "alastor-1", label: "Skill 1", duration: 20, pitch: 659 }],
};

const cloneDefaults = (): Record<string, TimerCfg[]> => {
  const out: Record<string, TimerCfg[]> = {};
  for (const [b, list] of Object.entries(DEFAULT_TIMERS)) out[b] = list.map((t) => ({ ...t }));
  return out;
};

// ---- persistence (demo: config survives reload via localStorage) ----
const STORAGE_KEY = "metin-boss-timers:v1";
type PersistedConfig = { bosses: Boss[]; cfgs: Record<string, TimerCfg[]> };

const defaultConfig = (): PersistedConfig => ({
  bosses: DEFAULT_BOSSES.map((b) => ({ ...b })),
  cfgs: cloneDefaults(),
});

function loadConfig(): PersistedConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.bosses) && p.cfgs && typeof p.cfgs === "object") {
        return { bosses: p.bosses as Boss[], cfgs: p.cfgs as Record<string, TimerCfg[]> };
      }
    }
  } catch {
    /* ignore corrupt/unavailable storage — fall through to defaults */
  }
  return defaultConfig();
}

// highest numeric suffix matching `re` across `ids` (so regenerated ids never collide after reload)
const maxSeq = (ids: string[], re: RegExp): number =>
  ids.reduce((mx, id) => {
    const m = id.match(re);
    return m ? Math.max(mx, Number(m[1])) : mx;
  }, 0);

type TState = {
  durationSec: number;
  running: boolean;
  remainingMs: number;
  endsAt: number | null;
  lastSec: number;
};

export type TimerView = {
  cfg: TimerCfg;
  durationSec: number;
  running: boolean;
  secs: number; // whole seconds shown
  progress: number; // 0..1 remaining
  danger: boolean; // in final 3s while running
};

export function useBossTimers() {
  // load persisted (or default) config exactly once, before any state is seeded from it
  const initRef = useRef<PersistedConfig | null>(null);
  if (!initRef.current) initRef.current = loadConfig();
  const init = initRef.current;

  const [bosses, setBosses] = useState<Boss[]>(() => init.bosses.map((b) => ({ ...b })));
  const [activeBoss, setActiveBoss] = useState(() => init.bosses[0]?.id ?? "");
  const [cfgs, setCfgs] = useState<Record<string, TimerCfg[]>>(() => init.cfgs);
  const states = useRef<Map<string, TState>>(new Map());
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    for (const list of Object.values(init.cfgs))
      for (const t of list)
        states.current.set(t.id, { durationSec: t.duration, running: false, remainingMs: t.duration * 1000, endsAt: null, lastSec: t.duration });
  }
  const cfgsRef = useRef(cfgs);
  cfgsRef.current = cfgs; // keep the rAF loop reading the latest pitches
  // seed seq counters past any persisted ids so freshly-created ids can't collide after reload
  const idSeq = useRef(maxSeq(Object.values(init.cfgs).flat().map((t) => t.id), /-x(\d+)$/));
  const bossSeq = useRef(maxSeq(init.bosses.map((b) => b.id), /^boss-(\d+)$/));
  const [, force] = useState(0);

  // persist config (bosses + skills + durations + hotkeys) whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bosses, cfgs }));
    } catch {
      /* storage may be unavailable (private mode / quota) — demo still works in-memory */
    }
  }, [bosses, cfgs]);

  useEffect(() => {
    let raf = 0;
    const pitchOf = (id: string) => {
      for (const list of Object.values(cfgsRef.current)) {
        const t = list.find((x) => x.id === id);
        if (t) return t.pitch;
      }
      return 600;
    };
    const tick = () => {
      const now = Date.now();
      for (const [id, st] of states.current) {
        if (!st.running || st.endsAt == null) continue;
        let rem = st.endsAt - now;
        if (rem <= 0) {
          beep(pitchOf(id), "final");
          while (st.endsAt <= now) st.endsAt += st.durationSec * 1000;
          rem = st.endsAt - now;
          st.lastSec = Math.ceil(rem / 1000);
        } else {
          const s = Math.ceil(rem / 1000);
          if (s !== st.lastSec) {
            st.lastSec = s;
            if (s <= 3 && s >= 1) beep(pitchOf(id), "tick");
          }
        }
        st.remainingMs = rem;
      }
      force((x) => (x + 1) % 1_000_000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- config edits (per timer id, scanned across bosses) ----
  const editCfg = (id: string, fn: (t: TimerCfg) => TimerCfg) =>
    setCfgs((prev) => {
      const out: Record<string, TimerCfg[]> = {};
      for (const [b, list] of Object.entries(prev)) out[b] = list.map((t) => (t.id === id ? fn(t) : t));
      return out;
    });

  const start = (id: string) => {
    const st = states.current.get(id)!;
    st.running = true;
    st.endsAt = Date.now() + st.remainingMs;
    st.lastSec = Math.ceil(st.remainingMs / 1000);
    force((x) => x + 1);
  };
  const stop = (id: string) => {
    const st = states.current.get(id)!;
    if (st.endsAt) st.remainingMs = Math.max(0, st.endsAt - Date.now());
    st.running = false;
    st.endsAt = null;
    force((x) => x + 1);
  };
  const toggle = (id: string) => (states.current.get(id)!.running ? stop(id) : start(id));
  const reset = (id: string) => {
    const st = states.current.get(id)!;
    st.remainingMs = st.durationSec * 1000;
    st.lastSec = st.durationSec;
    if (st.running) st.endsAt = Date.now() + st.remainingMs;
    force((x) => x + 1);
  };
  // hotkey action: snap to full AND ensure it's running (fires the skill from any state)
  const trigger = (id: string) => {
    const st = states.current.get(id);
    if (!st) return;
    st.remainingMs = st.durationSec * 1000;
    st.lastSec = st.durationSec;
    st.running = true;
    st.endsAt = Date.now() + st.remainingMs;
    force((x) => x + 1);
  };
  const setDuration = (id: string, v: number) => {
    const d = Math.max(1, Math.min(999, Math.round(v || 0)));
    editCfg(id, (t) => ({ ...t, duration: d }));
    const st = states.current.get(id);
    if (st) {
      st.durationSec = d;
      if (!st.running) {
        st.remainingMs = d * 1000;
        st.lastSec = d;
      }
    }
  };
  const renameTimer = (id: string, label: string) => editCfg(id, (t) => ({ ...t, label }));
  const setHotkey = (id: string, hotkey: string | undefined) => editCfg(id, (t) => ({ ...t, hotkey }));

  const addTimer = (bossId: string) => {
    const list = cfgsRef.current[bossId] ?? [];
    const n = list.length + 1;
    const id = `${bossId}-x${++idSeq.current}`;
    const duration = 20;
    const cfg: TimerCfg = { id, label: `Skill ${n}`, duration, pitch: PITCHES[(n - 1) % PITCHES.length] };
    states.current.set(id, { durationSec: duration, running: false, remainingMs: duration * 1000, endsAt: null, lastSec: duration });
    setCfgs((prev) => ({ ...prev, [bossId]: [...(prev[bossId] ?? []), cfg] }));
  };
  const removeTimer = (bossId: string, id: string) => {
    states.current.delete(id);
    setCfgs((prev) => ({ ...prev, [bossId]: (prev[bossId] ?? []).filter((t) => t.id !== id) }));
  };

  const switchBoss = (bossId: string) => {
    for (const [, st] of states.current) {
      st.running = false;
      st.endsAt = null;
      st.remainingMs = st.durationSec * 1000;
      st.lastSec = st.durationSec;
    }
    setActiveBoss(bossId);
  };

  // ---- boss list edits ----
  const addBoss = (): string => {
    const id = `boss-${++bossSeq.current}`;
    const [accent, accent2] = ACCENTS[bosses.length % ACCENTS.length];
    // start every new boss with one default skill so it isn't empty
    const tid = `${id}-x${++idSeq.current}`;
    const duration = 20;
    states.current.set(tid, { durationSec: duration, running: false, remainingMs: duration * 1000, endsAt: null, lastSec: duration });
    setBosses((prev) => [...prev, { id, name: "New Boss", accent, accent2 }]);
    setCfgs((prev) => ({ ...prev, [id]: [{ id: tid, label: "Skill 1", duration, pitch: PITCHES[0] }] }));
    return id;
  };
  const renameBoss = (id: string, name: string) => setBosses((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
  const removeBoss = (id: string) => {
    for (const t of cfgsRef.current[id] ?? []) states.current.delete(t.id);
    setCfgs((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    setBosses((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (activeBoss === id) setActiveBoss(next[0]?.id ?? "");
      return next;
    });
  };

  // wipe all customization back to the shipped defaults (handy on a shared public demo)
  const resetConfig = () => {
    const d = defaultConfig();
    states.current.clear();
    for (const list of Object.values(d.cfgs))
      for (const t of list)
        states.current.set(t.id, { durationSec: t.duration, running: false, remainingMs: t.duration * 1000, endsAt: null, lastSec: t.duration });
    idSeq.current = 0;
    bossSeq.current = 0;
    setBosses(d.bosses);
    setCfgs(d.cfgs);
    setActiveBoss(d.bosses[0]?.id ?? "");
  };

  const boss = bosses.find((b) => b.id === activeBoss) ?? bosses[0] ?? FALLBACK_BOSS;
  const timers: TimerView[] = (cfgs[boss.id] ?? []).map((cfg) => {
    const st = states.current.get(cfg.id)!;
    // floor display: an 18s timer reads 17 after the first second ("waited 4s -> 14").
    const secs = Math.floor(st.remainingMs / 1000);
    return {
      cfg,
      durationSec: st.durationSec,
      running: st.running,
      secs,
      progress: Math.max(0, Math.min(1, st.remainingMs / (st.durationSec * 1000))),
      // danger keyed off real time (<=3s left) so the red pulse stays aligned with the 3-2-1 beeps.
      danger: st.running && st.remainingMs <= 3000,
    };
  });

  return {
    boss, bosses, activeBoss, timers, cfgs,
    start, stop, toggle, reset, trigger,
    setDuration, renameTimer, setHotkey, addTimer, removeTimer, switchBoss,
    addBoss, renameBoss, removeBoss, resetConfig,
  };
}
