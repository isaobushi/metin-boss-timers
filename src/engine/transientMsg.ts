// The transient cross-window vocabulary (PRD #63, slices #72/#73) — the engine-pure half of
// transientSync. The overlay's transientSync.ts (impure) owns the transport (Tauri event bus /
// BroadcastChannel); this module owns the message union and its wire guard, so the shapes are
// testable without a bus and every window agrees on what may ride it.

import { isSettingsTab, type SettingsTab } from "./settingsLink";

/**
 * The one-shot intents windows send each other. `settings-navigate` re-tabs an already-open
 * settings surface (#72); `tour-replay` asks the overlay to re-enter the tour (#73, the
 * "Show me around" row). Adding a member here without a validator below is a compile error.
 */
export type TransientMsg = { kind: "settings-navigate"; tab: SettingsTab } | { kind: "tour-replay" };

/**
 * Per-kind payload validators, keyed by the union's `kind`s — the mapped type makes a missed
 * update a compile error (PR #100 review: a single hardcoded guard silently dropped any new
 * kind as malformed). Each validator checks only the fields BEYOND `kind`; dispatch on the
 * discriminant happens once in `isTransientMsg`.
 */
const VALIDATORS: { [K in TransientMsg["kind"]]: (msg: { kind: K } & Record<string, unknown>) => boolean } = {
  "settings-navigate": (msg) => isSettingsTab(msg.tab),
  "tour-replay": () => true,
};

/** Runtime guard for wire payloads — a malformed message is dropped, never dispatched. */
export function isTransientMsg(value: unknown): value is TransientMsg {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  // Own-key check, not `in`: a plain object literal inherits Object.prototype, so `in` would
  // admit kinds like "constructor"/"toString" (whose inherited members return truthy when
  // called) and crash on "__proto__" (not a function). Slice-5 review.
  if (typeof kind !== "string" || !Object.hasOwn(VALIDATORS, kind)) return false;
  return VALIDATORS[kind as TransientMsg["kind"]](value as never);
}
