// PROTOTYPE — WINNER (variant C, "Draining Chips"). Pick-boss-first flow:
// screen 1 = choose boss (gear → per-boss settings); screen 2 = that boss's draining-chip timers.
import { useEffect, useRef, useState } from "react";
import type { useBossTimers } from "../useBossTimers";
import type { Boss } from "../useBossTimers";
import { urgencyColor } from "../colors";

type Eng = ReturnType<typeof useBossTimers>;

// hotkeys are stored as normalized combo strings, e.g. "k", "ctrl+k", "ctrl+shift+k".
const MODS = new Set(["Control", "Shift", "Alt", "Meta"]);
function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODS.has(e.key)) return null; // modifier-only press: keep waiting
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("meta");
  parts.push(e.key === " " ? "space" : e.key.toLowerCase());
  return parts.join("+");
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const keyLabel = (k?: string) =>
  !k ? "—" : k.split("+").map((p) => (p.length === 1 ? p.toUpperCase() : cap(p))).join("+");

export const shell = (accent: string): React.CSSProperties => ({
  position: "fixed", top: 14, right: 14, display: "flex", borderRadius: 14, color: "#f5f3ff",
  background: "rgba(14,11,22,0.86)", border: `1px solid ${accent}55`,
  backdropFilter: "blur(10px)", boxShadow: `0 10px 30px #000a, 0 0 22px ${accent}33`, zIndex: 50,
});

const CHIP_W = 268; // full inner width of the draining fill (chip 270 - 2px border)

function Chip({ eng, i }: { eng: Eng; i: number }) {
  const t = eng.timers[i];
  const accent = urgencyColor(t.progress);
  return (
    <div className={`pchip ${t.danger ? "danger" : ""}`}
      style={{ position: "relative", width: 270, height: 48, borderRadius: 10, overflow: "hidden",
        border: `1px solid ${t.running ? accent + "66" : "#ffffff1f"}`, color: accent, background: "#15101f", cursor: "pointer" }}
      onClick={() => eng.toggle(t.cfg.id)}
      onContextMenu={(e) => { e.preventDefault(); eng.reset(t.cfg.id); }}
      title="left-click: start/stop · right-click: reset">
      {/* GPU-composited draining fill (transform, not width — repaints reliably every frame) */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: CHIP_W, transformOrigin: "left center",
        transform: `scaleX(${t.progress})`, opacity: t.running ? 1 : 0.5,
        background: `linear-gradient(90deg, ${accent}40, ${accent}85)` }} />
      {t.running && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          transform: `translateX(${t.progress * CHIP_W - 3}px)`,
          background: accent, boxShadow: `0 0 14px ${accent}, 0 0 4px ${accent}` }} />
      )}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        opacity: t.running ? 1 : 0.6 }}>
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, minWidth: 34, textAlign: "right",
          textShadow: `0 0 10px ${accent}` }}>{t.secs}</div>
        <div style={{ flex: 1, fontSize: 11, letterSpacing: 1.5, opacity: 0.75 }}>{t.cfg.label.toUpperCase()}</div>
        {t.cfg.hotkey && (
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: "#cfc8e0", opacity: 0.75 }}>
            {keyLabel(t.cfg.hotkey)}
          </div>
        )}
      </div>
    </div>
  );
}

function BossSelect({ eng, onPick, onSettings }: { eng: Eng; onPick: (id: string) => void; onSettings: (id: string) => void }) {
  return (
    <div style={{ ...shell("#7c6cff"), width: 220, flexDirection: "column", padding: 14, gap: 10, alignItems: "stretch" }}>
      <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.6, textAlign: "center" }}>SELECT BOSS</div>
      {eng.bosses.map((b) => (
        <div key={b.id} style={{ position: "relative", display: "flex" }}>
          <button onClick={() => onPick(b.id)}
            style={{ flex: 1, padding: "16px 0", borderRadius: 10, fontSize: 16, letterSpacing: 2, fontWeight: 700, color: "#fff",
              border: `1px solid ${b.accent}`, background: `linear-gradient(180deg, ${b.accent}33, ${b.accent2}1a)`,
              boxShadow: `0 0 16px ${b.accent}44` }}>
            {b.name.toUpperCase()}
          </button>
          <button onClick={() => onSettings(b.id)} title={`${b.name} settings`}
            style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 6, fontSize: 12, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", border: `1px solid ${b.accent}66`, background: "rgba(8,6,14,0.55)" }}>
            ⚙
          </button>
        </div>
      ))}
      {eng.bosses.length === 0 && (
        <div style={{ fontSize: 11, opacity: 0.5, textAlign: "center", padding: "4px 0" }}>no bosses yet</div>
      )}
      <button onClick={() => onSettings(eng.addBoss())}
        style={{ marginTop: 2, padding: "10px 0", fontSize: 12, letterSpacing: 1, fontWeight: 700, color: "#fff",
          background: "#7c6cff22", border: "1px dashed #7c6cff88", borderRadius: 8 }}>
        + ADD BOSS
      </button>
    </div>
  );
}

function SettingsRow({ eng, boss, t, capturing, setCapturing }: {
  eng: Eng; boss: Boss; t: { id: string; label: string; duration: number; hotkey?: string };
  capturing: string | null; setCapturing: (id: string | null) => void;
}) {
  const isCapturing = capturing === t.id;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <input value={t.label} onChange={(e) => eng.renameTimer(t.id, e.target.value)} placeholder="name"
        style={{ flex: 1, minWidth: 0, padding: "6px 7px", fontSize: 12, color: "#f5f3ff",
          background: "#15101f", border: `1px solid ${boss.accent}44`, borderRadius: 7 }} />
      <input type="number" min={1} max={999} value={t.duration}
        onChange={(e) => eng.setDuration(t.id, Number(e.target.value))} title="duration (s)"
        style={{ width: 46, padding: "6px 6px", fontSize: 12, textAlign: "right", color: "#f5f3ff",
          background: "#15101f", border: `1px solid ${boss.accent}44`, borderRadius: 7 }} />
      <button onClick={() => setCapturing(isCapturing ? null : t.id)}
        title="set hotkey (Esc clears)"
        style={{ width: 46, padding: "6px 0", fontSize: 11, fontWeight: 700, color: isCapturing ? "#ffd166" : "#cfd",
          background: "rgba(8,6,14,0.6)", border: `1px solid ${isCapturing ? "#ffd166" : "#3a3450"}`, borderRadius: 7 }}>
        {isCapturing ? "…" : keyLabel(t.hotkey)}
      </button>
      <button onClick={() => eng.removeTimer(boss.id, t.id)} title="remove skill"
        style={{ width: 22, height: 22, fontSize: 12, color: "#ff7b96", background: "transparent",
          border: "1px solid #ff7b9644", borderRadius: 6 }}>
        ✕
      </button>
    </div>
  );
}

function SettingsPanel({ eng, boss, onBack }: { eng: Eng; boss: Boss; onBack: () => void }) {
  const [capturing, setCapturing] = useState<string | null>(null);
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") { eng.setHotkey(capturing, undefined); setCapturing(null); return; }
      const combo = comboFromEvent(e);
      if (!combo) return; // modifier-only so far — wait for the real key
      eng.setHotkey(capturing, combo);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capturing, eng]);

  const timers = eng.cfgs[boss.id] ?? [];
  return (
    <div style={{ ...shell(boss.accent), width: 280, flexDirection: "column", gap: 9, padding: 14, alignItems: "stretch" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={onBack} title="back"
          style={{ fontSize: 14, lineHeight: 1, color: "#9a93ad", background: "transparent", border: "1px solid #3a3450",
            borderRadius: 6, width: 24, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
          ←
        </button>
        <input value={boss.name} onChange={(e) => eng.renameBoss(boss.id, e.target.value)} placeholder="boss name"
          style={{ flex: 1, minWidth: 0, padding: "6px 8px", fontSize: 13, fontWeight: 700, letterSpacing: 1, textAlign: "center",
            color: boss.accent, background: "#15101f", border: `1px solid ${boss.accent}55`, borderRadius: 7 }} />
        <button onClick={() => { eng.removeBoss(boss.id); onBack(); }} title="delete boss"
          style={{ width: 24, height: 22, fontSize: 12, color: "#ff7b96", background: "transparent",
            border: "1px solid #ff7b9644", borderRadius: 6 }}>
          🗑
        </button>
      </div>
      <div style={{ display: "flex", gap: 5, fontSize: 8, letterSpacing: 1, opacity: 0.45, padding: "0 2px" }}>
        <span style={{ flex: 1 }}>SKILL</span>
        <span style={{ width: 46, textAlign: "right" }}>SEC</span>
        <span style={{ width: 46, textAlign: "center" }}>KEY</span>
        <span style={{ width: 22 }} />
      </div>
      {timers.map((t) => (
        <SettingsRow key={t.id} eng={eng} boss={boss} t={t} capturing={capturing} setCapturing={setCapturing} />
      ))}
      {timers.length === 0 && (
        <div style={{ fontSize: 11, opacity: 0.5, textAlign: "center", padding: "4px 0" }}>no skills yet</div>
      )}
      <button onClick={() => eng.addTimer(boss.id)}
        style={{ marginTop: 2, padding: "8px 0", fontSize: 12, letterSpacing: 1, fontWeight: 700, color: "#fff",
          background: `${boss.accent}22`, border: `1px dashed ${boss.accent}88`, borderRadius: 8 }}>
        + ADD SKILL
      </button>
    </div>
  );
}

function TimerBar({ eng, onChange }: { eng: Eng; onChange: () => void }) {
  // global hotkeys: only mounted while a boss is active, so only its skills can fire.
  const engRef = useRef(eng);
  engRef.current = eng;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const combo = comboFromEvent(e);
      if (!combo) return;
      const hit = engRef.current.timers.find((t) => t.cfg.hotkey === combo);
      if (hit) {
        e.preventDefault();
        engRef.current.trigger(hit.cfg.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ ...shell(eng.boss.accent), width: 286, flexDirection: "column", gap: 8, padding: 8, alignItems: "stretch" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px" }}>
        <button onClick={onChange} title="change boss"
          style={{ fontSize: 14, lineHeight: 1, color: "#9a93ad", background: "transparent", border: "1px solid #3a3450",
            borderRadius: 6, width: 24, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
          ←
        </button>
        <span style={{ flex: 1, fontSize: 12, letterSpacing: 2, fontWeight: 700, textAlign: "center",
          color: eng.boss.accent, textShadow: `0 0 10px ${eng.boss.accent}` }}>
          {eng.boss.name.toUpperCase()}
        </span>
        <span style={{ width: 24 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {eng.timers.map((_, i) => <Chip key={eng.timers[i].cfg.id} eng={eng} i={i} />)}
        {eng.timers.length === 0 && (
          <div style={{ fontSize: 11, opacity: 0.5, padding: "16px 0", textAlign: "center" }}>
            no skills — add some in ⚙ settings
          </div>
        )}
      </div>
    </div>
  );
}

export default function BossTimers({ eng }: { eng: Eng }) {
  const [picked, setPicked] = useState(false);
  const [settingsBoss, setSettingsBoss] = useState<string | null>(null);

  if (settingsBoss) {
    const b = eng.bosses.find((x) => x.id === settingsBoss);
    if (b) return <SettingsPanel eng={eng} boss={b} onBack={() => setSettingsBoss(null)} />;
  }
  if (!picked) return <BossSelect eng={eng} onPick={(id) => { eng.switchBoss(id); setPicked(true); }} onSettings={setSettingsBoss} />;
  return <TimerBar eng={eng} onChange={() => { eng.switchBoss(eng.activeBoss); setPicked(false); }} />;
}
