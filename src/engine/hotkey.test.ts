import { describe, expect, it } from "vitest";
import { eventToCombo, prettyCombo, toAccelerator, type KeyEventLike } from "./hotkey";

// The hotkey model is pure: events in (plain objects), canonical strings out. No DOM,
// no OS. These pin the normalization, pretty-printing and accelerator mapping exactly.

const ev = (over: Partial<KeyEventLike>): KeyEventLike => ({
  key: "k",
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...over,
});

describe("eventToCombo", () => {
  it("normalizes a plain key", () => {
    expect(eventToCombo(ev({ key: "K" }))).toBe("k");
  });

  it("maps the space key to 'space'", () => {
    expect(eventToCombo(ev({ key: " ", altKey: true }))).toBe("alt+space");
  });

  it("emits modifiers in canonical order regardless of which flags are set", () => {
    expect(eventToCombo(ev({ key: "k", ctrlKey: true, shiftKey: true }))).toBe("ctrl+shift+k");
    // same combo expressed with all four modifiers stays in ctrl,alt,shift,meta order
    expect(
      eventToCombo(ev({ key: "k", metaKey: true, shiftKey: true, altKey: true, ctrlKey: true })),
    ).toBe("ctrl+alt+shift+meta+k");
  });

  it("returns null for a modifier-only press (still waiting for the real key)", () => {
    for (const key of ["Control", "Shift", "Alt", "Meta"]) {
      expect(eventToCombo(ev({ key, ctrlKey: true }))).toBeNull();
    }
  });
});

describe("prettyCombo", () => {
  it("renders a human-readable label", () => {
    expect(prettyCombo("ctrl+shift+k")).toBe("Ctrl + Shift + K");
    expect(prettyCombo("k")).toBe("K");
    expect(prettyCombo("alt+space")).toBe("Alt + Space");
  });

  it("renders a cleared/empty binding as an em dash", () => {
    expect(prettyCombo(undefined)).toBe("—");
    expect(prettyCombo("")).toBe("—");
  });
});

describe("toAccelerator", () => {
  it("maps a canonical combo to a Tauri accelerator", () => {
    expect(toAccelerator("ctrl+shift+k")).toBe("Control+Shift+K");
    expect(toAccelerator("alt+space")).toBe("Alt+Space");
    expect(toAccelerator("meta+k")).toBe("Super+K");
    expect(toAccelerator("k")).toBe("K");
  });
});
