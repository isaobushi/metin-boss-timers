import { describe, expect, it } from "vitest";
import { isTransientMsg } from "./transientMsg";

// The transient wire vocabulary (#72/#73): payloads cross a window boundary over a bus, so the
// guard is a wire contract — anything it rejects is silently dropped, anything it passes is
// dispatched as-is to whichever window subscribed.
describe("transientMsg (#72/#73)", () => {
  it("passes a well-formed settings-navigate with a real tab", () => {
    expect(isTransientMsg({ kind: "settings-navigate", tab: "routine" })).toBe(true);
  });

  it("rejects settings-navigate whose tab is unknown or missing — never dispatch a dead tab", () => {
    expect(isTransientMsg({ kind: "settings-navigate", tab: "bogus" })).toBe(false);
    expect(isTransientMsg({ kind: "settings-navigate" })).toBe(false);
  });

  it("passes the payload-free tour-replay (#73)", () => {
    expect(isTransientMsg({ kind: "tour-replay" })).toBe(true);
  });

  it("rejects unknown kinds and non-objects — a stale/foreign payload degrades to a drop", () => {
    expect(isTransientMsg({ kind: "self-destruct" })).toBe(false);
    expect(isTransientMsg({})).toBe(false);
    expect(isTransientMsg(null)).toBe(false);
    expect(isTransientMsg("tour-replay")).toBe(false);
    expect(isTransientMsg(42)).toBe(false);
  });

  it("rejects kinds that collide with inherited Object.prototype keys — and never throws", () => {
    expect(isTransientMsg({ kind: "constructor" })).toBe(false);
    expect(isTransientMsg({ kind: "toString" })).toBe(false);
    expect(isTransientMsg({ kind: "hasOwnProperty" })).toBe(false);
    expect(isTransientMsg({ kind: "__proto__" })).toBe(false);
  });
});
