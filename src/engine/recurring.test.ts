import { describe, expect, it } from "vitest";
import {
  type RecurringDef,
  type RunningRecurring,
  MAX_RUNNING,
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
