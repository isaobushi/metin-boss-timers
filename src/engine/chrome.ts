// Pure UI-chrome resolver (PRD #77, slice #84): the module that owns "how a chrome string is
// spelled in a given locale". Its interface is two stable shapes:
//   - `t(key, locale) → string` — the public resolver components call
//   - `resolveChrome(tables, key, locale) → string` — the pure core `t()` wraps, exported so
//     tests can drive the fallback path with stub tables before a second locale ships (same
//     approach as locale.test.ts for the equivalent content-catalog bind)
//
// SEPARATION OF CONCERNS: this resolver handles UI CHROME (buttons, labels, titles, empty
// states, aria-labels, tooltips, confirm copy) — strings that are FREE-TRANSLATED for each
// locale. Game content (boss/ability/item names) must be TRANSCRIBED from the official client
// and lives in `contentCatalog.ts`. These two concerns are deliberately separate modules with
// no shared table; routing a game term through `t()` would risk translating something that
// must be transcribed verbatim.
//
// KEY NAMING: stable, surface-namespaced identifiers (`surface.concept`). Each surface has
// its own section in the English table so a future translator can navigate by surface. The
// table shape is `Record<ChromeKey, string>` — unknown keys are compile errors in `t()` calls,
// while non-`en` tables (Slice 5+) can be `Partial<Record<ChromeKey, string>>` with runtime
// English fallback for any missing key.

import type { Locale } from "./localeTypes";

// ---- English chrome table ----
// Grouped by surface (section comments). These are the authoritative English strings; every
// `en` value must match the literal that was in the component before this migration — verified
// by the issue's "English output unchanged" acceptance criterion.

const EN = {
  // ---- DockBar ----
  "dock.drag":            "drag to move",
  "dock.skills":          "skills",
  "dock.cooldowns":       "dungeon cooldowns",
  "dock.expiring":        "expiring items",
  "dock.routine":         "routine",
  "dock.settings":        "settings",
  "dock.quit":            "quit Dragon's Aid",

  // ---- TimerScreen ----
  "timer.noSkills":       "no skills — add some in ⚙ settings",
  "timer.back":           "back to dungeons",
  // The hint renders with inline <b> tags, so it is split at the bold boundaries: the JSX keeps
  // the structure (<b>{leftClick}</b> {stopStart} · <b>{rightClick}</b> {reset}) and each segment
  // is its own key — a translator authors all four; the · separator stays layout, not language.
  "timer.hintLeftClick":  "left-click",
  "timer.hintStopStart":  "stop / start",
  "timer.hintRightClick": "right-click",
  "timer.hintReset":      "reset",

  // ---- BossSelect ----
  "bossSelect.title":     "SELECT DUNGEON",

  // ---- SequenceScreen ----
  "sequence.back":            "back to boss select",
  "sequence.switchToColumns": "Switch to Columns (Phase 2)",
  "sequence.switchToElements": "Switch to Elements (Phase 1)",
  // The title (tooltip) variants are authored separately rather than derived by .toLowerCase():
  // a runtime case transform would corrupt locales with their own casing rules (German nouns).
  "sequence.switchToColumnsTitle": "switch to columns (Phase 2)",
  "sequence.switchToElementsTitle": "switch to elements (Phase 1)",
  "sequence.columnsLabel":    "Columns",
  "sequence.elementsLabel":   "Elements",
  "sequence.undo":            "undo last",
  "sequence.clear":           "clear",
  "sequence.queenShift":      "Queen shift",
  "sequence.queenShiftTitle": "queen: shift the order one place (1·2·3·4 → 4·1·2·3)",
  "sequence.empty":           "tap above to record the order — tap a chip to tick it off",
  "sequence.chipTitle":       "tap when destroyed / opened",
  "sequence.titleElements":   "TEMPLUM · ELEMENTS",
  "sequence.titleColumns":    "TEMPLUM · COLUMNS",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "boss name",
  "boss.deleteBoss":          "delete boss",
  "boss.colSkill":            "SKILL",
  "boss.colSec":              "SEC",
  "boss.colSound":            "SOUND",
  "boss.colHotkey":           "HOTKEY",
  "boss.skillNamePlaceholder": "name",
  "boss.durationTitle":       "duration (seconds)",
  "boss.soundTitle":          "sound played on this skill's cues",
  "boss.previewSound":        "preview this sound",
  "boss.hotkeyTitle":         "hotkey to reset this timer — click, then press a key (Esc clears)",
  "boss.removeSkill":         "remove skill",
  "boss.noSkills":            "no skills yet",
  "boss.addSkill":            "+ ADD SKILL",

  // ---- CooldownSettings ----
  "cooldown.title":           "COOLDOWNS",
  "cooldown.colName":         "NAME",
  "cooldown.colTag":          "TAG",
  "cooldown.colDuration":     "DURATION",
  "cooldown.namePlaceholder": "name",
  "cooldown.tagPlaceholder":  "tag",
  "cooldown.tagTitle":        "short label shown in the strip (auto-derived from the name; editable)",
  "cooldown.durationTitle":   "duration (hours / minutes)",
  "cooldown.removeCooldown":  "remove cooldown",
  "cooldown.noCooldowns":     "no cooldowns yet",
  "cooldown.addCooldown":     "+ ADD COOLDOWN",

  // ---- RecurringSettings ----
  "recurring.colName":        "NAME",
  "recurring.colDuration":    "DURATION",
  "recurring.namePlaceholder": "name",
  "recurring.durationTitle":  "duration (days / hours / minutes)",
  "recurring.removeItem":     "remove item",
  "recurring.titleItems":     "EXPIRING ITEMS",
  "recurring.titleRoutine":   "ROUTINE",
  "recurring.addItem":        "+ ADD ITEM",
  "recurring.addRoutine":     "+ ADD ROUTINE",
  "recurring.noItems":        "no expiring items yet",
  "recurring.noRoutine":      "no routine items yet",

  // ---- CooldownPicker ----
  "picker.startCooldown":     "start a cooldown",
  "picker.hint":              "scroll to change time",
  "picker.itemTitle":         "click to start · scroll to tune duration",

  // ---- CooldownStrip ----
  // The pill tooltip's chrome suffix; the `${name} — ` prefix is game content and stays in JSX.
  "cooldownStrip.pillHint":   "left-click restart · right-click clear",

  // ---- ExpiringAccordion ----
  "expiring.empty":           "no expiring items yet",
  "expiring.refresh":         "refresh — restamp a full cycle from now",
  "expiring.start":           "start — stamp a full cycle from now",

  // ---- RoutineAccordion ----
  "routine.empty":            "no routine items yet",
  // Section-band headers (#57). These name UI groupings, not game terms — chrome, not catalog.
  "routine.sectionBooks":     "Skill Books",
  "routine.sectionLanguages": "Languages",
  "routine.sectionChores":    "Utilities",
  "routine.readSuccessReady": "successful read — advance the rung and restamp the 24h gate",
  "routine.readSuccessEarly": "read now (skipped the cooldown) — advance the rung and restamp from now",
  "routine.readFailReady":    "failed read — book burned, no advance; restamp the 24h gate",
  "routine.readFailEarly":    "read now (skipped the cooldown) but failed — book burned, no advance; restamp from now",
  "routine.markDoneReady":    "mark done — restamp a full cycle from now",
  "routine.markDoneEarly":    "done early — restamp from now (forfeits the wait)",

  // ---- RungCurtain ----
  "rung.triggerTitle":        "set current rung",
  "rung.filterPlaceholder":   "filter rungs…",
  "rung.filterAriaLabel":     "filter rungs",
  "rung.noMatch":             "no match",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle":  "active character",
  "char.frozenTitle":           "Frozen — resubscribe to use this character",
  "char.editTitle":             "edit / classify",
  "char.editFrozenTitle":       "frozen — resubscribe to edit",
  "char.deleteTitle":           "delete",
  "char.deleteFrozenTitle":     "frozen — resubscribe to manage",
  "char.deleteOnlyTitle":       "the only character can't be deleted",
  "char.newCharacter":          "+ New character",
  "char.addWithPro":            "✦ Add characters with Pro",

  // ---- CharacterWizard ----
  "wizard.newCharacter":    "NEW CHARACTER",
  "wizard.editCharacter":   "EDIT CHARACTER",
  "wizard.cancel":          "cancel",
  "wizard.namePlaceholder": "character name…",
  "wizard.nameAriaLabel":   "character name",
  "wizard.back":            "← Back",
  "wizard.next":            "Next →",
  "wizard.save":            "Save",
  "wizard.create":          "Create",

  // ---- SubscribeScreen ----
  "subscribe.title":                "DRAGONSAID PRO",
  "subscribe.planAriaLabel":        "Subscription plan",
  "subscribe.bestValue":            "BEST VALUE",
  "subscribe.planAnnual":           "Annual",
  "subscribe.planMonthly":          "Monthly",
  "subscribe.startTrial":           "Start 7-day free trial",
  "subscribe.done":                 "Done",
  "subscribe.notNow":               "Not now",
  "subscribe.ledeTrial":            "You're trying Pro free. Lock it in to keep your stable when the trial ends.",
  "subscribe.ledeLapsed":           "Welcome back. Resubscribe to instantly thaw your frozen stable — nothing was lost.",
  "subscribe.ledeSubscribed":       "You're Pro. Thanks for keeping the app growing.",
  "subscribe.ledeDefault":          "The maintained, growing Pro app — curated dungeon knowledge, for your whole stable.",
  "subscribe.unlock1":              "Prebuilt dungeon sequences — Templum Serpens & more",
  "subscribe.unlock2":              "Your whole stable — unlimited character profiles",
  "subscribe.unlock3":              "Skill catalog autofilled by race & empire",
  "subscribe.unlock4":              "Per-ability ladders — M1→G1 books-remaining tracking",
  "subscribe.unlock5":              "Every cap lifted — bosses, reminders, characters",
  "subscribe.resubscribe":          "Resubscribe",
  "subscribe.subscribe":            "Subscribe",
  "subscribe.orSubscribeNow":       "or subscribe now",

  // ---- UpgradeBanner ----
  "banner.trialLabel":          "✦ Pro trial active",
  "banner.trialCta":            "Keep Pro",
  "banner.lapsedLabel":         "✦ Pro paused — your stable is frozen",
  "banner.lapsedCta":           "Resubscribe",
  "banner.neverLabel":          "✦ Unlock Dragon's Aid Pro",
  "banner.neverCta":            "Upgrade",

  // ---- CapNudge ----
  "cap.addBoss":        "Lite includes 1 custom boss. Pro lifts every cap — build as many boss sequences as you like.",
  "cap.addCharacter":   "Lite is a single character. Pro unlocks your whole stable — unlimited profiles.",
  "cap.addReminder":    "Lite includes 3 reminders. Pro lifts the cap so you can track every chore.",
  "cap.seePro":         "See Pro",
  "cap.dismiss":        "Dismiss",

  // ---- SettingsApp ----
  "settings.title":             "SETTINGS",
  "settings.resetToDefaults":   "reset to defaults",
  "settings.resetConfirm":      "Reset all bosses, skills, cooldowns and items to defaults?",
  "settings.close":             "close",
  "settings.tabDungeons":       "Dungeons",
  "settings.tabCooldowns":      "Cooldowns",
  "settings.tabItems":          "Items",
  "settings.tabRoutine":        "Routine",
  "settings.tabLanguage":       "Language",
  "settings.addBoss":           "+ ADD BOSS",
  "settings.closeTitle":        "close settings",

  // ---- LocaleSettings ----
  "locale.title":   "LANGUAGE",
  "locale.hint":    "Content names are shown in the selected language. Free-text names you typed yourself are never changed.",

  // ---- BackupSection ----
  "backup.export":    "⤓ EXPORT BACKUP",
  "backup.import":    "⤒ IMPORT BACKUP",
  "backup.hint":      "A portable copy of all your dungeons, cooldowns, characters and routines. Importing a Pro backup into Lite keeps everything — anything over the caps stays frozen until you resubscribe.",
  "backup.exported":  "Backup exported.",
  "backup.imported":  "Backup imported.",
  "backup.invalid":   "That file isn't a valid backup — nothing was changed.",
} as const;

/** Every chrome key in the English table — the only valid argument to `t()`. */
export type ChromeKey = keyof typeof EN;

/** The English chrome table (the `en` locale's full record). */
type ChromeTable = Record<ChromeKey, string>;

/** Per-locale tables: `en` is complete; every other locale is `Partial` with English fallback. */
const TABLES: Record<string, Record<string, string>> & { en: ChromeTable } = {
  en: EN,
  // Slice 5 adds: de: DE_PARTIAL, etc.
};

/**
 * Resolve a chrome key against an arbitrary set of locale tables, falling back to English on
 * a missing key and to the raw key only as a last-resort defensive measure (unreachable for
 * any key present in the English table, which is every `ChromeKey`). Pure: exported so tests
 * can drive the fallback path with stub tables before a second locale ships.
 */
export function resolveChrome(tables: Record<string, Record<string, string>>, key: string, locale: string): string {
  return tables[locale]?.[key] ?? tables["en"]?.[key] ?? key;
}

/**
 * Resolve a UI chrome string in `locale`. Falls back to English when the locale lacks the key
 * (so a partially-authored locale never renders blank). Only `en` ships until Slice 5; the
 * signature is intentionally two-arg (no default) so a new call site can't silently un-localize.
 *
 * For game content (boss/ability/item names) use `displayName(catalogKey, locale)` in
 * `contentCatalog.ts` — these are separate concerns and must NOT share a table.
 */
export function t(key: ChromeKey, locale: Locale): string {
  return resolveChrome(TABLES, key, locale);
}
