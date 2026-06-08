// Browser-demo backdrop — a pure CSS/SVG faux game scene that sells the "overlay floating
// over a game" framing on the web demo. Nothing copyrighted ships: it's all gradients,
// silhouettes and a mock HUD. Rendered only in the browser (App gates it on !isTauri); the
// real desktop app stays transparent and frameless, with the actual game behind it.
//
// Revived from the original web-demo prototype (initial commit) after the Tauri migration
// replaced the demo host with the overlay app, which left the live demo on a blank page.

const REPO_URL = "https://github.com/isaobushi/metin-boss-timers";

// Spread embers deterministically across the width so the scene is stable across renders.
const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61) % 100,
  size: 2 + (i % 3),
  delay: -(i * 1.3),
  dur: 9 + (i % 5) * 2,
  hue: i % 3 === 0 ? "#ff9d4d" : i % 3 === 1 ? "#ffd06a" : "#ff6a3d",
}));

const HOTBAR = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Full-viewport faux game scene + mock HUD, painted behind the overlay (zIndex 0). */
export function DemoScene() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", animation: "backdrop-in 0.6s ease" }}>
      {/* sky / cavern depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(170deg, #241a2e 0%, #1a1726 35%, #12130f 70%, #0b0d09 100%)",
        }}
      />
      {/* magic / torch glows */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(820px 560px at 28% 30%, #6a3bff2e, transparent 70%)," +
            "radial-gradient(620px 520px at 78% 62%, #15a85733, transparent 70%)," +
            "radial-gradient(420px 380px at 60% 18%, #ff8a3d22, transparent 70%)",
        }}
      />
      {/* drifting fog band */}
      <div
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          bottom: "18%",
          height: 240,
          opacity: 0.5,
          background: "radial-gradient(60% 100% at 50% 100%, #b9a7ff1f, transparent 70%)",
          animation: "fog-drift 18s ease-in-out infinite alternate",
        }}
      />

      {/* perspective ground */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "42%",
          background: "linear-gradient(180deg, transparent, #05060422 30%, #050604 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "-25%",
          right: "-25%",
          bottom: 0,
          height: "38%",
          opacity: 0.18,
          backgroundImage:
            "linear-gradient(#9a8cff55 1px, transparent 1px), linear-gradient(90deg, #9a8cff55 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          transform: "perspective(420px) rotateX(62deg)",
          transformOrigin: "bottom center",
          maskImage: "linear-gradient(180deg, transparent, #000 60%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, #000 60%)",
        }}
      />

      {/* a looming silhouette to imply the boss */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "30%",
          transform: "translateX(-50%)",
          width: 260,
          height: 320,
          opacity: 0.55,
          background: "radial-gradient(50% 60% at 50% 40%, #1c1330, #0c0814 70%, transparent)",
          filter: "blur(6px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "calc(50% - 34px)",
          bottom: "46%",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#ff3b5c",
          boxShadow: "0 0 18px 4px #ff3b5c",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "calc(50% + 22px)",
          bottom: "46%",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#ff3b5c",
          boxShadow: "0 0 18px 4px #ff3b5c",
        }}
      />

      {/* embers */}
      {EMBERS.map((e, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            bottom: -10,
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            borderRadius: "50%",
            background: e.hue,
            boxShadow: `0 0 8px ${e.hue}`,
            animation: `ember-rise ${e.dur}s linear ${e.delay}s infinite`,
          }}
        />
      ))}

      {/* vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, #000 130%)",
        }}
      />

      {/* ---- faux game HUD ---- */}
      {/* top-center boss health bar */}
      <div style={{ position: "absolute", top: 26, left: "50%", transform: "translateX(-50%)", width: 360, textAlign: "center" }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: 3,
            color: "#ffd9a8",
            textShadow: "0 0 10px #ff5c3c",
            marginBottom: 5,
            opacity: 0.85,
          }}
        >
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
          <div
            key={k}
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: 7,
              background: "linear-gradient(180deg, #1a1626, #0c0a14)",
              border: `1px solid ${i === 2 ? "#9a8cff" : "#ffffff22"}`,
              boxShadow: i === 2 ? "0 0 12px #7c6cff66 inset" : "none",
            }}
          >
            <span style={{ position: "absolute", top: 2, left: 4, fontSize: 9, color: "#cfc8e0", opacity: 0.7 }}>{k}</span>
          </div>
        ))}
      </div>

      {/* bottom-right: disclaimer + link back to the repo */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 16,
          textAlign: "right",
          fontSize: 11,
          letterSpacing: 0.5,
          lineHeight: 1.6,
          color: "#cdbfa8",
        }}
      >
        <div style={{ opacity: 0.45 }}>illustrative mock — not affiliated with Metin2</div>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#cfc8ff", textShadow: "0 0 10px #7c6cff55", textDecoration: "none", fontWeight: 700 }}
        >
          ★ View the source on GitHub ↗
        </a>
      </div>
    </div>
  );
}

function Orb({ color, label }: { color: string; label: string }) {
  return (
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 9,
        letterSpacing: 1,
        color: "#fff",
        background: `radial-gradient(circle at 35% 30%, ${color}, #0008 80%)`,
        border: `2px solid ${color}aa`,
        boxShadow: `0 0 14px ${color}66`,
      }}
    >
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
