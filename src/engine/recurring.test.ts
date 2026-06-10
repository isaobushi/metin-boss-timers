import { describe, expect, it } from "vitest";
import {
  type RecurringDef,
  type RunningRecurring,
  ALARM_THRESHOLD_MS,
  MAX_RUNNING,
  alarmCrossings,
  inAlarm,
  isDue,
  markDone,
  remainingMs,
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
  tag: id.slice(0, 3),
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
