import { describe, expect, it } from "vitest";
import { GRACE_MS, TRIAL_MS, isTrialActive, resolveEntitlement, type GraceState } from "./storeLicense";

const T0 = 1_000_000_000_000; // a fixed fake "now"

describe("resolveEntitlement", () => {
  it("maps a valid active (non-trial) license to subscribed", () => {
    const { entitlement } = resolveEntitlement({ kind: "active", trial: false }, null, T0);
    expect(entitlement).toBe("subscribed");
  });

  it("maps a valid active trial license to trial", () => {
    const { entitlement } = resolveEntitlement({ kind: "active", trial: true }, null, T0);
    expect(entitlement).toBe("trial");
  });

  it("stamps the grace memory with the current Pro state and time on an active read", () => {
    expect(resolveEntitlement({ kind: "active", trial: false }, null, T0).grace).toEqual({
      lastProAt: T0,
      pro: "subscribed",
    });
    expect(resolveEntitlement({ kind: "active", trial: true }, null, T0).grace).toEqual({
      lastProAt: T0,
      pro: "trial",
    });
  });

  it("maps a definitively expired license to lapsed, even within the grace window", () => {
    const grace: GraceState = { lastProAt: T0, pro: "subscribed" };
    const { entitlement } = resolveEntitlement({ kind: "expired" }, grace, T0 + 1000);
    expect(entitlement).toBe("lapsed");
  });

  it("fails open: an unverifiable read within the grace window keeps the prior Pro state", () => {
    const subscribed: GraceState = { lastProAt: T0, pro: "subscribed" };
    const trial: GraceState = { lastProAt: T0, pro: "trial" };
    expect(resolveEntitlement({ kind: "unverifiable" }, subscribed, T0 + GRACE_MS).entitlement).toBe("subscribed");
    expect(resolveEntitlement({ kind: "unverifiable" }, trial, T0 + GRACE_MS).entitlement).toBe("trial");
  });

  it("drops to lapsed once an unverifiable read is past the grace window", () => {
    const grace: GraceState = { lastProAt: T0, pro: "subscribed" };
    const { entitlement } = resolveEntitlement({ kind: "unverifiable" }, grace, T0 + GRACE_MS + 1);
    expect(entitlement).toBe("lapsed");
  });

  it("maps an unverifiable read with no Pro history to never (clean Lite, nothing frozen)", () => {
    const { entitlement } = resolveEntitlement({ kind: "unverifiable" }, null, T0);
    expect(entitlement).toBe("never");
  });
});

describe("isTrialActive (#58)", () => {
  const T0 = 1_000_000_000_000;

  it("is false when no trial was ever stamped", () => {
    expect(isTrialActive(null, T0)).toBe(false);
  });

  it("is true strictly inside the window, false at and past its end", () => {
    expect(isTrialActive(T0 + TRIAL_MS, T0)).toBe(true);
    expect(isTrialActive(T0 + TRIAL_MS, T0 + TRIAL_MS - 1)).toBe(true);
    expect(isTrialActive(T0 + TRIAL_MS, T0 + TRIAL_MS)).toBe(false);
    expect(isTrialActive(T0, T0 + 1)).toBe(false);
  });

  it("reads a malformed stamp as closed — the paid (harmless) direction", () => {
    expect(isTrialActive(Number.NaN, T0)).toBe(false);
  });
});
