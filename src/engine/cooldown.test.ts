import { describe, expect, it } from "vitest";
import {
  type CooldownDef,
  type RunningCooldown,
  deriveTag,
  fmtDur,
  isReady,
  readout,
  readyCrossings,
  remainingMs,
  MAX_RUNNING,
  clear,
  restart,
  start,
} from "./cooldown";

const M = 60_000;
const H = 3_600_000;

const def = (id: string, durationMs: number): CooldownDef => ({
  id,
  name: id,
  tag: id.slice(0, 3),
  durationMs,
});

// The cooldown engine is pure: derivations are `(inputs) -> outputs` and the running-set
// ops are `(RunningCooldown[], ...) -> RunningCooldown[]`. No clock, no React, no storage —
// `now` is always passed in, so every assertion below is deterministic.

const running = (defId: string, expiry: number, startedAt = 0): RunningCooldown => ({
  defId,
  expiry,
  startedAt,
});

describe("remainingMs", () => {
  it("is the gap to expiry, clamped at zero once elapsed", () => {
    expect(remainingMs(running("hyd", 10_000), 4_000)).toBe(6_000);
    expect(remainingMs(running("hyd", 10_000), 10_000)).toBe(0);
    expect(remainingMs(running("hyd", 10_000), 25_000)).toBe(0); // never negative
  });
});

describe("isReady", () => {
  it("is true exactly at expiry and after", () => {
    expect(isReady(running("hyd", 10_000), 9_999)).toBe(false);
    expect(isReady(running("hyd", 10_000), 10_000)).toBe(true); // the moment it elapses
    expect(isReady(running("hyd", 10_000), 50_000)).toBe(true);
  });
});

describe("readout", () => {
  // ≥1h → "2h59" (h+min, seconds are noise) · <1h → "59:12" (mm:ss) · ≤0 → "Ready".
  it("shows hours+minutes at or above one hour", () => {
    expect(readout(2 * H + 59 * M)).toBe("2h59");
    expect(readout(H)).toBe("1h00"); // exactly 1h sits in the hours band, zero-padded
    expect(readout(3 * H)).toBe("3h00");
  });

  it("shows mm:ss below one hour", () => {
    expect(readout(H - M)).toBe("59:00"); // just under an hour
    expect(readout(59 * M + 12_000)).toBe("59:12");
    expect(readout(8_000)).toBe("0:08");
  });

  it("reads Ready at and below zero", () => {
    expect(readout(0)).toBe("Ready");
    expect(readout(-30 * M)).toBe("Ready"); // elapsed while the app was closed
  });
});

describe("fmtDur", () => {
  // Catalog/duration labels: "3h00" / "15m" — no seconds at this scale, no "Ready".
  it("labels hours zero-padded and sub-hour as plain minutes", () => {
    expect(fmtDur(3 * H)).toBe("3h00");
    expect(fmtDur(H)).toBe("1h00");
    expect(fmtDur(4 * H)).toBe("4h00");
    expect(fmtDur(15 * M)).toBe("15m");
  });
});

describe("deriveTag", () => {
  it("takes the first three letters, title-cased", () => {
    expect(deriveTag("Hydra")).toBe("Hyd");
    expect(deriveTag("Balathor")).toBe("Bal");
    expect(deriveTag("razador")).toBe("Raz"); // normalises case regardless of input
  });
});

describe("start", () => {
  it("stamps an absolute expiry of now + the definition's duration", () => {
    const after = start([], def("hyd", 15 * M), 1_000);
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual({ defId: "hyd", expiry: 1_000 + 15 * M, startedAt: 1_000 });
  });

  it("keeps one running instance per definition — re-starting re-stamps, never duplicates", () => {
    const d = def("hyd", 15 * M);
    let rs = start([], d, 1_000);
    rs = start(rs, d, 5_000); // same def again, later
    expect(rs).toHaveLength(1);
    expect(rs[0].expiry).toBe(5_000 + 15 * M); // re-stamped from the new now
    expect(rs[0].startedAt).toBe(5_000);
  });

  it("leaves other running cooldowns untouched", () => {
    let rs = start([], def("hyd", 15 * M), 1_000);
    rs = start(rs, def("raz", H), 2_000);
    expect(rs.map((r) => r.defId).sort()).toEqual(["hyd", "raz"]);
  });

  it(`caps the running set at ${MAX_RUNNING} — a fresh def beyond the cap is refused`, () => {
    let rs: RunningCooldown[] = [];
    for (let i = 0; i < MAX_RUNNING; i++) rs = start(rs, def(`cd-${i}`, M), 0);
    expect(rs).toHaveLength(MAX_RUNNING);

    const refused = start(rs, def("one-too-many", M), 0);
    expect(refused).toBe(rs); // unchanged: the 9th distinct cooldown can't start
  });

  it("still re-stamps an already-running def at capacity (a replacement, not a 9th)", () => {
    let rs: RunningCooldown[] = [];
    for (let i = 0; i < MAX_RUNNING; i++) rs = start(rs, def(`cd-${i}`, M), 0);

    const after = start(rs, def("cd-0", M), 5_000); // already running → re-stamp
    expect(after).toHaveLength(MAX_RUNNING); // no growth past the cap
    expect(after.find((r) => r.defId === "cd-0")!.startedAt).toBe(5_000);
  });
});

describe("restart", () => {
  it("re-stamps a running cooldown from the definition's full duration", () => {
    const d = def("hyd", 15 * M);
    const rs = start([], d, 1_000); // started, half elapsed by now=8_500
    const after = restart(rs, d, 8_500);
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual({ defId: "hyd", expiry: 8_500 + 15 * M, startedAt: 8_500 });
  });
});

describe("clear", () => {
  it("removes the cooldown for a definition and leaves the rest", () => {
    let rs = start([], def("hyd", 15 * M), 0);
    rs = start(rs, def("raz", H), 0);
    const after = clear(rs, "hyd");
    expect(after.map((r) => r.defId)).toEqual(["raz"]);
  });

  it("is a no-op when nothing is running for that definition", () => {
    const rs = start([], def("hyd", 15 * M), 0);
    expect(clear(rs, "nope")).toEqual(rs);
  });
});

describe("readyCrossings", () => {
  // The live-only zero-crossing detector behind the best-effort ready cue (ADR-0002).
  // Given two consecutive observations of the running set, it returns the defIds that
  // were running-and-not-ready last tick and are ready now — so the cue fires exactly
  // on a crossing the app actually watched, never on a cooldown that elapsed while closed.
  it("reports a cooldown that counted down across zero between two observations", () => {
    const prev = [running("hyd", 10_000)];
    const cur = [running("hyd", 10_000)];
    expect(readyCrossings(prev, 9_000, cur, 10_000)).toEqual(["hyd"]);
  });

  it("does not re-fire a pill sitting at sticky Ready (ready in both observations)", () => {
    const rs = [running("hyd", 10_000)];
    expect(readyCrossings(rs, 12_000, rs, 13_000)).toEqual([]); // already ready last tick
  });

  it("stays silent on restore — a cooldown elapsed while closed has no prior not-ready tick", () => {
    // First live observation already sees it past zero (prev === cur at mount).
    const restored = [running("hyd", 10_000)];
    expect(readyCrossings(restored, 50_000, restored, 51_000)).toEqual([]);
    // And with no prior running set at all (empty prev), nothing can have crossed.
    expect(readyCrossings([], 0, restored, 51_000)).toEqual([]);
  });

  it("re-arms across a restart: the new instance is a fresh crossing, the re-stamp itself is silent", () => {
    const d = def("hyd", 15 * M);
    const elapsed = [running("hyd", 10_000)]; // sitting at Ready
    const restamped = restart(elapsed, d, 12_000); // click-to-restart → new expiry, not ready
    expect(readyCrossings(elapsed, 11_000, restamped, 12_000)).toEqual([]); // ready→not-ready: no cue

    // …and when that fresh instance later crosses zero, it fires again.
    const crossed = restamped; // same instance, observed past its new expiry
    expect(readyCrossings(restamped, 12_000 + 15 * M - 1_000, crossed, 12_000 + 15 * M)).toEqual(["hyd"]);
  });

  it("reports every cooldown crossing zero in the same tick", () => {
    const prev = [running("hyd", 10_000), running("raz", 10_000), running("nem", 30_000)];
    const cur = prev;
    expect(readyCrossings(prev, 9_000, cur, 10_000).sort()).toEqual(["hyd", "raz"]); // nem still running
  });

  it("reports nothing while a cooldown is still running in both observations", () => {
    const rs = [running("hyd", 10_000)];
    expect(readyCrossings(rs, 4_000, rs, 5_000)).toEqual([]);
  });
});
