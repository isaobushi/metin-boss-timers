// THROWAWAY UI prototype — "tool dock" for the overlay (mounted at #dock).
//
// Question: how should a dock of tool-icons (dungeon skills, dungeon cooldowns,
// elapsable items, routine checklist, settings) look + behave — compact badge states
// + reveal-on-hover panels — without the overlay feeling like it "does many things"?
//
// Three STRUCTURALLY different answers, switch with ?variant=A|B|C (or ← / →):
//   A  Whisper dock   — collapsed icons in one tiny pill-bar; hover pops a floating panel.
//   B  Two-tier       — dungeon stuff stays a persistent panel; slow chores live on a
//                       thin side-rail of badges that open drawers (split by rhythm).
//   C  Status line    — one dense bar showing each tool's most-urgent datum inline;
//                       click a segment to expand it as an inline accordion.
//
// Mock data only, in-memory, ticking each second. Delete once a direction wins.
import { useEffect, useState } from "react";
import { DemoScene } from "../DemoScene";
import "./dock-proto.css";

// ---- mock model ---------------------------------------------------------
const DAY = 86400;
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt(sec: number): string {
  if (sec <= 0) return "Ready";
  const d = Math.floor(sec / DAY);
  const h = Math.floor((sec % DAY) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${pad(h)}h`;
  if (h > 0) return `${h}h${pad(m)}`;
  return `${m}:${pad(s)}`;
}
// compact badge form (no minutes when it's days/hours away)
function badge(sec: number): string {
  if (sec <= 0) return "✓";
  const d = Math.floor(sec / DAY);
  const h = Math.floor((sec % DAY) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
const ALARM = DAY; // elapsable item "alarm mode" when under 24h to elapse

type CD = { tag: string; name: string; sec: number };
type Item = { icon: string; name: string; sec: number };
type Chore = { name: string; sec: number; done: boolean };

const COOLDOWNS: CD[] = [
  { tag: "Hyd", name: "Hydra", sec: 12 * 60 + 30 },
  { tag: "Raz", name: "Razador", sec: 0 },
  { tag: "Nem", name: "Nemere", sec: 64 * 60 },
];
const ITEMS: Item[] = [
  { icon: "👘", name: "Costume of Flame", sec: 5 * 3600 + 12 * 60 }, // alarm (<24h)
  { icon: "🐺", name: "Snow Wolf — pet", sec: 2 * DAY + 6 * 3600 },
  { icon: "🐴", name: "Battle Horse — mount", sec: 18 * 3600 + 40 * 60 }, // alarm
];
const CHORES: Chore[] = [
  { name: "Give item to Biologist", sec: 0, done: false }, // executable now
  { name: "Read Enchanted Blade", sec: 0, done: true }, // already read today
  { name: "Read Soul Crystal Book", sec: 3 * 3600, done: false }, // executable in 3h
  { name: "Daily Dungeon clear", sec: 0, done: true },
];

// a single live clock that drains every countdown so the badges feel real
function useTick(items: { sec: number }[]) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      for (const it of items) if (it.sec > 0) it.sec -= 1;
      force((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [items]);
}

const minSec = (xs: { sec: number }[]) => Math.min(...xs.map((x) => x.sec));
const doneCount = () => CHORES.filter((c) => c.done).length;
const readyChores = () => CHORES.filter((c) => !c.done && c.sec <= 0).length;

// ===== Variant A — whisper dock =========================================
export function VariantA() {
  useTick([...COOLDOWNS, ...ITEMS, ...CHORES]);
  const [open, setOpen] = useState<string | null>(null);
  const itemMin = minSec(ITEMS);
  const cdReady = COOLDOWNS.filter((c) => c.sec <= 0).length;

  const tools = [
    { id: "skills", icon: "⚔", badge: null as null | string, cls: "" },
    { id: "cd", icon: "⏱", badge: cdReady ? `${cdReady}✓` : String(COOLDOWNS.length), cls: cdReady ? "is-ready" : "" },
    { id: "items", icon: "🎒", badge: badge(itemMin), cls: itemMin < ALARM ? "is-alarm" : "" },
    { id: "routine", icon: "✓", badge: `${doneCount()}/${CHORES.length}`, cls: readyChores() ? "is-ready" : "" },
    { id: "settings", icon: "⚙", badge: null, cls: "" },
  ];

  return (
    <div className="dpa-bar dp-glass" onMouseLeave={() => setOpen(null)}>
      {tools.map((t) => (
        <div key={t.id} style={{ position: "relative" }}>
          <button
            className={`dpa-btn${open === t.id ? " is-open" : ""}`}
            onMouseEnter={() => setOpen(t.id)}
            onClick={() => setOpen(open === t.id ? null : t.id)}
          >
            {t.icon}
            {t.badge && <span className={`dpa-badge ${t.cls}`}>{t.badge}</span>}
          </button>
          {open === t.id && t.id !== "settings" && t.id !== "skills" && (
            <div className="dpa-pop dp-glass">
              {t.id === "cd" && <ApopCooldowns />}
              {t.id === "items" && <ApopItems />}
              {t.id === "routine" && <ApopRoutine />}
            </div>
          )}
          {open === t.id && t.id === "skills" && (
            <div className="dpa-pop dp-glass">
              <div className="dpa-pop__title">Templum Serpens — Phase 2</div>
              <div className="dpb-seq">{["L1", "L2", "L3", "R1", "R2", "R3"].map((n) => <div key={n} className="dpb-node">{n}</div>)}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function ApopCooldowns() {
  return (
    <>
      <div className="dpa-pop__title">Dungeon cooldowns</div>
      {COOLDOWNS.map((c) => (
        <div key={c.tag} className="dpa-line">
          <span className="dp-tag">{c.tag}</span>
          <span className="dpa-line__name">{c.name}</span>
          <span className={`dpa-line__val dp-num ${c.sec <= 0 ? "dp-ready" : ""}`}>{fmt(c.sec)}</span>
        </div>
      ))}
    </>
  );
}
function ApopItems() {
  return (
    <>
      <div className="dpa-pop__title">Elapsable items</div>
      {ITEMS.map((it) => (
        <div key={it.name} className="dpa-line">
          <span>{it.icon}</span>
          <span className="dpa-line__name">{it.name}</span>
          <span className={`dpa-line__val dp-num ${it.sec < ALARM ? "dp-alarm" : ""}`}>{fmt(it.sec)}</span>
        </div>
      ))}
    </>
  );
}
function ApopRoutine() {
  return (
    <>
      <div className="dpa-pop__title">Daily routine</div>
      {CHORES.map((c) => (
        <div key={c.name} className="dpa-line">
          <span className={`dpa-check${c.done ? " is-done" : ""}`}>{c.done ? "✓" : ""}</span>
          <span className={`dpa-line__name${c.done ? " dp-muted" : ""}`}>{c.name}</span>
          <span className={`dpa-line__val dp-num ${c.sec <= 0 && !c.done ? "dp-ready" : "dp-muted"}`}>
            {c.done ? "done" : c.sec <= 0 ? "ready" : `in ${fmt(c.sec)}`}
          </span>
        </div>
      ))}
    </>
  );
}

// ===== Variant B — two-tier (persistent panel + slow-rail) ==============
export function VariantB() {
  useTick([...COOLDOWNS, ...ITEMS, ...CHORES]);
  const [open, setOpen] = useState<string | null>(null);
  const itemMin = minSec(ITEMS);
  return (
    <div className="dpb-wrap">
      {/* the always-open fast play surface */}
      <div className="dpb-panel dp-glass">
        <div className="dpb-panel__head">⚔ Templum Serpens — Phase 2</div>
        <div className="dpb-seq">{["L1", "L2", "L3", "R1", "R2", "R3"].map((n) => <div key={n} className="dpb-node">{n}</div>)}</div>
        <div className="dpb-panel__head">⏱ Dungeon cooldowns</div>
        <div className="dpb-cds">
          {COOLDOWNS.map((c) => (
            <div key={c.tag} className={`dpb-cd${c.sec <= 0 ? " is-ready" : ""}`}>
              <span className="dp-tag">{c.tag}</span>
              <span className={`dpb-cd__val${c.sec <= 0 ? " dp-ready" : ""}`}>{fmt(c.sec)}</span>
            </div>
          ))}
        </div>
      </div>
      {/* the peripheral slow-chore rail */}
      <div className="dpb-rail dp-glass" onMouseLeave={() => setOpen(null)}>
        {[
          { id: "items", icon: "🎒", badge: badge(itemMin), alarm: itemMin < ALARM },
          { id: "routine", icon: "✓", badge: `${doneCount()}/${CHORES.length}`, alarm: false },
          { id: "settings", icon: "⚙", badge: null, alarm: false },
        ].map((t) => (
          <div key={t.id} style={{ position: "relative" }}>
            <button
              className={`dpb-railbtn${open === t.id ? " is-open" : ""}`}
              onMouseEnter={() => setOpen(t.id)}
              onClick={() => setOpen(open === t.id ? null : t.id)}
            >
              {t.icon}
              {t.badge && <span className={`dpb-railbadge${t.alarm ? " is-alarm" : ""}`}>{t.badge}</span>}
            </button>
            {open === t.id && t.id === "items" && (
              <div className="dpb-drawer dp-glass"><ApopItems /></div>
            )}
            {open === t.id && t.id === "routine" && (
              <div className="dpb-drawer dp-glass"><ApopRoutine /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Variant C — dense status line + inline accordion =================
export function VariantC() {
  useTick([...COOLDOWNS, ...ITEMS, ...CHORES]);
  const [open, setOpen] = useState<string | null>(null);
  const itemMin = minSec(ITEMS);
  const soonItem = ITEMS.reduce((a, b) => (a.sec < b.sec ? a : b));
  const nextCd = COOLDOWNS.reduce((a, b) => (a.sec < b.sec ? a : b));

  const segs = [
    { id: "skills", icon: "⚔", label: "Templum", val: "P2", cls: "" },
    { id: "cd", icon: "⏱", label: nextCd.tag, val: fmt(nextCd.sec), cls: nextCd.sec <= 0 ? "dp-ready" : "" },
    { id: "items", icon: soonItem.icon, label: "", val: fmt(itemMin), cls: itemMin < ALARM ? "dp-alarm" : "" },
    { id: "routine", icon: "✓", label: "", val: `${doneCount()}/${CHORES.length}`, cls: readyChores() ? "dp-ready" : "" },
    { id: "settings", icon: "⚙", label: "", val: "", cls: "" },
  ];

  return (
    <div className="dp-glass" style={{ borderRadius: 12, width: 360 }}>
      <div className="dpc-bar">
        {segs.map((s) => (
          <div
            key={s.id}
            className={`dpc-seg${open === s.id ? " is-open" : ""}`}
            onClick={() => setOpen(open === s.id ? null : s.id)}
          >
            <span className="dpc-seg__icon">{s.icon}</span>
            {s.label && <span className="dp-tag">{s.label}</span>}
            {s.val && <span className={`dpc-seg__val ${s.cls}`}>{s.val}</span>}
          </div>
        ))}
      </div>
      {open && open !== "settings" && (
        <div className="dpc-acc">
          {open === "skills" && (
            <div className="dpb-seq">{["L1", "L2", "L3", "R1", "R2", "R3"].map((n) => <div key={n} className="dpb-node">{n}</div>)}</div>
          )}
          {open === "cd" && COOLDOWNS.map((c) => (
            <div key={c.tag} className="dpc-row">
              <span className="dp-tag">{c.tag}</span>
              <span className="dpc-row__name">{c.name}</span>
              <span className={`dp-num ${c.sec <= 0 ? "dp-ready" : ""}`}>{fmt(c.sec)}</span>
            </div>
          ))}
          {open === "items" && ITEMS.map((it) => (
            <div key={it.name} className="dpc-row">
              <span>{it.icon}</span>
              <span className="dpc-row__name">{it.name}</span>
              <span className={`dp-num ${it.sec < ALARM ? "dp-alarm" : ""}`}>{fmt(it.sec)}</span>
            </div>
          ))}
          {open === "routine" && CHORES.map((c) => (
            <div key={c.name} className="dpc-row">
              <span className={`dpa-check${c.done ? " is-done" : ""}`}>{c.done ? "✓" : ""}</span>
              <span className={`dpc-row__name${c.done ? " dp-muted" : ""}`}>{c.name}</span>
              <span className={`dp-num ${c.sec <= 0 && !c.done ? "dp-ready" : "dp-muted"}`}>
                {c.done ? "done" : c.sec <= 0 ? "ready" : `in ${fmt(c.sec)}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== switcher + host ==================================================
const VARIANTS: Record<string, { name: string; el: () => React.ReactElement }> = {
  A: { name: "Whisper dock (icons + hover popovers)", el: VariantA },
  B: { name: "Two-tier (play panel + chore rail)", el: VariantB },
  C: { name: "Status line (inline accordion)", el: VariantC },
};
const KEYS = Object.keys(VARIANTS);

export default function DockProto() {
  const [variant, setVariant] = useState(() => {
    const v = new URLSearchParams(location.search).get("variant");
    return v && VARIANTS[v] ? v : "A";
  });
  const go = (v: string) => {
    setVariant(v);
    const u = new URL(location.href);
    u.searchParams.set("variant", v);
    history.replaceState(null, "", u);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === "ArrowLeft") go(KEYS[(KEYS.indexOf(variant) - 1 + KEYS.length) % KEYS.length]);
      if (e.key === "ArrowRight") go(KEYS[(KEYS.indexOf(variant) + 1) % KEYS.length]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const Current = VARIANTS[variant].el;
  const isProd = import.meta.env.PROD;
  return (
    <>
      <DemoScene />
      <div className="dp-root">
        <Current />
      </div>
      {!isProd && (
        <div className="dp-switch">
          <button onClick={() => go(KEYS[(KEYS.indexOf(variant) - 1 + KEYS.length) % KEYS.length])} aria-label="previous">‹</button>
          <span className="dp-switch__label">{variant} — {VARIANTS[variant].name}</span>
          <button onClick={() => go(KEYS[(KEYS.indexOf(variant) + 1) % KEYS.length])} aria-label="next">›</button>
          <span className="dp-switch__hint">← →</span>
        </div>
      )}
    </>
  );
}
