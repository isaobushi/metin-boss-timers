// ⚠️ THROWAWAY PROTOTYPE — delete me. Answers: "what should the Cooldown strip look
// like, and how does it stay subordinate to the boss-skill chips?" Three structurally
// different treatments of the same data, switchable via ?variant=A|B|C and a floating bar.
// Mounted by main.tsx when the URL has ?proto=cooldowns. No persistence, no real engine —
// a 1s interval ticks absolute expiries so the readout formats + zero-crossing are real.
// Verdict goes in _cooldownStripProto.NOTES.md, then this whole file gets deleted.

import { useEffect, useRef, useState } from "react";
import { DemoScene } from "../DemoScene";
import { urgencyColor } from "./colors";

// ---- mock domain ------------------------------------------------------------
type Anchor = "left" | "right";
type Def = { id: string; name: string; tag: string; durationMs: number };
type Running = { def: Def; expiry: number; startedAt: number };

const H = 3_600_000;
const M = 60_000;

// seeded catalog — the real default dungeons, durations are "examples not gospel"
const CATALOG: Def[] = [
  { id: "hyd", name: "Hydra", tag: "Hyd", durationMs: 15 * M },
  { id: "raz", name: "Razador", tag: "Raz", durationMs: 1 * H },
  { id: "nem", name: "Nemere", tag: "Nem", durationMs: 4 * H },
  { id: "mel", name: "Meley", tag: "Mel", durationMs: 3 * H },
  { id: "bal", name: "Balathor", tag: "Bal", durationMs: 3 * H },
];

// Seed several running cooldowns at hand-picked offsets so every readout state is on
// screen at once: a ≥1h one (2h59), a sub-hour one that visibly ticks (59:12), one
// racing to zero (0:08 → fires the sound + flips to sticky Ready), and one already Ready.
function seedRunning(now: number): Running[] {
  const mk = (id: string, remainingMs: number): Running => {
    const def = CATALOG.find((d) => d.id === id)!;
    return { def, expiry: now + remainingMs, startedAt: now - (def.durationMs - remainingMs) };
  };
  return [
    mk("mel", 2 * H + 59 * M), // 2h59 — ≥1h format
    mk("raz", 59 * M + 12_000), // 59:12 — sub-hour, visibly ticks
    mk("hyd", 8_000), // 0:08 — races to zero, fires the ready beep + sticky Ready
    mk("nem", -30 * M), // elapsed half an hour ago → silent Ready
  ];
}

// ---- readout format (the thing being judged) --------------------------------
// ≥1h → "2h59" (h+min, seconds are noise) · <1h → "59:12" (mm:ss) · ≤0 → "Ready"
function readout(remainingMs: number): string {
  if (remainingMs <= 0) return "Ready";
  if (remainingMs >= H) {
    const h = Math.floor(remainingMs / H);
    const m = Math.floor((remainingMs % H) / M);
    return `${h}h${String(m).padStart(2, "0")}`;
  }
  const totalSec = Math.ceil(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const progress = (r: Running, now: number) =>
  Math.max(0, Math.min(1, (r.expiry - now) / r.def.durationMs));

// ---- tiny beep on a live zero-crossing (best-effort sound, no asset) ---------
function useReadyBeep() {
  const acRef = useRef<AudioContext | null>(null);
  return () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = (acRef.current ??= new AC());
    ac.resume();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(880, ac.currentTime);
    o.frequency.setValueAtTime(1320, ac.currentTime + 0.09);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.5);
  };
}

// ---- shared cooldown state hook (1s tick, restart/clear/start, ready-beep) ---
function useCooldowns() {
  const [now, setNow] = useState(() => Date.now());
  const [running, setRunning] = useState<Running[]>(() => seedRunning(Date.now()));
  const beep = useReadyBeep();
  const wasReady = useRef<Set<string>>(new Set(running.filter((r) => r.expiry <= Date.now()).map((r) => r.def.id)));

  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      // fire the sound the instant a still-running cooldown crosses zero (not on seed,
      // not on the already-elapsed Ala — that one was Ready before we started watching)
      for (const r of running) {
        const id = r.def.id;
        if (r.expiry <= n && !wasReady.current.has(id)) {
          wasReady.current.add(id);
          beep();
        }
      }
    }, 250); // 250ms so the 0:08 racer feels live; real impl uses 1s
    return () => clearInterval(t);
  }, [running, beep]);

  // Start a cooldown at an optional tuned duration (the picker wheels this before starting).
  const start = (def: Def, durationMs: number = def.durationMs) => {
    const n = Date.now();
    wasReady.current.delete(def.id);
    setRunning((rs) => {
      const without = rs.filter((r) => r.def.id !== def.id); // one instance per definition
      return [...without, { def, expiry: n + durationMs, startedAt: n }];
    });
  };
  const restart = (id: string) => {
    const def = CATALOG.find((d) => d.id === id)!;
    start(def);
  };
  const clear = (id: string) => {
    wasReady.current.delete(id);
    setRunning((rs) => rs.filter((r) => r.def.id !== id));
  };
  return { now, running, start, restart, clear };
}

// Velocity → time-chunk, STREAK-based. A deliberate single notch is always 1m (precise);
// the step only ramps while you KEEP spinning fast. A pause (gap > GAP_MS) or switching
// rows resets the streak to 1m — so one stray fast flick can never overshoot to 1h. This
// is the "tune the tuning" model: ramp on sustained speed, not on a single fast event.
const GAP_MS = 160; // notches closer than this in time count toward the streak
function chunkForStreak(streak: number): number {
  if (streak >= 18) return H; // long sustained spin → 1h
  if (streak >= 11) return 30 * M;
  if (streak >= 6) return 15 * M;
  if (streak >= 3) return 5 * M;
  return M; // first few notches → 1m, always precise
}
const chunkLabel = (ms: number) => (ms >= H ? `${ms / H}h` : `${ms / M}m`);
// Snap a tuned duration onto the active chunk's grid, so big steps land on clean values
// (2h30, not 2h27) while a 1m step stays exact.
const snapTo = (ms: number, chunk: number) => Math.round(ms / chunk) * chunk;

type StripProps = ReturnType<typeof useCooldowns>;

// Duration label for the picker rows: "3h00" / "2h30" / "45m" (no seconds at this scale).
function fmtDur(ms: number): string {
  const h = Math.floor(ms / H);
  const m = Math.round((ms % H) / M);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}m`;
}

// ---- the selection panel (the + picker) -------------------------------------
// Pick a catalog cooldown to start. Wheel over a row to TUNE its duration before
// starting — velocity-chunked (faster spin → bigger step). This is the only place the
// wheel lives; running pills are click-restart / right-click-clear only.
function Picker({ onStart, accent = "#7c6cff", align = "left" }: { onStart: (d: Def, durationMs: number) => void; accent?: string; align?: Anchor }) {
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState<Record<string, number>>({});
  const vel = useRef({ streak: 0, last: 0, id: "" });
  const [step, setStep] = useState<{ id: string; label: string } | null>(null);
  const stepTimer = useRef<number | undefined>(undefined);
  const durOf = (d: Def) => override[d.id] ?? d.durationMs;

  const onWheel = (d: Def, e: React.WheelEvent) => {
    const t = performance.now();
    const v = vel.current;
    if (d.id !== v.id) {
      v.id = d.id; // new row → fresh streak
      v.streak = 0;
    } else {
      v.streak = t - v.last < GAP_MS ? v.streak + 1 : 0; // pause → back to 1m steps
    }
    v.last = t;
    const chunk = chunkForStreak(v.streak);
    const dir = e.deltaY < 0 ? 1 : -1; // scroll up = add time
    const next = Math.max(M, Math.min(12 * H, snapTo(durOf(d) + dir * chunk, chunk)));
    setOverride((o) => ({ ...o, [d.id]: next }));
    setStep({ id: d.id, label: `${dir > 0 ? "+" : "−"}${chunkLabel(chunk)}` });
    clearTimeout(stepTimer.current);
    stepTimer.current = window.setTimeout(() => setStep(null), 650);
  };

  return (
    <div className="cdp-picker">
      <button className="cdp-add" style={{ ["--a" as string]: accent }} onClick={() => setOpen((o) => !o)} title="start a cooldown">
        +
      </button>
      {open && (
        <div className={`cdp-menu${align === "right" ? " is-right" : ""}`}>
          <div className="cdp-menu__hint">scroll a row to tune · click to start</div>
          {CATALOG.map((d) => (
            <button
              key={d.id}
              className="cdp-menu__item"
              onWheel={(e) => onWheel(d, e)}
              onClick={() => {
                onStart(d, durOf(d));
                setOpen(false);
              }}
            >
              <b>{d.tag}</b> {d.name}
              <span className="cdp-menu__dur">
                {fmtDur(durOf(d))}
                {step?.id === d.id && <em className="cdp-menu__step">{step.label}</em>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// VARIANT A — "Whisper row": ultra-subdued text-only pills in the overlay column,
// directly above the boss panel. No bars, low opacity, smallest footprint. Most
// subordinate. tag in accent, number tabular. Ready = the only thing that lights up.
// =============================================================================
function VariantA({ now, running, restart, clear, start, anchor }: StripProps & { anchor: Anchor }) {
  return (
    <div className={`cdp-a${anchor === "right" ? " is-right" : ""}`}>
      {running.map((r) => {
        const rem = r.expiry - now;
        const ready = rem <= 0;
        return (
          <button
            key={r.def.id}
            className={`cdp-a__pill${ready ? " is-ready" : ""}`}
            onClick={() => restart(r.def.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              clear(r.def.id);
            }}
            title={`${r.def.name} — left-click restart · right-click clear`}
          >
            <span className="cdp-a__tag">{r.def.tag}</span>
            <span className="cdp-a__num">{readout(rem)}</span>
          </button>
        );
      })}
      <Picker onStart={start} align={anchor} />
    </div>
  );
}

// =============================================================================
// VARIANT B — "Mini-chips": echoes the boss chip, shrunk to a 4-col grid, each with a
// hairline urgency micro-bar (reuses urgencyColor). Most informative (you SEE drain),
// but heaviest — tests whether a bar reads at 3h scale or is just noise.
// =============================================================================
function VariantB({ now, running, restart, clear }: StripProps) {
  return (
    <div className="cdp-b">
      {running.map((r) => {
        const rem = r.expiry - now;
        const ready = rem <= 0;
        const p = progress(r, now);
        const color = ready ? "#39ff88" : urgencyColor(p);
        return (
          <button
            key={r.def.id}
            className={`cdp-b__chip${ready ? " is-ready" : ""}`}
            onClick={() => restart(r.def.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              clear(r.def.id);
            }}
            title={`${r.def.name} — left-click restart · right-click clear`}
          >
            <div className="cdp-b__row">
              <span className="cdp-b__tag">{r.def.tag}</span>
              <span className="cdp-b__num" style={{ color: ready ? color : undefined }}>
                {readout(rem)}
              </span>
            </div>
            <div className="cdp-b__track">
              <div className="cdp-b__fill" style={{ transform: `scaleX(${ready ? 1 : p})`, background: color }} />
            </div>
          </button>
        );
      })}
      <Picker onStart={() => {}} />
    </div>
  );
}

// =============================================================================
// VARIANT C — "Status rail": a detached, full-width ticker bar pinned to the very top
// edge of the SCREEN (not inside the overlay column), physically separated from the boss
// panel. Monospace segments TAG·2h59 split by dividers. Treats cooldowns as ambient HUD.
// =============================================================================
function VariantC({ now, running, restart, clear, start }: StripProps) {
  return (
    <div className="cdp-c">
      <span className="cdp-c__lead">CD</span>
      {running.map((r) => {
        const rem = r.expiry - now;
        const ready = rem <= 0;
        return (
          <button
            key={r.def.id}
            className={`cdp-c__seg${ready ? " is-ready" : ""}`}
            onClick={() => restart(r.def.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              clear(r.def.id);
            }}
            title={`${r.def.name} — left-click restart · right-click clear`}
          >
            <b>{r.def.tag}</b>
            <span>{readout(rem)}</span>
          </button>
        );
      })}
      <Picker onStart={start} accent="#00e5ff" />
    </div>
  );
}

// ---- realistic boss panel beneath, so the strip is judged in real density ----
function MockBossPanel() {
  const chips = [
    { label: "Stun", count: "14", p: 0.7 },
    { label: "Heal Block", count: "08", p: 0.4, key: "F1" },
    { label: "Enrage", count: "03", p: 0.15 },
  ];
  return (
    <div className="panel timer-screen" style={{ ["--accent" as string]: "#7c6cff" }}>
      <div className="timer-head">
        <button className="icon-btn" title="change boss">←</button>
        <span className="timer-head__name">BALATHOR</span>
        <button className="icon-btn icon-btn--danger" title="close">✕</button>
      </div>
      {chips.map((c) => (
        <div key={c.label} className="chip">
          <div className="chip__head">
            <span className="chip__label">{c.label}</span>
            {c.key && <span className="chip__key">{c.key}</span>}
            <span className="chip__count">{c.count}</span>
          </div>
          <div className="chip__track">
            <div className="chip__fill" style={{ transform: `scaleX(${c.p})`, backgroundColor: urgencyColor(c.p) }} />
          </div>
        </div>
      ))}
      <div className="timer-hint">
        <b>left-click</b> stop / start · <b>right-click</b> reset
      </div>
    </div>
  );
}

// ---- switcher ---------------------------------------------------------------
const VARIANTS = ["A", "B", "C"] as const;
type V = (typeof VARIANTS)[number];
const NAMES: Record<V, string> = { A: "Whisper row", B: "Mini-chips", C: "Status rail" };

function readVariant(): V {
  const v = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  return (VARIANTS as readonly string[]).includes(v ?? "") ? (v as V) : "A";
}

function Switcher({
  v,
  setV,
  panel,
  setPanel,
  anchor,
  setAnchor,
}: {
  v: V;
  setV: (v: V) => void;
  panel: boolean;
  setPanel: (b: boolean) => void;
  anchor: Anchor;
  setAnchor: (a: Anchor) => void;
}) {
  const go = (dir: number) => {
    const i = (VARIANTS.indexOf(v) + dir + VARIANTS.length) % VARIANTS.length;
    const nv = VARIANTS[i];
    const u = new URL(window.location.href);
    u.searchParams.set("variant", nv);
    window.history.replaceState(null, "", u);
    setV(nv);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="cdp-switch">
      <button onClick={() => go(-1)}>←</button>
      <span>
        {v} — {NAMES[v]}
      </span>
      <button onClick={() => go(1)}>→</button>
      <button className={`cdp-switch__toggle${panel ? " is-on" : ""}`} onClick={() => setPanel(!panel)} title="toggle the boss panel — off = cooldowns-only standalone mode">
        {panel ? "panel: on" : "cooldowns only"}
      </button>
      <button className="cdp-switch__toggle is-anchor" onClick={() => setAnchor(anchor === "left" ? "right" : "left")} title="anchor the overlay to the left or right edge">
        anchor: {anchor}
      </button>
    </div>
  );
}

export function CooldownStripPrototype() {
  const [v, setV] = useState<V>(readVariant);
  const [panel, setPanel] = useState(true); // standalone mode = strip without the boss panel
  const [anchor, setAnchor] = useState<Anchor>("left");
  const cd = useCooldowns();
  const edge = anchor === "right" ? { right: 12 } : { left: 12 };
  return (
    <>
      <PrototypeStyles />
      <DemoScene />
      {/* Variant C is screen-pinned; A & B live in the overlay column above the boss panel */}
      {v === "C" && <VariantC {...cd} />}
      <div
        className="overlay"
        style={{ position: "fixed", top: v === "C" ? 56 : 12, ...edge, alignItems: anchor === "right" ? "flex-end" : "flex-start" }}
      >
        {v === "A" && <VariantA {...cd} anchor={anchor} />}
        {v === "B" && <VariantB {...cd} />}
        {panel && <MockBossPanel />}
      </div>
      <Switcher v={v} setV={setV} panel={panel} setPanel={setPanel} anchor={anchor} setAnchor={setAnchor} />
    </>
  );
}

// ---- prototype-only CSS (kept here so deleting the file removes everything) --
function PrototypeStyles() {
  return (
    <style>{`
    .cdp-switch{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:999;
      display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:999px;
      background:#111018;border:1px solid #ffffff30;box-shadow:0 6px 22px #000a;
      font:600 12px/1 ui-monospace,monospace;color:#fff}
    .cdp-switch button{width:26px;height:26px;border-radius:50%;border:1px solid #ffffff30;
      background:#1d1b27;color:#fff;cursor:pointer;font-size:13px}
    .cdp-switch span{min-width:130px;text-align:center;letter-spacing:.5px}
    .cdp-switch__toggle{width:auto!important;height:26px;padding:0 11px;border-radius:13px!important;
      font:600 11px/1 ui-monospace,monospace;letter-spacing:.3px}
    .cdp-switch__toggle.is-on{color:#9b8cff;border-color:#9b8cff66}
    .cdp-switch__toggle:not(.is-on){color:#39ff88;border-color:#39ff8866}

    /* shared picker */
    .cdp-picker{position:relative;display:inline-flex}
    .cdp-add{--a:#7c6cff;width:26px;height:26px;flex:none;border-radius:8px;cursor:pointer;
      font:700 15px/1 inherit;color:#fff;background:color-mix(in srgb,var(--a) 18%,transparent);
      border:1px dashed color-mix(in srgb,var(--a) 60%,transparent)}
    .cdp-add:hover{background:color-mix(in srgb,var(--a) 30%,transparent)}
    .cdp-menu{position:absolute;top:30px;left:0;z-index:50;width:184px;display:flex;flex-direction:column;
      padding:5px;gap:2px;border-radius:10px;background:rgba(14,11,22,.96);border:1px solid #ffffff22;
      box-shadow:0 12px 30px #000c;backdrop-filter:blur(8px)}
    /* right-anchored: open the menu from the right edge so it doesn't run off-screen */
    .cdp-menu.is-right{left:auto;right:0}
    .cdp-menu__item{display:flex;align-items:center;gap:7px;padding:7px 8px;border:none;border-radius:7px;
      background:transparent;color:#e9e5f5;font:500 12px/1 inherit;cursor:pointer;text-align:left}
    .cdp-menu__item:hover{background:#ffffff14}
    .cdp-menu__item b{color:#9b8cff;font-size:11px;letter-spacing:.5px;width:30px}
    .cdp-menu__dur{margin-left:auto;opacity:.7;font-size:10px;font-variant-numeric:tabular-nums;color:#cdbcff}
    .cdp-menu__hint{font-size:9px;letter-spacing:.4px;opacity:.45;padding:2px 6px 4px}
    /* transient velocity badge — the chunk size while wheeling a picker row */
    .cdp-menu__step{margin-left:6px;padding:1px 5px;border-radius:6px;font-style:normal;
      font:700 9px/1.4 ui-monospace,monospace;color:#0a0712;background:#ffd166}

    /* VARIANT A — whisper row */
    .cdp-a{display:flex;flex-wrap:wrap;gap:5px;width:316px;padding:2px 2px 6px;
      max-width:316px}
    /* right-anchored: pills hug the right edge and wrap from the right */
    .cdp-a.is-right{justify-content:flex-end}
    .cdp-a__pill{display:inline-flex;align-items:baseline;gap:5px;padding:3px 8px;border-radius:7px;
      cursor:pointer;background:rgba(12,10,20,.5);border:1px solid #ffffff14;
      font:inherit;opacity:.72;transition:opacity .15s}
    .cdp-a__pill:hover{opacity:1}
    .cdp-a__tag{font-size:10px;font-weight:700;letter-spacing:.5px;color:#9b8cff;text-transform:uppercase}
    .cdp-a__num{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:#d8d2ea}
    .cdp-a__pill.is-ready{opacity:1;border-color:#39ff8855;background:#39ff881f;
      box-shadow:0 0 12px #39ff8840;animation:cdp-pulse 1.4s ease-in-out infinite}
    .cdp-a__pill.is-ready .cdp-a__num{color:#39ff88}
    .cdp-a__pill.is-ready .cdp-a__tag{color:#9affc4}

    /* VARIANT B — mini-chips grid */
    .cdp-b{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:316px;padding:2px 0 8px}
    .cdp-b__chip{display:flex;flex-direction:column;gap:5px;padding:6px 7px;border-radius:9px;cursor:pointer;
      background:rgba(12,10,20,.72);border:1px solid #ffffff14;text-align:left}
    .cdp-b__chip:hover{border-color:#ffffff2e}
    .cdp-b__chip.is-ready{border-color:#39ff8855;box-shadow:0 0 12px #39ff8840;animation:cdp-pulse 1.4s ease-in-out infinite}
    .cdp-b__row{display:flex;align-items:baseline;justify-content:space-between;gap:4px}
    .cdp-b__tag{font-size:9px;font-weight:700;letter-spacing:.5px;color:#9b8cff;text-transform:uppercase}
    .cdp-b__num{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:#e3def2}
    .cdp-b__track{height:3px;border-radius:3px;background:#ffffff14;overflow:hidden}
    .cdp-b__fill{height:100%;border-radius:3px;transform-origin:left center}
    /* the + sits in its own grid cell, vertically centred */
    .cdp-b .cdp-picker{display:flex;align-items:center;justify-content:center}
    .cdp-b .cdp-add{width:100%;height:100%;min-height:38px}

    /* VARIANT C — status rail (screen-pinned, detached from overlay) */
    .cdp-c{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;gap:0;
      height:34px;padding:0 12px;background:linear-gradient(180deg,rgba(8,6,14,.92),rgba(8,6,14,.66));
      border-bottom:1px solid #00e5ff22;backdrop-filter:blur(8px);
      font:600 12px/1 ui-monospace,SFMono-Regular,monospace}
    .cdp-c__lead{font-size:9px;letter-spacing:2px;color:#00e5ff;opacity:.6;margin-right:10px}
    .cdp-c__seg{display:inline-flex;align-items:baseline;gap:6px;padding:0 12px;height:100%;
      border:none;border-right:1px solid #ffffff12;background:transparent;cursor:pointer;
      color:#cfeaf2;font:inherit}
    .cdp-c__seg:first-of-type{border-left:1px solid #ffffff12}
    .cdp-c__seg:hover{background:#ffffff0c}
    .cdp-c__seg b{font-size:10px;letter-spacing:.5px;color:#7fdcff;text-transform:uppercase}
    .cdp-c__seg span{font-variant-numeric:tabular-nums}
    .cdp-c__seg.is-ready{background:#39ff8814}
    .cdp-c__seg.is-ready b{color:#9affc4}
    .cdp-c__seg.is-ready span{color:#39ff88;animation:cdp-pulse 1.4s ease-in-out infinite}
    .cdp-c .cdp-picker{margin-left:8px}
    .cdp-c .cdp-add{width:22px;height:22px;font-size:13px}

    @keyframes cdp-pulse{0%,100%{opacity:1}50%{opacity:.55}}
  `}</style>
  );
}
