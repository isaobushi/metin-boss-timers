import { describe, expect, it } from "vitest";
import {
  type RecurringDef,
  type RunningRecurring,
  ALARM_THRESHOLD_MS,
  LADDERS,
  MAX_RUNNING,
  alarmCrossings,
  doneCount,
  inAlarm,
  isCapped,
  isDue,
  ladderCap,
  ladderProgress,
  ladderText,
  markDone,
  positionOf,
  readyCrossings,
  remainingMs,
  routineToDo,
  setPosition,
} from "./recurring";

// The recurring engine is a `recurring`-flavoured sibling of Cooldown (ADR-0003): the same
// absolute wall-clock `expiry`, persisted and restored already-past-zero, with one axis
// flipped — completion restamps to a full cycle instead of going one-shot. Like every engine
// here it is pure: `now` is always passed in, so every assertion below is deterministic.

const running = (defId: string, expiry: number, startedAt = 0): RunningRecurring => ({
  defId,
  expiry,
  startedAt,
});

const def = (id: string, durationMs: number, kind: RecurringDef["kind"] = "deadline"): RecurringDef => ({
  id,
  name: id,
  durationMs,
  kind,
});

const DAY = 86_400_000;

describe("remainingMs", () => {
  it("is the gap to expiry, clamped at zero once elapsed", () => {
    expect(remainingMs(running("pet", 10_000), 4_000)).toBe(6_000);
    expect(remainingMs(running("pet", 10_000), 10_000)).toBe(0);
    expect(remainingMs(running("pet", 10_000), 25_000)).toBe(0); // never negative
  });
});

describe("isDue", () => {
  // The instant `now` reaches `expiry` the item is due — for a gate that reads "ready",
  // for a deadline "overdue". Same boundary as cooldown.isReady; the name reflects that
  // the valence is decided by the UI from `kind`, not by the engine.
  it("is true exactly at expiry and after", () => {
    expect(isDue(running("pet", 10_000), 9_999)).toBe(false);
    expect(isDue(running("pet", 10_000), 10_000)).toBe(true); // the moment it elapses
    expect(isDue(running("pet", 10_000), 50_000)).toBe(true);
  });
});

describe("inAlarm", () => {
  // The deadline alarm window: a `deadline` item turns red/blink when it is under the
  // threshold (24h by default) but not yet elapsed — the "act now or lose it" warning. The
  // window is the OPEN interval (0, threshold): false at/after zero (that's `overdue`, the
  // loss, a different state) and false at or beyond the threshold (still comfortably far out).
  // Like every other derivation it reads `kind`-free; the UI calls it only for deadlines.
  const HOUR = 3_600_000;

  it("is true only strictly inside (0, threshold)", () => {
    const r = running("pet", DAY);
    expect(inAlarm(r, DAY - 23 * HOUR)).toBe(true); // 1h left — deep in the window
    expect(inAlarm(r, DAY - HOUR)).toBe(true); // 23h left — just inside
  });

  it("is false far out — at or beyond the threshold", () => {
    const r = running("pet", 3 * DAY);
    expect(inAlarm(r, 0)).toBe(false); // 3d left
    expect(inAlarm(r, 2 * DAY)).toBe(false); // exactly 24h left — the boundary is not yet alarming
  });

  it("is false at and after zero — overdue is a loss, not an alarm", () => {
    const r = running("pet", DAY);
    expect(inAlarm(r, DAY)).toBe(false); // the instant it elapses
    expect(inAlarm(r, DAY + HOUR)).toBe(false); // past zero
  });

  it("takes a custom threshold", () => {
    const r = running("horse", DAY);
    expect(inAlarm(r, DAY - 2 * HOUR, 3 * HOUR)).toBe(true); // 2h left, 3h window
    expect(inAlarm(r, DAY - 4 * HOUR, 3 * HOUR)).toBe(false); // 4h left, outside a 3h window
  });

  it("defaults the threshold to 24h", () => {
    expect(ALARM_THRESHOLD_MS).toBe(24 * HOUR);
  });
});

describe("alarmCrossings", () => {
  // The deadline analogue of cooldown.readyCrossings: the live-only detector behind the
  // best-effort alarm cue (ADR-0002 / ADR-0003 §3). Given two consecutive observations of
  // the running set it returns the defIds that were running-and-not-yet-alarming last tick
  // and are in-alarm now — so the cue fires exactly on a crossing the app watched, never on
  // an item that drifted into (or past) the window while closed. A refresh re-stamps to a
  // fresh instance that re-arms; a sitting alarm never re-fires.
  const HOUR = 3_600_000;
  // An item whose expiry sits one hour past `t` — crossing into the 24h window around then.
  const near = (defId: string, expiry: number): RunningRecurring => running(defId, expiry);

  it("reports an item that counted down into the alarm window between two observations", () => {
    const r = [near("pet", 24 * HOUR + 1_000)]; // expiry just past the 24h mark from t=0..1000
    expect(alarmCrossings(r, 0, r, 1_001)).toEqual(["pet"]); // 24h00m01s → 23h59m59s: crossed in
  });

  it("does not re-fire an item already sitting in the alarm window", () => {
    const r = [running("pet", 10 * HOUR)]; // well inside the window in both observations
    expect(alarmCrossings(r, 0, r, 1_000)).toEqual([]);
  });

  it("stays silent on restore — an item already in-alarm at mount has no prior outside tick", () => {
    const restored = [running("pet", 10 * HOUR)];
    expect(alarmCrossings(restored, 0, restored, 1_000)).toEqual([]); // prev === cur at mount
    expect(alarmCrossings([], 0, restored, 1_000)).toEqual([]); // no prior running set at all
  });

  it("does not fire on the zero crossing — passing out of the window into overdue is silent", () => {
    const r = [running("pet", 10_000)];
    expect(alarmCrossings(r, 9_000, r, 11_000)).toEqual([]); // in-alarm → overdue, not a fresh alarm
  });

  it("re-arms across a refresh: the re-stamp is silent, the new instance can cross afresh", () => {
    const d = def("pet", 25 * HOUR); // a cycle longer than the window, so a fresh stamp starts outside it
    const sitting = [running("pet", 10 * HOUR)]; // in-alarm
    const refreshed = markDone(sitting, d, 1_000); // feed → new expiry far out, outside the window
    expect(alarmCrossings(sitting, 0, refreshed, 1_000)).toEqual([]); // in-alarm → outside: no cue

    // …and when the fresh instance later drains into the window, it fires again.
    const exp = 1_000 + 25 * HOUR;
    expect(alarmCrossings(refreshed, exp - 24 * HOUR - 1_000, refreshed, exp - 24 * HOUR + 1_000)).toEqual(["pet"]);
  });

  it("reports every item crossing into the window in the same tick", () => {
    const prev = [near("pet", 24 * HOUR + 1_000), near("horse", 24 * HOUR + 1_000), running("mount", 48 * HOUR)];
    expect(alarmCrossings(prev, 0, prev, 1_001).sort()).toEqual(["horse", "pet"]); // mount still far out
  });

  it("takes a custom threshold", () => {
    const r = [running("pet", 3 * HOUR + 1_000)];
    expect(alarmCrossings(r, 0, r, 1_001, 3 * HOUR)).toEqual(["pet"]); // crosses a 3h window
    expect(alarmCrossings(r, 0, r, 1_001, 1 * HOUR)).toEqual([]); // still outside a 1h window
  });
});

describe("readyCrossings", () => {
  // The GATE analogue of the cue: identical to cooldown.readyCrossings but over recurring
  // items — the defIds whose item crossed the ZERO boundary (became `isDue` = "ready" for a
  // gate) between two consecutive observations: due in `cur`, present-and-not-due in `prev`.
  // This is the per-kind cue split from `alarmCrossings`: a `deadline` fires on the under-24h
  // alarm crossing, a `gate` fires here, on the zero crossing (when the chore becomes do-able
  // again). Live-only (ADR-0002 / ADR-0003 §3): silent on restore-past-zero, never re-fires a
  // sitting-ready item, re-arms across a mark-done (identity is `(defId, expiry)`).
  const HOUR = 3_600_000;

  it("reports an item that counted down to ready (zero) between two observations", () => {
    const r = [running("books", 10_000)];
    expect(readyCrossings(r, 9_000, r, 10_000)).toEqual(["books"]); // 1s-before → exactly due: crossed
  });

  it("does not re-fire an item already sitting ready", () => {
    const r = [running("books", 10_000)];
    expect(readyCrossings(r, 11_000, r, 12_000)).toEqual([]); // due in both observations
  });

  it("stays silent on restore — an item already past zero at mount has no prior not-due tick", () => {
    const restored = [running("books", 10_000)];
    expect(readyCrossings(restored, 20_000, restored, 21_000)).toEqual([]); // prev === cur, both due
    expect(readyCrossings([], 20_000, restored, 21_000)).toEqual([]); // no prior running set at all
  });

  it("re-arms across a mark-done: the re-stamp is silent, the fresh instance can cross afresh", () => {
    const d = def("books", 24 * HOUR, "gate");
    const ready = [running("books", 10_000)]; // due at now=11_000
    const refreshed = markDone(ready, d, 11_000); // mark done → new expiry 24h out
    expect(readyCrossings(ready, 10_000, refreshed, 11_000)).toEqual([]); // ready → not-due: no cue
    const exp = 11_000 + 24 * HOUR;
    expect(readyCrossings(refreshed, exp - 1_000, refreshed, exp)).toEqual(["books"]); // drains to ready again
  });

  it("reports every item crossing zero in the same tick", () => {
    const items = [running("books", 10_000), running("bio", 10_000), running("mat", 50_000)];
    expect(readyCrossings(items, 9_000, items, 10_000).sort()).toEqual(["bio", "books"]); // mat still far out
  });
});

describe("doneCount", () => {
  // The `✓ x/n` routine counter: over a set of gate definitions, how many are currently
  // "done" (satisfied) — i.e. have a running instance that has NOT yet come due again. A gate
  // item that is `isDue` reads as "ready" (needs doing, so NOT done); an unstarted def has no
  // instance at all (never done, so NOT done either). `total` is just the count of defs given,
  // so the caller passes the gate defs and the counter reads `done/total`. Pure: `now` in.
  const HOUR = 3_600_000;
  const gate = (id: string) => def(id, 24 * HOUR, "gate");

  it("counts gate defs whose instance is running and not yet due as done", () => {
    const defs = [gate("books"), gate("bio")];
    const running = [{ defId: "books", expiry: 10 * HOUR, startedAt: 0 }]; // books satisfied, bio unstarted
    expect(doneCount(running, defs, 0)).toEqual({ done: 1, total: 2 });
  });

  it("treats a due (ready) item as NOT done — it needs doing again", () => {
    const defs = [gate("books")];
    const running = [{ defId: "books", expiry: 10_000, startedAt: 0 }];
    expect(doneCount(running, defs, 10_000)).toEqual({ done: 0, total: 1 }); // exactly due → ready, not done
  });

  it("treats an unstarted def as NOT done", () => {
    expect(doneCount([], [gate("books"), gate("bio")], 0)).toEqual({ done: 0, total: 2 });
  });

  it("is all-done when every gate def has a satisfied instance", () => {
    const defs = [gate("books"), gate("bio")];
    const running = [
      { defId: "books", expiry: 10 * HOUR, startedAt: 0 },
      { defId: "bio", expiry: 20 * HOUR, startedAt: 0 },
    ];
    expect(doneCount(running, defs, 0)).toEqual({ done: 2, total: 2 });
  });

  it("is 0/0 over an empty def set", () => {
    expect(doneCount([], [], 0)).toEqual({ done: 0, total: 0 });
  });

  it("ignores running instances whose def isn't in the given set", () => {
    const running = [{ defId: "stray", expiry: 10 * HOUR, startedAt: 0 }];
    expect(doneCount(running, [gate("books")], 0)).toEqual({ done: 0, total: 1 });
  });
});

describe("markDone", () => {
  // The single completion gesture for both kinds: it restamps a full cycle from `now`
  // (rolling-from-last-done — feeding early forfeits unused time, by design), keeping at
  // most one running instance per definition. This is the one axis that diverges from a
  // one-shot Cooldown.
  it("restamps an absolute expiry of now + the definition's full duration", () => {
    const after = markDone([], def("pet", 7 * DAY), 1_000);
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual({ defId: "pet", expiry: 1_000 + 7 * DAY, startedAt: 1_000 });
  });

  it("keeps one running instance per definition — re-marking re-stamps, never duplicates", () => {
    const d = def("pet", 7 * DAY);
    let rs = markDone([], d, 1_000);
    rs = markDone(rs, d, 5_000); // fed again, later
    expect(rs).toHaveLength(1);
    expect(rs[0].expiry).toBe(5_000 + 7 * DAY); // restamped a full cycle from the new now
    expect(rs[0].startedAt).toBe(5_000);
  });

  it("clears a deadline alarm by restamping a full cycle ahead (the refresh gesture)", () => {
    const d = def("pet", 7 * DAY); // a cycle far longer than the 24h alarm window
    const sitting = markDone([], d, 0).map((r) => ({ ...r, expiry: 10 * 3_600_000 })); // forced in-alarm
    expect(inAlarm(sitting[0], 0)).toBe(true);
    const refreshed = markDone(sitting, d, 1_000); // feed it
    expect(inAlarm(refreshed[0], 1_000)).toBe(false); // fresh full cycle → comfortably outside the window
  });

  it("leaves other running items untouched", () => {
    let rs = markDone([], def("pet", 7 * DAY), 1_000);
    rs = markDone(rs, def("costume", 5 * DAY), 2_000);
    expect(rs.map((r) => r.defId).sort()).toEqual(["costume", "pet"]);
  });

  it(`caps the running set at ${MAX_RUNNING} — a fresh def beyond the cap is refused`, () => {
    let rs: RunningRecurring[] = [];
    for (let i = 0; i < MAX_RUNNING; i++) rs = markDone(rs, def(`r-${i}`, DAY), 0);
    expect(rs).toHaveLength(MAX_RUNNING);

    const refused = markDone(rs, def("one-too-many", DAY), 0);
    expect(refused).toBe(rs); // unchanged: the 9th distinct item can't start
  });

  it("still re-stamps an already-running def at capacity (a replacement, not a 9th)", () => {
    let rs: RunningRecurring[] = [];
    for (let i = 0; i < MAX_RUNNING; i++) rs = markDone(rs, def(`r-${i}`, DAY), 0);

    const after = markDone(rs, def("r-0", DAY), 5_000); // already running → re-stamp
    expect(after).toHaveLength(MAX_RUNNING); // no growth past the cap
    expect(after.find((r) => r.defId === "r-0")!.startedAt).toBe(5_000);
  });
});

// ---- ladder progression (issue #44): the rank LAYER over the gate ----
// Position = the count of *successful* reads (monotonic lifetime state, separate from the daily
// gate). The five seeded structures are a fixed engine lookup; the numbers are sourced in the
// `metin2-readable-presets` memory. These pin the boundary cases the issue calls out: position 0,
// a mid-rung position, and the exact cap, for each structure.

describe("LADDERS table", () => {
  it("seeds the five structures with the sourced caps", () => {
    // The last rung's entry is the book-relevant cap (the maximum meaningful position).
    expect(ladderCap("class-skill")).toBe(55); // M1→G1, triangular 1+2+…+10
    expect(ladderCap("transformation")).toBe(40); // 0→P (20 to M1, then 1/step)
    expect(ladderCap("leadership")).toBe(230); // 20 + 55 + 155 across three Art-of-War books
    expect(ladderCap("language")).toBe(20); // 20 reads to the M1 ceiling
    expect(ladderCap("biologist")).toBe(9); // 10 stages, one hand-in each → 9 advances to Stage 10
  });

  it("builds rungs with monotonically rising entry thresholds", () => {
    for (const l of Object.values(LADDERS)) {
      for (let i = 1; i < l.rungs.length; i++) {
        expect(l.rungs[i].entry).toBeGreaterThan(l.rungs[i - 1].entry);
      }
      expect(l.rungs[0].entry).toBe(0); // every ladder starts at zero reads
    }
  });

  it("pins the Skill Books M-tier to the triangular thresholds (1+2+…)", () => {
    // M1=0, M2=1, M3=3 (1+2), M4=6 (1+2+3) … G1=55. The classic skill-book sublevel cost.
    expect(LADDERS["class-skill"].rungs.map((r) => [r.label, r.entry])).toEqual([
      ["M1", 0], ["M2", 1], ["M3", 3], ["M4", 6], ["M5", 10],
      ["M6", 15], ["M7", 21], ["M8", 28], ["M9", 36], ["M10", 45], ["G1", 55],
    ]);
  });

  it("gives Biologist a per-stage item hint (display-only metadata, no counter)", () => {
    expect(LADDERS["biologist"].hints?.[4]).toBe("Zelkova Branch ×25"); // Stage 5
    expect(LADDERS["biologist"].hints).toHaveLength(10);
  });
});

describe("ladderProgress", () => {
  it("reads the floor rung at position 0", () => {
    expect(ladderProgress("class-skill", 0)).toEqual({
      rungLabel: "M1", nextRungLabel: "M2", readsToNextRung: 1, capped: false,
    });
    expect(ladderProgress("transformation", 0)).toEqual({
      rungLabel: "0", nextRungLabel: "M1", readsToNextRung: 20, capped: false,
    });
  });

  it("reads a mid-rung position as its current rung + reads to the next", () => {
    // position 4 sits on M3 (entry 3) with M4 at entry 6 → 2 reads to go.
    expect(ladderProgress("class-skill", 4)).toEqual({
      rungLabel: "M3", nextRungLabel: "M4", readsToNextRung: 2, capped: false,
    });
  });

  it("goes inert at the exact cap — no next rung, zero reads to go", () => {
    expect(ladderProgress("class-skill", 55)).toEqual({
      rungLabel: "G1", nextRungLabel: null, readsToNextRung: 0, capped: true,
    });
    expect(ladderProgress("language", 20)).toEqual({
      rungLabel: "M1", nextRungLabel: null, readsToNextRung: 0, capped: true,
    });
  });

  it("treats a position past the cap as capped (clamped)", () => {
    expect(ladderProgress("transformation", 999)?.capped).toBe(true);
  });

  it("clamps a negative position to the floor rung", () => {
    expect(ladderProgress("class-skill", -5)?.rungLabel).toBe("M1");
  });

  it("is null for an unknown or absent ladder (a plain gate has no rank)", () => {
    expect(ladderProgress("nope", 0)).toBeNull();
    expect(ladderProgress(undefined, 0)).toBeNull();
  });
});

describe("ladderText", () => {
  it("formats a rung-style readout as `<rung> · <n>→<next>`", () => {
    expect(ladderText("class-skill", 4)).toBe("M3 · 2→M4");
    expect(ladderText("transformation", 0)).toBe("0 · 20→M1");
  });

  it("formats the rung-style cap as a quiet trophy (with the books note where it applies)", () => {
    expect(ladderText("class-skill", 55)).toBe("G1 ✓ max (books)"); // G→P is Soul Stones, not books
    expect(ladderText("transformation", 40)).toBe("P ✓ max");
    expect(ladderText("language", 20)).toBe("M1 ✓ max");
  });

  it("formats Biologist as `Stage n/10 · <item>` from the seeded hints", () => {
    expect(ladderText("biologist", 0)).toBe("Stage 1/10 · Orc Tooth ×10");
    expect(ladderText("biologist", 4)).toBe("Stage 5/10 · Zelkova Branch ×25");
  });

  it("formats the Biologist cap as `Stage 10/10 ✓`", () => {
    expect(ladderText("biologist", 9)).toBe("Stage 10/10 ✓");
  });

  it("is null for an unknown or absent ladder", () => {
    expect(ladderText(undefined, 0)).toBeNull();
  });
});

describe("positionOf / setPosition (the progress map)", () => {
  it("defaults a def with no recorded rank to position 0", () => {
    expect(positionOf([], "skill-books")).toBe(0);
    expect(positionOf([{ defId: "other", position: 5 }], "skill-books")).toBe(0);
  });

  it("reads back a recorded position", () => {
    expect(positionOf([{ defId: "skill-books", position: 12 }], "skill-books")).toBe(12);
  });

  it("upserts a def's position, leaving other entries untouched", () => {
    const before = [{ defId: "other", position: 3 }];
    const after = setPosition(before, "skill-books", 7, "class-skill");
    expect(after).toContainEqual({ defId: "other", position: 3 });
    expect(positionOf(after, "skill-books")).toBe(7);
    const replaced = setPosition(after, "skill-books", 9, "class-skill");
    expect(replaced.filter((p) => p.defId === "skill-books")).toHaveLength(1); // replaced, not duplicated
    expect(positionOf(replaced, "skill-books")).toBe(9);
  });

  it("clamps to [0, cap] for the ladder", () => {
    expect(positionOf(setPosition([], "d", 999, "class-skill"), "d")).toBe(55); // capped
    expect(positionOf(setPosition([], "d", -4, "class-skill"), "d")).toBe(0); // floored
  });
});

describe("isCapped / routineToDo (the ✓ nudge, #45)", () => {
  // A ladder def at its cap is a finished trophy — it must drop out of the routine to-do nudge so
  // the bar doesn't sit forever counting a maxed ladder as an outstanding chore.
  const HOUR = 3_600_000;
  const ladderDef = (id: string, ladderId: string): RecurringDef => ({ id, name: id, durationMs: 24 * HOUR, kind: "gate", ladderId });
  const plainGate = (id: string): RecurringDef => def(id, 24 * HOUR, "gate");

  it("isCapped is true only at the ladder cap, false for a plain gate", () => {
    const lang = ladderDef("lang", "language"); // cap 20
    expect(isCapped(lang, [{ defId: "lang", position: 20 }])).toBe(true);
    expect(isCapped(lang, [{ defId: "lang", position: 19 }])).toBe(false);
    expect(isCapped(lang, [])).toBe(false); // unstarted
    expect(isCapped(plainGate("books"), [{ defId: "books", position: 999 }])).toBe(false); // no ladder → never capped
  });

  it("counts ready gate defs as to-do, excluding capped ladders from both ready and total", () => {
    const defs = [ladderDef("lang", "language"), plainGate("bio")];
    const progress = [{ defId: "lang", position: 20 }]; // lang is maxed → excluded entirely
    // bio is unstarted (ready, not done); lang is capped (dropped). So 1 to-do of 1, not 2.
    expect(routineToDo([], defs, progress, 0)).toEqual({ ready: 1, total: 1 });
  });

  it("falls quiet (0 to-do) once every surviving def is satisfied", () => {
    const defs = [ladderDef("lang", "language"), plainGate("bio")];
    const running = [{ defId: "bio", expiry: 10 * HOUR, startedAt: 0 }]; // bio satisfied
    const progress = [{ defId: "lang", position: 20 }]; // lang capped → excluded
    expect(routineToDo(running, defs, progress, 0)).toEqual({ ready: 0, total: 1 });
  });
});
