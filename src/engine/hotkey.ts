// Pure hotkey binding model. Like the timer and config engines it owns no DOM and no
// OS APIs — it only turns key events into canonical combo strings and back into the
// shapes the UI (pretty labels) and the OS adapter (Tauri accelerators) need. The
// impure global-shortcut registration lives in `overlay/hotkeys.ts`; everything here
// is unit-testable with plain objects.
//
// Canonical combo form: lowercase, `+`-joined, modifiers first in a FIXED order
// (ctrl, alt, shift, meta) then the key — e.g. "k", "ctrl+shift+k", "alt+space".
// Storing one canonical string means a binding compares and de-dupes by string equality
// regardless of the order the user happened to press the modifiers in.

/** The minimal slice of a KeyboardEvent we read — so combos are testable without the DOM. */
export type KeyEventLike = {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

// Modifier-only presses (the user is still holding keys down) produce no combo yet.
const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

// Canonical modifier order, applied regardless of press order.
const MOD_ORDER = ["ctrl", "alt", "shift", "meta"] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Normalize a key's name: space → "space", everything else lowercased. */
const normalizeKey = (key: string): string => (key === " " ? "space" : key.toLowerCase());

/**
 * Canonical combo string for a key event, or `null` for a modifier-only press (keep
 * waiting for the real key). Modifiers are emitted in `MOD_ORDER`, so "Shift+Ctrl+K"
 * and "Ctrl+Shift+K" both normalize to "ctrl+shift+k".
 */
export function eventToCombo(e: KeyEventLike): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const flags: Record<(typeof MOD_ORDER)[number], boolean> = {
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    meta: e.metaKey,
  };
  const parts = MOD_ORDER.filter((m) => flags[m]) as string[];
  parts.push(normalizeKey(e.key));
  return parts.join("+");
}

/**
 * Human-readable label for a stored combo (`ctrl+shift+k` → "Ctrl + Shift + K"); an
 * empty/cleared binding renders as an em dash. Single-character keys are upper-cased;
 * named parts (modifiers, "space") are capitalized.
 */
export function prettyCombo(combo: string | undefined): string {
  if (!combo) return "—";
  return combo
    .split("+")
    .map((p) => (p.length === 1 ? p.toUpperCase() : cap(p)))
    .join(" + ");
}

// Combo modifier token → Tauri/`global-hotkey` accelerator modifier. `meta` maps to
// "Super" (the Cmd key on macOS, the Windows key elsewhere).
const ACCEL_MODS: Record<string, string> = {
  ctrl: "Control",
  alt: "Alt",
  shift: "Shift",
  meta: "Super",
};

/**
 * Translate a canonical combo into a Tauri global-shortcut accelerator string
 * (`ctrl+shift+k` → "Control+Shift+K", `alt+space` → "Alt+Space"). Key parts are
 * upper-cased (single char) or capitalized (named, e.g. "Space", "F1").
 */
export function toAccelerator(combo: string): string {
  return combo
    .split("+")
    .map((p) => ACCEL_MODS[p] ?? (p.length === 1 ? p.toUpperCase() : cap(p)))
    .join("+");
}
