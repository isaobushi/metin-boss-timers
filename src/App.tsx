// DEMO host — winner (variant C) as a pick-boss-first flow over a faux game scene,
// with a first-visit intro overlay explaining the interaction model.
import { useEffect, useState } from "react";
import { useBossTimers } from "./proto/useBossTimers";
import { unlockAudio } from "./proto/audio";
import BossTimers from "./proto/variants/CommandDeck";

const SEEN_INTRO_KEY = "metin-boss-timers:seen-intro:v1";

export default function App() {
  const eng = useBossTimers();
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return localStorage.getItem(SEEN_INTRO_KEY) !== "1";
    } catch {
      return true;
    }
  });

  // unlock Web Audio on the first interaction anywhere
  useEffect(() => {
    const h = () => unlockAudio();
    window.addEventListener("pointerdown", h, { once: true });
    return () => window.removeEventListener("pointerdown", h);
  }, []);

  const dismissIntro = () => {
    try {
      localStorage.setItem(SEEN_INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowIntro(false);
  };

  return (
    <div style={{ height: "100%" }}>
      <GameScene />
      <BossTimers eng={eng} />
      {!showIntro && <HelpButton onClick={() => setShowIntro(true)} />}
      {showIntro && <IntroOverlay onClose={dismissIntro} onReset={() => eng.resetConfig()} />}
    </div>
  );
}

// ---- intro / help overlay ----------------------------------------------------

function IntroOverlay({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, background: "rgba(4,3,8,0.72)", backdropFilter: "blur(4px)", animation: "backdrop-in 0.25s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)", maxHeight: "90vh", overflowY: "auto", color: "#f5f3ff",
          background: "linear-gradient(180deg, rgba(22,17,33,0.97), rgba(12,9,20,0.97))",
          border: "1px solid #7c6cff66", borderRadius: 16,
          boxShadow: "0 20px 60px #000b, 0 0 40px #7c6cff33", padding: 24, animation: "modal-in 0.3s ease",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: 4, opacity: 0.55, marginBottom: 6 }}>LIVE DEMO</div>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, letterSpacing: 1, color: "#cfc8ff", textShadow: "0 0 16px #7c6cff66" }}>
          Metin2 Boss Timers
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, opacity: 0.78 }}>
          Countdown timers for boss skill cycles. This is a browser preview of a desktop overlay that will
          float on top of the game (always-on-top, global hotkeys) in the real app.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
          <Step icon="①" text="Pick a boss — each skill becomes a draining bar." />
          <Step icon="◐" text="Left-click a bar to start / stop its countdown." />
          <Step icon="↺" text="Right-click a bar to reset it to full." />
          <Step icon="⌨" text="Bind a hotkey per skill (⚙). Pressing it resets + starts that timer instantly." />
          <Step icon="⚙" text="Add, rename and re-time skills & bosses from the gear icon." />
          <Step icon="💾" text="Your setup is saved in this browser between visits." />
        </div>

        <div style={{ fontSize: 11, lineHeight: 1.5, opacity: 0.55, marginBottom: 20, padding: "10px 12px",
          background: "#ffffff0a", border: "1px solid #ffffff14", borderRadius: 9 }}>
          Note: browser-reserved combos (Ctrl/Cmd+T, +W, +Q…) are swallowed by the browser in this web demo —
          they'll work in the desktop version. Audio (the boss-skill beeps) starts after your first click.
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "13px 0", fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#fff",
            background: "linear-gradient(180deg, #7c6cff, #5a48e0)", border: "1px solid #9a8cff",
            borderRadius: 10, boxShadow: "0 0 20px #7c6cff55",
          }}
        >
          ENTER DEMO
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            className="link-btn"
            onClick={() => { onReset(); onClose(); }}
            style={{ fontSize: 11, letterSpacing: 0.5, color: "#9a93ad", background: "transparent", border: "none" }}
          >
            Reset demo data to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ width: 20, flexShrink: 0, textAlign: "center", color: "#9a8cff", fontSize: 14 }}>{icon}</span>
      <span style={{ opacity: 0.9 }}>{text}</span>
    </div>
  );
}

function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="help-btn"
      onClick={onClick}
      title="How this works"
      style={{
        position: "fixed", bottom: 16, right: 16, zIndex: 60, width: 38, height: 38, borderRadius: "50%",
        fontSize: 18, fontWeight: 700, color: "#cfc8ff", background: "rgba(14,11,22,0.86)",
        border: "1px solid #7c6cff66", boxShadow: "0 6px 20px #000a, 0 0 16px #7c6cff33", backdropFilter: "blur(8px)",
      }}
    >
      ?
    </button>
  );
}

// ---- faux game scene ---------------------------------------------------------
// Pure CSS/SVG so nothing copyrighted ships; sells the "overlay floating over a game" framing.

const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61) % 100,                 // spread deterministically across the width
  size: 2 + (i % 3),
  delay: -(i * 1.3),
  dur: 9 + (i % 5) * 2,
  hue: i % 3 === 0 ? "#ff9d4d" : i % 3 === 1 ? "#ffd06a" : "#ff6a3d",
}));

const HOTBAR = ["1", "2", "3", "4", "5", "6", "7", "8"];

function GameScene() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", animation: "backdrop-in 0.6s ease" }}>
      {/* sky / cavern depth */}
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(170deg, #241a2e 0%, #1a1726 35%, #12130f 70%, #0b0d09 100%)" }} />
      {/* magic / torch glows */}
      <div style={{ position: "absolute", inset: 0,
        background:
          "radial-gradient(820px 560px at 28% 30%, #6a3bff2e, transparent 70%)," +
          "radial-gradient(620px 520px at 78% 62%, #15a85733, transparent 70%)," +
          "radial-gradient(420px 380px at 60% 18%, #ff8a3d22, transparent 70%)" }} />
      {/* drifting fog band */}
      <div style={{ position: "absolute", left: "-10%", right: "-10%", bottom: "18%", height: 240, opacity: 0.5,
        background: "radial-gradient(60% 100% at 50% 100%, #b9a7ff1f, transparent 70%)",
        animation: "fog-drift 18s ease-in-out infinite alternate" }} />

      {/* perspective ground */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "42%",
        background: "linear-gradient(180deg, transparent, #05060422 30%, #050604 100%)" }} />
      <div style={{ position: "absolute", left: "-25%", right: "-25%", bottom: 0, height: "38%", opacity: 0.18,
        backgroundImage: "linear-gradient(#9a8cff55 1px, transparent 1px), linear-gradient(90deg, #9a8cff55 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        transform: "perspective(420px) rotateX(62deg)", transformOrigin: "bottom center",
        maskImage: "linear-gradient(180deg, transparent, #000 60%)",
        WebkitMaskImage: "linear-gradient(180deg, transparent, #000 60%)" }} />

      {/* a looming silhouette to imply the boss */}
      <div style={{ position: "absolute", left: "50%", bottom: "30%", transform: "translateX(-50%)",
        width: 260, height: 320, opacity: 0.55,
        background: "radial-gradient(50% 60% at 50% 40%, #1c1330, #0c0814 70%, transparent)",
        filter: "blur(6px)" }} />
      <div style={{ position: "absolute", left: "calc(50% - 34px)", bottom: "46%", width: 14, height: 14, borderRadius: "50%",
        background: "#ff3b5c", boxShadow: "0 0 18px 4px #ff3b5c" }} />
      <div style={{ position: "absolute", left: "calc(50% + 22px)", bottom: "46%", width: 14, height: 14, borderRadius: "50%",
        background: "#ff3b5c", boxShadow: "0 0 18px 4px #ff3b5c" }} />

      {/* embers */}
      {EMBERS.map((e, i) => (
        <div key={i} style={{
          position: "absolute", bottom: -10, left: `${e.left}%`, width: e.size, height: e.size, borderRadius: "50%",
          background: e.hue, boxShadow: `0 0 8px ${e.hue}`,
          animation: `ember-rise ${e.dur}s linear ${e.delay}s infinite`,
        }} />
      ))}

      {/* vignette */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, #000 130%)" }} />

      {/* ---- faux game HUD ---- */}
      {/* top-center boss health bar */}
      <div style={{ position: "absolute", top: 26, left: "50%", transform: "translateX(-50%)", width: 360, textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#ffd9a8", textShadow: "0 0 10px #ff5c3c", marginBottom: 5, opacity: 0.85 }}>
          ⚔ Lvl. 135 (Grade 5) Balathor
        </div>
        <div style={{ height: 12, borderRadius: 6, background: "#1a0e0e", border: "1px solid #5a2a2a", overflow: "hidden" }}>
          <div style={{ height: "100%", width: "68%", background: "linear-gradient(90deg, #c0142e, #ff5c3c)", boxShadow: "0 0 12px #ff5c3c88" }} />
        </div>
      </div>

      {/* bottom-left player orbs + bars */}
      <div style={{ position: "absolute", bottom: 18, left: 18, display: "flex", alignItems: "flex-end", gap: 12 }}>
        <Orb color="#ff3b5c" label="HP" />
        <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingBottom: 6 }}>
          <Bar value={0.74} from="#c0142e" to="#ff5c3c" />
          <Bar value={0.52} from="#1e5fd0" to="#3aa0ff" />
          <Bar value={0.33} from="#a06a12" to="#ffcf5c" thin />
        </div>
        <Orb color="#3aa0ff" label="MP" />
      </div>

      {/* bottom-center hotbar */}
      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
        {HOTBAR.map((k, i) => (
          <div key={k} style={{ position: "relative", width: 44, height: 44, borderRadius: 7,
            background: "linear-gradient(180deg, #1a1626, #0c0a14)",
            border: `1px solid ${i === 2 ? "#9a8cff" : "#ffffff22"}`,
            boxShadow: i === 2 ? "0 0 12px #7c6cff66 inset" : "none" }}>
            <span style={{ position: "absolute", top: 2, left: 4, fontSize: 9, color: "#cfc8e0", opacity: 0.7 }}>{k}</span>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", top: 16, left: 18, fontSize: 11, letterSpacing: 1, color: "#cdbfa8", opacity: 0.5 }}>
        game view — illustrative mock, not affiliated with Metin2
      </div>
    </div>
  );
}

function Orb({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, letterSpacing: 1, color: "#fff",
      background: `radial-gradient(circle at 35% 30%, ${color}, #0008 80%)`,
      border: `2px solid ${color}aa`, boxShadow: `0 0 14px ${color}66` }}>
      {label}
    </div>
  );
}

function Bar({ value, from, to, thin }: { value: number; from: string; to: string; thin?: boolean }) {
  return (
    <div style={{ width: 200, height: thin ? 8 : 12, borderRadius: 6, background: "#0c0a14", border: "1px solid #ffffff1c", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value * 100}%`, background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 10px ${to}66` }} />
    </div>
  );
}
