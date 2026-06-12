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

  // ---- TourCard (#70 — the 8-beat first-run tour; keys are referenced from tourSteps.ts) ----
  // Glossary note: the domain term is "Elapsable item" (CONTEXT.md), whose established user-facing
  // surface form is "expiring items" (dock.expiring, recurring.titleItems) — the tour matches the
  // labels the user actually sees. Avoid-words hold everywhere: no reminder/daily/quest/alarm.
  "tour.welcomeTitle":   "WELCOME",
  "tour.welcomeBody":    "This dock floats on top of your game — each glyph below is a tool. A quick tour of every section follows; skip any time.",
  "tour.dockTitle":      "THE DOCK",
  "tour.dockBody":       "The bar stays on top of the game window. Drag the grip to park it anywhere; every tool opens right below it.",
  "tour.skillsTitle":    "BOSS TIMERS",
  "tour.skillsBody":     "⚔ opens your Bosses: each Skill is a draining chip with sound cues in its final seconds, reset by global hotkeys mid-fight.",
  "tour.cooldownsTitle": "COOLDOWNS",
  "tour.cooldownsBody":  "⏱ starts one-shot countdowns to a fixed moment — dungeon re-entry, a spawn you're waiting out. They follow the clock and survive restarts.",
  "tour.itemsTitle":     "EXPIRING ITEMS",
  "tour.itemsBody":      "♻ watches what runs out — pet, costume, mount. Each shows the days left; ↻ restamps a fresh cycle when you feed or renew.",
  "tour.routineTitle":   "ROUTINE",
  "tour.routineBody":    "✓ is a menu of rolling chores — skill-book reads, Biologist hand-ins. You're not behind: pick what fits your character, and ✓ restamps it to its next window.",
  "tour.settingsTitle":  "SETTINGS",
  "tour.settingsBody":   "⚙ opens the settings window — bosses, hotkeys, sounds, language and backups live there. No need to go in now.",
  "tour.doneTitle":      "ALL SET",
  "tour.doneBody":       "That's the dock. Replay this tour any time from Settings. Good hunting!",
  "tour.next":           "Next →",
  "tour.back":           "← Back",
  "tour.finish":         "Got it",
  "tour.skip":           "Skip tour →",
  "tour.makeItYours":    "⚙ Make it yours →",

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
  // Per-tab explainer headers (#72) — a persistent one-liner in glossary language, teaching on
  // every visit (not just first-run). Wording mirrors the tour beats so the two surfaces agree.
  "settings.explainDungeons":   "Dungeons — your bosses and their skill chips: names, durations, sounds and global hotkeys.",
  "settings.explainCooldowns":  "Cooldowns — one-shot dungeon respawns; set each one's duration here.",
  "settings.explainItems":      "Expiring items — pet, costume, mount; set how long each cycle runs.",
  "settings.explainRoutine":    "Routine — the menu of rolling chores; add entries and tune each one's window.",

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

// ---- German chrome table (slice #85) ----
// Free-translated DE strings. Informal "du" register (Metin2 DE client convention).
// German noun capitalisation is authored here — no runtime case transforms anywhere (see ~line 57).
// Omitted keys fall back to English (see resolveChrome). Keys left untranslated are noted in the
// PR body; any key the translator is unsure of should be omitted rather than guessed badly.
//
// Section comments mirror the EN table so a human reviewer can vet section by section.
const DE_PARTIAL: Partial<Record<ChromeKey, string>> = {
  // ---- DockBar ----
  "dock.drag":            "verschieben",
  "dock.skills":          "Skills",
  "dock.cooldowns":       "Dungeon-Cooldowns",
  "dock.expiring":        "Ablaufende Items",
  "dock.routine":         "Routine",
  "dock.settings":        "Einstellungen",
  "dock.quit":            "Dragon's Aid beenden",

  // ---- TimerScreen ----
  "timer.noSkills":       "keine Skills — füge welche in ⚙ Einstellungen hinzu",
  "timer.back":           "zurück zu Dungeons",
  "timer.hintLeftClick":  "Linksklick",
  "timer.hintStopStart":  "stop / start",
  "timer.hintRightClick": "Rechtsklick",
  "timer.hintReset":      "zurücksetzen",

  // ---- BossSelect ----
  "bossSelect.title":     "DUNGEON WÄHLEN",

  // ---- SequenceScreen ----
  "sequence.back":                  "zurück zur Dungeon-Auswahl",
  "sequence.switchToColumns":       "Zu Spalten wechseln (Phase 2)",
  "sequence.switchToElements":      "Zu Elemente wechseln (Phase 1)",
  "sequence.switchToColumnsTitle":  "zu Spalten wechseln (Phase 2)",
  "sequence.switchToElementsTitle": "zu Elemente wechseln (Phase 1)",
  "sequence.columnsLabel":          "Spalten",
  "sequence.elementsLabel":         "Elemente",
  "sequence.undo":                  "rückgängig",
  "sequence.clear":                 "leeren",
  "sequence.queenShift":            "Queen-Verschiebung",
  "sequence.queenShiftTitle":       "Queen: Reihenfolge um eine Position verschieben (1·2·3·4 → 4·1·2·3)",
  "sequence.empty":                 "oben tippen, um die Reihenfolge aufzuzeichnen — Chip antippen zum Abhaken",
  "sequence.chipTitle":             "antippen wenn zerstört / geöffnet",
  "sequence.titleElements":         "TEMPLUM · ELEMENTE",
  "sequence.titleColumns":          "TEMPLUM · SPALTEN",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "Boss-Name",
  "boss.deleteBoss":          "Boss löschen",
  "boss.colSkill":            "SKILL",
  "boss.colSec":              "SEK",
  "boss.colSound":            "SOUND",
  "boss.colHotkey":           "HOTKEY",
  "boss.skillNamePlaceholder": "Name",
  "boss.durationTitle":       "Dauer (Sekunden)",
  "boss.soundTitle":          "Sound für die Hinweise dieses Skills",
  "boss.previewSound":        "Sound vorhören",
  "boss.hotkeyTitle":         "Hotkey zum Zurücksetzen — klicken, dann Taste drücken (Esc löscht)",
  "boss.removeSkill":         "Skill entfernen",
  "boss.noSkills":            "noch keine Skills",
  "boss.addSkill":            "+ SKILL HINZUFÜGEN",

  // ---- CooldownSettings ----
  "cooldown.title":           "COOLDOWNS",
  "cooldown.colName":         "NAME",
  "cooldown.colTag":          "TAG",
  "cooldown.colDuration":     "DAUER",
  "cooldown.namePlaceholder": "Name",
  "cooldown.tagPlaceholder":  "Tag",
  "cooldown.tagTitle":        "Kurzbezeichnung im Strip (aus dem Namen abgeleitet; bearbeitbar)",
  "cooldown.durationTitle":   "Dauer (Stunden / Minuten)",
  "cooldown.removeCooldown":  "Cooldown entfernen",
  "cooldown.noCooldowns":     "noch keine Cooldowns",
  "cooldown.addCooldown":     "+ COOLDOWN HINZUFÜGEN",

  // ---- RecurringSettings ----
  "recurring.colName":        "NAME",
  "recurring.colDuration":    "DAUER",
  "recurring.namePlaceholder": "Name",
  "recurring.durationTitle":  "Dauer (Tage / Stunden / Minuten)",
  "recurring.removeItem":     "Item entfernen",
  "recurring.titleItems":     "ABLAUFENDE ITEMS",
  "recurring.titleRoutine":   "ROUTINE",
  "recurring.addItem":        "+ ITEM HINZUFÜGEN",
  "recurring.addRoutine":     "+ ROUTINE HINZUFÜGEN",
  "recurring.noItems":        "noch keine ablaufenden Items",
  "recurring.noRoutine":      "noch keine Routine-Items",

  // ---- CooldownPicker ----
  "picker.startCooldown":     "Cooldown starten",
  "picker.hint":              "scrollen zum Ändern der Zeit",
  "picker.itemTitle":         "klicken zum Starten · scrollen zum Anpassen",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint":   "Linksklick neu starten · Rechtsklick löschen",

  // ---- ExpiringAccordion ----
  "expiring.empty":           "noch keine ablaufenden Items",
  "expiring.refresh":         "erneuern — neuen vollen Zyklus ab jetzt stempeln",
  "expiring.start":           "starten — vollen Zyklus ab jetzt stempeln",

  // ---- RoutineAccordion ----
  "routine.empty":            "noch keine Routine-Items",
  "routine.sectionBooks":     "Skillbücher",
  "routine.sectionLanguages": "Sprachen",
  "routine.sectionChores":    "Hilfsmittel",
  "routine.readSuccessReady": "Lesen erfolgreich — Stufe erhöhen und 24h-Gate neu stempeln",
  "routine.readSuccessEarly": "jetzt gelesen (Cooldown übersprungen) — Stufe erhöhen und ab jetzt neu stempeln",
  "routine.readFailReady":    "Lesen fehlgeschlagen — Buch verbrannt, keine Stufenerhöhung; 24h-Gate neu stempeln",
  "routine.readFailEarly":    "jetzt gelesen (Cooldown übersprungen) aber fehlgeschlagen — Buch verbrannt, keine Stufenerhöhung; ab jetzt neu stempeln",
  "routine.markDoneReady":    "erledigt — vollen Zyklus ab jetzt neu stempeln",
  "routine.markDoneEarly":    "früh erledigt — ab jetzt neu stempeln (Wartezeit verfällt)",

  // ---- RungCurtain ----
  "rung.triggerTitle":        "aktuelle Stufe festlegen",
  "rung.filterPlaceholder":   "Stufen filtern…",
  "rung.filterAriaLabel":     "Stufen filtern",
  "rung.noMatch":             "kein Treffer",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle":  "aktiver Charakter",
  "char.frozenTitle":           "Eingefroren — abonniere erneut, um diesen Charakter zu nutzen",
  "char.editTitle":             "bearbeiten / klassifizieren",
  "char.editFrozenTitle":       "eingefroren — abonniere erneut zum Bearbeiten",
  "char.deleteTitle":           "löschen",
  "char.deleteFrozenTitle":     "eingefroren — abonniere erneut zum Verwalten",
  "char.deleteOnlyTitle":       "der einzige Charakter kann nicht gelöscht werden",
  "char.newCharacter":          "+ Neuer Charakter",
  "char.addWithPro":            "✦ Charaktere mit Pro hinzufügen",

  // ---- CharacterWizard ----
  "wizard.newCharacter":    "NEUER CHARAKTER",
  "wizard.editCharacter":   "CHARAKTER BEARBEITEN",
  "wizard.cancel":          "Abbrechen",
  "wizard.namePlaceholder": "Charaktername…",
  "wizard.nameAriaLabel":   "Charaktername",
  "wizard.back":            "← Zurück",
  "wizard.next":            "Weiter →",
  "wizard.save":            "Speichern",
  "wizard.create":          "Erstellen",

  // ---- TourCard ----
  "tour.welcomeTitle":   "WILLKOMMEN",
  "tour.welcomeBody":    "Diese Leiste schwebt über deinem Spiel — jedes Symbol darunter ist ein Werkzeug. Eine kurze Tour durch alle Bereiche folgt; überspringen geht jederzeit.",
  "tour.dockTitle":      "DIE LEISTE",
  "tour.dockBody":       "Die Leiste bleibt über dem Spielfenster. Zieh sie am Griff, wohin du willst; jedes Werkzeug öffnet sich direkt darunter.",
  "tour.skillsTitle":    "BOSS-TIMER",
  "tour.skillsBody":     "⚔ öffnet deine Bosse: jeder Skill ist ein ablaufender Chip mit Tonsignalen in den letzten Sekunden — mitten im Kampf per globalem Hotkey zurücksetzbar.",
  "tour.cooldownsTitle": "COOLDOWNS",
  "tour.cooldownsBody":  "⏱ startet einmalige Countdowns auf einen festen Zeitpunkt — Dungeon-Wiedereintritt oder ein Spawn, auf den du wartest. Sie folgen der Uhr und überleben Neustarts.",
  "tour.itemsTitle":     "ABLAUFENDE ITEMS",
  "tour.itemsBody":      "♻ behält im Blick, was abläuft — Pet, Kostüm, Mount. Jedes zeigt die Resttage; ↻ stempelt einen frischen Zyklus, wenn du fütterst oder erneuerst.",
  "tour.routineTitle":   "ROUTINE",
  "tour.routineBody":    "✓ ist ein Menü wiederkehrender Aufgaben — Skillbuch-Lesen, Biologen-Abgaben. Du bist nicht im Rückstand: wähl, was zu deinem Charakter passt, und ✓ stempelt es aufs nächste Fenster.",
  "tour.settingsTitle":  "EINSTELLUNGEN",
  "tour.settingsBody":   "⚙ öffnet das Einstellungsfenster — Bosse, Hotkeys, Sounds, Sprache und Backups wohnen dort. Da müssen wir jetzt nicht rein.",
  "tour.doneTitle":      "FERTIG",
  "tour.doneBody":       "Das ist die Leiste. Du kannst diese Tour jederzeit in den Einstellungen neu starten. Gute Jagd!",
  "tour.next":           "Weiter →",
  "tour.back":           "← Zurück",
  "tour.finish":         "Verstanden",
  "tour.skip":           "Tour überspringen →",
  "tour.makeItYours":    "⚙ Pass es an →",

  // ---- SubscribeScreen ----
  // Short UI labels translated; long prose lede strings omitted (English fallback).
  "subscribe.title":         "DRAGONSAID PRO",
  "subscribe.planAriaLabel": "Abonnement-Plan",
  "subscribe.bestValue":     "BESTES ANGEBOT",
  "subscribe.planAnnual":    "Jährlich",
  "subscribe.planMonthly":   "Monatlich",
  "subscribe.startTrial":    "7-tägige kostenlose Testversion starten",
  "subscribe.done":          "Fertig",
  "subscribe.notNow":        "Nicht jetzt",
  "subscribe.resubscribe":   "Erneut abonnieren",
  "subscribe.subscribe":     "Abonnieren",
  "subscribe.orSubscribeNow": "oder jetzt abonnieren",

  // ---- UpgradeBanner ----
  "banner.trialLabel":   "✦ Pro-Testversion aktiv",
  "banner.trialCta":     "Pro behalten",
  "banner.lapsedLabel":  "✦ Pro pausiert — dein Stall ist eingefroren",
  "banner.lapsedCta":    "Erneut abonnieren",
  "banner.neverLabel":   "✦ Dragon's Aid Pro freischalten",
  "banner.neverCta":     "Upgraden",

  // ---- CapNudge ----
  "cap.seePro":    "Pro ansehen",
  "cap.dismiss":   "Schließen",

  // ---- SettingsApp ----
  "settings.title":           "EINSTELLUNGEN",
  "settings.resetToDefaults": "auf Standardwerte zurücksetzen",
  "settings.resetConfirm":    "Alle Bosse, Skills, Cooldowns und Items auf Standardwerte zurücksetzen?",
  "settings.close":           "schließen",
  "settings.tabDungeons":     "Dungeons",
  "settings.tabCooldowns":    "Cooldowns",
  "settings.tabItems":        "Items",
  "settings.tabRoutine":      "Routine",
  "settings.tabLanguage":     "Sprache",
  "settings.addBoss":         "+ BOSS HINZUFÜGEN",
  "settings.closeTitle":      "Einstellungen schließen",
  "settings.explainDungeons":  "Dungeons — deine Bosse und ihre Skill-Chips: Namen, Dauern, Sounds und globale Hotkeys.",
  "settings.explainCooldowns": "Cooldowns — einmalige Dungeon-Respawns; stell hier die Dauer für jeden ein.",
  "settings.explainItems":     "Ablaufende Items — Pet, Kostüm, Mount; stell ein, wie lange jeder Zyklus läuft.",
  "settings.explainRoutine":   "Routine — das Menü wiederkehrender Aufgaben; füge Einträge hinzu und stimm ihre Fenster ab.",

  // ---- LocaleSettings ----
  "locale.title":  "SPRACHE",
  "locale.hint":   "Inhaltsnamen werden in der gewählten Sprache angezeigt. Selbst eingetragene Freitextnamen werden nie geändert.",

  // ---- BackupSection ----
  "backup.export":   "⤓ BACKUP EXPORTIEREN",
  "backup.import":   "⤒ BACKUP IMPORTIEREN",
  "backup.exported": "Backup exportiert.",
  "backup.imported": "Backup importiert.",
  "backup.invalid":  "Diese Datei ist kein gültiges Backup — nichts wurde geändert.",
};

/**
 * Per-locale tables: `en` is complete; every other locale is `Partial` with English fallback.
 * Keyed by `Locale` (not `string`) so adding a locale to the union without a chrome table — or
 * typo-ing its key here — is a compile error, matching the exhaustiveness `contentCatalog.ts`
 * already gets from its own `Record<Locale, …>` TABLES.
 */
const TABLES: Record<Locale, Partial<ChromeTable>> & { en: ChromeTable } = {
  en: EN,
  de: DE_PARTIAL,
};

/**
 * Resolve a chrome key against an arbitrary set of locale tables, falling back to English on
 * a missing key and to the raw key only as a last-resort defensive measure (unreachable for
 * any key present in the English table, which is every `ChromeKey`). Pure: exported so tests
 * can drive the fallback path with stub tables before a second locale ships.
 */
export function resolveChrome(tables: Record<string, Partial<Record<string, string>>>, key: string, locale: string): string {
  return tables[locale]?.[key] ?? tables["en"]?.[key] ?? key;
}

/**
 * Resolve a UI chrome string in `locale`. Falls back to English when the locale lacks the key
 * (so a partially-authored locale never renders blank — `de` deliberately omits the long prose
 * strings). The signature is intentionally two-arg (no default) so a new call site can't
 * silently un-localize.
 *
 * For game content (boss/ability/item names) use `displayName(catalogKey, locale)` in
 * `contentCatalog.ts` — these are separate concerns and must NOT share a table.
 */
export function t(key: ChromeKey, locale: Locale): string {
  return resolveChrome(TABLES, key, locale);
}
