// The settings deep-link vocabulary (PRD #63, slice #72) — the engine-pure half of the
// "make it yours" nudge. The settings window is a separate document (Tauri window / browser
// tab) reached by URL hash, so a deep link must survive serialization into that hash and
// parse back out on the far side. This module owns both directions plus the canonical tab
// union; the overlay's settingsWindow.ts (impure) builds URLs with it, SettingsApp seeds its
// tab state from it, and tourSteps declares per-beat targets in it.

/**
 * The settings window's tabs, in dock order plus language. The single source of truth —
 * SettingsApp's tab strip and tourSteps' `settingsDeepLink` both reference this union, so a
 * renamed tab is a compile error at every deep-link site rather than a dead link at runtime.
 */
export type SettingsTab = "dungeons" | "cooldowns" | "items" | "routine" | "language";

const TABS: readonly SettingsTab[] = ["dungeons", "cooldowns", "items", "routine", "language"];

/** True when `value` names a settings tab — the runtime guard for hash/wire payloads. */
export function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === "string" && (TABS as readonly string[]).includes(value);
}

/**
 * Build the location hash (without the leading `#`) that opens the settings surface, optionally
 * landed on `tab`. Plain `settings` keeps the historical URL so existing windows stay valid.
 */
export function settingsHash(tab?: SettingsTab): string {
  return tab ? `settings?tab=${tab}` : "settings";
}

/**
 * Parse a location hash (with or without the leading `#`). `isSettings` mirrors the historical
 * exact-match check; `tab` is the validated deep-link target, null when absent or unrecognized
 * (an unknown tab must degrade to the default landing, never throw — links can come from a
 * stale window URL after a rename).
 */
export function parseSettingsHash(hash: string): { isSettings: boolean; tab: SettingsTab | null } {
  const [surface, query] = hash.replace(/^#/, "").split("?");
  if (surface !== "settings") return { isSettings: false, tab: null };
  const tab = new URLSearchParams(query).get("tab");
  return { isSettings: true, tab: isSettingsTab(tab) ? tab : null };
}
